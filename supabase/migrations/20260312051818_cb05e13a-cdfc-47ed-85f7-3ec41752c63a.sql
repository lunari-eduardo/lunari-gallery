
-- ============================================================
-- REFERRAL SYSTEM: Tables, columns, RPCs, RLS
-- ============================================================

-- 1. Create referrals table
CREATE TABLE public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referral_code TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  select_bonus_granted BOOLEAN DEFAULT false,
  transfer_bonus_active BOOLEAN DEFAULT false,
  transfer_bonus_bytes BIGINT DEFAULT 0,
  transfer_plan_storage_bytes BIGINT DEFAULT 0,
  UNIQUE(referred_user_id)
);

CREATE INDEX idx_referrals_referrer ON public.referrals(referrer_user_id);
CREATE INDEX idx_referrals_referred ON public.referrals(referred_user_id);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own referrals" ON public.referrals
  FOR SELECT TO authenticated
  USING (referrer_user_id = auth.uid() OR referred_user_id = auth.uid());

-- No direct insert/update/delete — only via SECURITY DEFINER RPCs
CREATE POLICY "No direct insert" ON public.referrals
  FOR INSERT TO authenticated
  WITH CHECK (false);

CREATE POLICY "No direct update" ON public.referrals
  FOR UPDATE TO authenticated
  USING (false);

CREATE POLICY "No direct delete" ON public.referrals
  FOR DELETE TO authenticated
  USING (false);

-- 2. Add columns to profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES auth.users(id);

-- 3. Add storage_bonus_bytes to photographer_accounts
ALTER TABLE public.photographer_accounts
  ADD COLUMN IF NOT EXISTS storage_bonus_bytes BIGINT DEFAULT 0;

-- 4. Update credit_ledger constraint to include referral_bonus
ALTER TABLE public.credit_ledger DROP CONSTRAINT IF EXISTS credit_ledger_operation_type_check;
ALTER TABLE public.credit_ledger ADD CONSTRAINT credit_ledger_operation_type_check 
  CHECK (operation_type = ANY(ARRAY[
    'purchase','bonus','upload','refund','adjustment',
    'subscription_renewal','subscription_expiry','referral_bonus'
  ]));

-- ============================================================
-- RPCs (SECURITY DEFINER)
-- ============================================================

-- RPC: Generate unique referral code (idempotent)
CREATE OR REPLACE FUNCTION public.ensure_referral_code()
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_code TEXT; v_existing TEXT;
BEGIN
  SELECT referral_code INTO v_existing FROM profiles WHERE user_id = auth.uid();
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;
  
  LOOP
    v_code := substr(md5(random()::text || clock_timestamp()::text), 1, 8);
    BEGIN
      UPDATE profiles SET referral_code = v_code WHERE user_id = auth.uid();
      IF FOUND THEN RETURN v_code; END IF;
      -- Profile doesn't exist yet
      RETURN NULL;
    EXCEPTION WHEN unique_violation THEN NULL; -- retry with new code
    END;
  END LOOP;
END; $$;

