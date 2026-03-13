
-- ============================================================
-- Anti-Fraud: Device Fingerprint Tracking
-- ============================================================

-- 1. Create account_fingerprints table
CREATE TABLE IF NOT EXISTS public.account_fingerprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_fingerprint TEXT NOT NULL,
  ip_address TEXT,
  event_type TEXT NOT NULL DEFAULT 'signup',
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast fingerprint lookups
CREATE INDEX IF NOT EXISTS idx_account_fingerprints_device ON public.account_fingerprints (device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_account_fingerprints_user ON public.account_fingerprints (user_id);
CREATE INDEX IF NOT EXISTS idx_account_fingerprints_ip ON public.account_fingerprints (ip_address);

-- Enable RLS
ALTER TABLE public.account_fingerprints ENABLE ROW LEVEL SECURITY;

-- Users can read their own fingerprints only
CREATE POLICY "Users can read own fingerprints"
  ON public.account_fingerprints FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- No direct insert from client — only via SECURITY DEFINER functions
-- Admin can read all
CREATE POLICY "Admins can read all fingerprints"
  ON public.account_fingerprints FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- 2. Add suspected_duplicate flag to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS suspected_duplicate BOOLEAN DEFAULT false;

-- 3. Function to record fingerprint (called by edge function with service key)
CREATE OR REPLACE FUNCTION public.record_device_fingerprint(
  _user_id UUID,
  _fingerprint TEXT,
  _ip_address TEXT DEFAULT NULL,
  _event_type TEXT DEFAULT 'login',
  _user_agent TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_is_duplicate BOOLEAN := false;
  v_existing_users UUID[];
BEGIN
  -- Check if this fingerprint is already associated with OTHER users
  SELECT ARRAY_AGG(DISTINCT af.user_id)
  INTO v_existing_users
  FROM account_fingerprints af
  WHERE af.device_fingerprint = _fingerprint
    AND af.user_id != _user_id;

  IF v_existing_users IS NOT NULL AND array_length(v_existing_users, 1) > 0 THEN
    v_is_duplicate := true;
    
    -- Flag the new account as suspected duplicate
    UPDATE profiles SET suspected_duplicate = true, updated_at = now()
    WHERE user_id = _user_id;
    
    RAISE LOG 'Anti-fraud: duplicate fingerprint detected for user %, also used by %', _user_id, v_existing_users;
  END IF;

  -- Record the fingerprint event
  INSERT INTO account_fingerprints (user_id, device_fingerprint, ip_address, event_type, user_agent)
  VALUES (_user_id, _fingerprint, _ip_address, _event_type, _user_agent);

  RETURN jsonb_build_object(
    'recorded', true,
    'is_duplicate', v_is_duplicate,
    'matching_users_count', COALESCE(array_length(v_existing_users, 1), 0)
  );
END;
$$;

-- 4. Update handle_new_user_profile to check fingerprint
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_is_authorized BOOLEAN;
  v_fingerprint TEXT;
  v_is_duplicate BOOLEAN := false;
BEGIN
  -- Extract fingerprint from user metadata (set during signup)
  v_fingerprint := NEW.raw_user_meta_data->>'device_fingerprint';
  
  -- Check if fingerprint already exists for another user
  IF v_fingerprint IS NOT NULL AND v_fingerprint != '' THEN
    SELECT EXISTS(
      SELECT 1 FROM account_fingerprints
      WHERE device_fingerprint = v_fingerprint
        AND user_id != NEW.id
    ) INTO v_is_duplicate;
  END IF;

  -- STEP 1: Create profile
  INSERT INTO public.profiles (user_id, email, nome, avatar_url, is_onboarding_complete, suspected_duplicate)
  VALUES (
    NEW.id, 
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', ''),
    FALSE,
    v_is_duplicate
  )
  ON CONFLICT (user_id) DO UPDATE SET
    email = EXCLUDED.email,
    nome = COALESCE(NULLIF(profiles.nome, ''), EXCLUDED.nome),
    avatar_url = COALESCE(NULLIF(profiles.avatar_url, ''), EXCLUDED.avatar_url),
    suspected_duplicate = CASE WHEN EXCLUDED.suspected_duplicate THEN true ELSE profiles.suspected_duplicate END,
    updated_at = now();
  
  RAISE LOG 'Profile created/updated for user: % (duplicate: %)', NEW.email, v_is_duplicate;
  
  -- STEP 2: Create photographer account
  -- If suspected duplicate: 0 credits and 0 free storage
  IF v_is_duplicate THEN
    INSERT INTO public.photographer_accounts (user_id, account_type, account_status, photo_credits, free_transfer_bytes)
    VALUES (NEW.id, 'gallery_solo', 'active', 0, 0)
    ON CONFLICT (user_id) DO NOTHING;
    
    RAISE LOG 'Anti-fraud: suspected duplicate account, NO free credits/storage for: %', NEW.email;
  ELSE
    INSERT INTO public.photographer_accounts (user_id, account_type, account_status, photo_credits, free_transfer_bytes)
    VALUES (NEW.id, 'gallery_solo', 'active', 500, 536870912)
    ON CONFLICT (user_id) DO NOTHING;
    
    RAISE LOG 'Photographer account created with 500 credits + 0.5GB for user: %', NEW.email;
  END IF;
  
  -- Record fingerprint if available
  IF v_fingerprint IS NOT NULL AND v_fingerprint != '' THEN
    INSERT INTO account_fingerprints (user_id, device_fingerprint, event_type)
    VALUES (NEW.id, v_fingerprint, 'signup');
  END IF;
  
  -- STEP 3: Check if user is admin
  IF NEW.email = 'lisediehlfotos@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
    RAISE LOG 'Admin role assigned to: %', NEW.email;
    RETURN NEW;
  END IF;
  
  -- STEP 4: Check if email is authorized
  SELECT EXISTS(SELECT 1 FROM public.allowed_emails WHERE email = NEW.email) INTO v_is_authorized;
  IF v_is_authorized THEN
    RAISE LOG 'Authorized email registered (no trial needed): %', NEW.email;
    RETURN NEW;
  END IF;
  
  RAISE LOG 'Gallery signup complete for: %', NEW.email;
  RETURN NEW;
END;
$$;

-- 5. Update register_referral to check fingerprint overlap
CREATE OR REPLACE FUNCTION public.register_referral(_referral_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE 
  v_referrer_id UUID; 
  v_already BOOLEAN; 
  v_profile_exists BOOLEAN;
  v_fingerprint_overlap BOOLEAN := false;
  v_is_suspected BOOLEAN := false;
BEGIN
  -- Check profile exists for current user
  SELECT EXISTS(SELECT 1 FROM profiles WHERE user_id = auth.uid()) INTO v_profile_exists;
  IF NOT v_profile_exists THEN RETURN FALSE; END IF;
  
  -- Find referrer by code
  SELECT user_id INTO v_referrer_id FROM profiles WHERE referral_code = _referral_code;
  IF v_referrer_id IS NULL THEN RETURN FALSE; END IF;
  
  -- Cannot refer yourself
  IF v_referrer_id = auth.uid() THEN RETURN FALSE; END IF;
  
  -- Already referred?
  SELECT EXISTS(SELECT 1 FROM referrals WHERE referred_user_id = auth.uid()) INTO v_already;
  IF v_already THEN RETURN FALSE; END IF;
  
  -- Already has referred_by set?
  IF EXISTS(SELECT 1 FROM profiles WHERE user_id = auth.uid() AND referred_by IS NOT NULL) THEN
    RETURN FALSE;
  END IF;
  
  -- ANTI-FRAUD: Check if referred user shares a fingerprint with the referrer
  SELECT EXISTS(
    SELECT 1 
    FROM account_fingerprints af_referred
    INNER JOIN account_fingerprints af_referrer 
      ON af_referred.device_fingerprint = af_referrer.device_fingerprint
    WHERE af_referred.user_id = auth.uid()
      AND af_referrer.user_id = v_referrer_id
  ) INTO v_fingerprint_overlap;
  
  IF v_fingerprint_overlap THEN
    RAISE LOG 'Anti-fraud: referral rejected — same device fingerprint between referrer % and referred %', v_referrer_id, auth.uid();
    RETURN FALSE;
  END IF;
  
  -- ANTI-FRAUD: Check if referred user is a suspected duplicate
  SELECT COALESCE(suspected_duplicate, false) INTO v_is_suspected 
  FROM profiles WHERE user_id = auth.uid();
  
  IF v_is_suspected THEN
    RAISE LOG 'Anti-fraud: referral rejected — referred user % is suspected duplicate', auth.uid();
    RETURN FALSE;
  END IF;
  
  -- Register
  INSERT INTO referrals (referrer_user_id, referred_user_id, referral_code)
  VALUES (v_referrer_id, auth.uid(), _referral_code);
  
  UPDATE profiles SET referred_by = v_referrer_id WHERE user_id = auth.uid();
  RETURN TRUE;
END;
$$;

-- 6. Update grant_referral_select_bonus to check suspected_duplicate
CREATE OR REPLACE FUNCTION public.grant_referral_select_bonus(_referred_user_id UUID)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_ref RECORD; v_is_suspected BOOLEAN;
BEGIN
  -- Check if referred user is suspected duplicate
  SELECT COALESCE(suspected_duplicate, false) INTO v_is_suspected
  FROM profiles WHERE user_id = _referred_user_id;
  
  IF v_is_suspected THEN
    RAISE LOG 'Anti-fraud: referral bonus denied — user % is suspected duplicate', _referred_user_id;
    RETURN FALSE;
  END IF;

  SELECT * INTO v_ref FROM referrals 
  WHERE referred_user_id = _referred_user_id AND select_bonus_granted = false
  FOR UPDATE;
  IF v_ref IS NULL THEN RETURN FALSE; END IF;
  
  -- +1000 for referrer
  UPDATE photographer_accounts SET photo_credits = COALESCE(photo_credits, 0) + 1000, updated_at = NOW() WHERE user_id = v_ref.referrer_user_id;
  INSERT INTO credit_ledger (user_id, operation_type, amount, description)
  VALUES (v_ref.referrer_user_id, 'referral_bonus', 1000, 'Bônus por indicação - Gallery Select');
  
  -- +1000 for referred
  UPDATE photographer_accounts SET photo_credits = COALESCE(photo_credits, 0) + 1000, updated_at = NOW() WHERE user_id = _referred_user_id;
  INSERT INTO credit_ledger (user_id, operation_type, amount, description)
  VALUES (_referred_user_id, 'referral_bonus', 1000, 'Bônus de boas-vindas por indicação - Gallery Select');
  
  UPDATE referrals SET select_bonus_granted = true WHERE id = v_ref.id;
  RETURN TRUE;
END;
$$;