-- RPC: Register referral (called after signup + profile exists)
CREATE OR REPLACE FUNCTION public.register_referral(_referral_code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_referrer_id UUID; v_already BOOLEAN; v_profile_exists BOOLEAN;
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
  
  -- Register
  INSERT INTO referrals (referrer_user_id, referred_user_id, referral_code)
  VALUES (v_referrer_id, auth.uid(), _referral_code);
  
  UPDATE profiles SET referred_by = v_referrer_id WHERE user_id = auth.uid();
  RETURN TRUE;
END; $$;

-- RPC: Grant Select bonus (+1000 credits to both) — idempotent via select_bonus_granted
CREATE OR REPLACE FUNCTION public.grant_referral_select_bonus(_referred_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ref RECORD;
BEGIN
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
END; $$;

-- RPC: Activate Transfer bonus (10% of plan storage)
CREATE OR REPLACE FUNCTION public.activate_referral_transfer_bonus(_referred_user_id UUID, _plan_storage_bytes BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ref RECORD; v_bonus BIGINT;
BEGIN
  SELECT * INTO v_ref FROM referrals WHERE referred_user_id = _referred_user_id FOR UPDATE;
  IF v_ref IS NULL THEN RETURN FALSE; END IF;
  
  -- Guard: already active (idempotent for repeated webhooks)
  IF v_ref.transfer_bonus_active = true THEN RETURN FALSE; END IF;
  
  v_bonus := (_plan_storage_bytes * 10) / 100;
  
  -- Add bonus to referrer
  UPDATE photographer_accounts 
  SET storage_bonus_bytes = COALESCE(storage_bonus_bytes, 0) + v_bonus, updated_at = NOW()
  WHERE user_id = v_ref.referrer_user_id;
  
  -- Add bonus to referred
  UPDATE photographer_accounts 
  SET storage_bonus_bytes = COALESCE(storage_bonus_bytes, 0) + v_bonus, updated_at = NOW()
  WHERE user_id = _referred_user_id;
  
  UPDATE referrals 
  SET transfer_bonus_active = true, transfer_bonus_bytes = v_bonus, transfer_plan_storage_bytes = _plan_storage_bytes
  WHERE id = v_ref.id;
  
  RETURN TRUE;
END; $$;

-- RPC: Recalculate Transfer bonus (upgrade/downgrade)
CREATE OR REPLACE FUNCTION public.recalculate_referral_transfer_bonus(_referred_user_id UUID, _new_plan_storage_bytes BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ref RECORD; v_new_bonus BIGINT; v_diff BIGINT;
BEGIN
  SELECT * INTO v_ref FROM referrals 
  WHERE referred_user_id = _referred_user_id AND transfer_bonus_active = true
  FOR UPDATE;
  IF v_ref IS NULL THEN RETURN FALSE; END IF;
  
  v_new_bonus := (_new_plan_storage_bytes * 10) / 100;
  v_diff := v_new_bonus - v_ref.transfer_bonus_bytes;
  
  -- If diff is 0, nothing to do
  IF v_diff = 0 THEN RETURN TRUE; END IF;
  
  -- Adjust referrer storage (can go negative to remove excess bonus)
  UPDATE photographer_accounts 
  SET storage_bonus_bytes = GREATEST(0, COALESCE(storage_bonus_bytes, 0) + v_diff), updated_at = NOW()
  WHERE user_id = v_ref.referrer_user_id;
  
  -- Adjust referred storage
  UPDATE photographer_accounts 
  SET storage_bonus_bytes = GREATEST(0, COALESCE(storage_bonus_bytes, 0) + v_diff), updated_at = NOW()
  WHERE user_id = _referred_user_id;
  
  UPDATE referrals 
  SET transfer_bonus_bytes = v_new_bonus, transfer_plan_storage_bytes = _new_plan_storage_bytes
  WHERE id = v_ref.id;
  
  RETURN TRUE;
END; $$;

-- RPC: Deactivate Transfer bonus (subscription cancelled)
CREATE OR REPLACE FUNCTION public.deactivate_referral_transfer_bonus(_referred_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ref RECORD;
BEGIN
  SELECT * INTO v_ref FROM referrals 
  WHERE referred_user_id = _referred_user_id AND transfer_bonus_active = true
  FOR UPDATE;
  IF v_ref IS NULL THEN RETURN FALSE; END IF;
  
  -- Remove bonus from referrer
  UPDATE photographer_accounts 
  SET storage_bonus_bytes = GREATEST(0, COALESCE(storage_bonus_bytes, 0) - v_ref.transfer_bonus_bytes), updated_at = NOW()
  WHERE user_id = v_ref.referrer_user_id;
  
  -- Remove bonus from referred
  UPDATE photographer_accounts 
  SET storage_bonus_bytes = GREATEST(0, COALESCE(storage_bonus_bytes, 0) - v_ref.transfer_bonus_bytes), updated_at = NOW()
  WHERE user_id = _referred_user_id;
  
  UPDATE referrals 
  SET transfer_bonus_active = false, transfer_bonus_bytes = 0, transfer_plan_storage_bytes = 0
  WHERE id = v_ref.id;
  
  RETURN TRUE;
END; $$;
