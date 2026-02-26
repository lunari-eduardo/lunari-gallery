
-- 1. Create unified_plans table
CREATE TABLE public.unified_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  product_family TEXT NOT NULL,
  monthly_price_cents INT NOT NULL DEFAULT 0,
  yearly_price_cents INT NOT NULL DEFAULT 0,
  features JSONB DEFAULT '[]'::jsonb,
  includes_studio BOOLEAN DEFAULT false,
  includes_select BOOLEAN DEFAULT false,
  includes_transfer BOOLEAN DEFAULT false,
  select_credits_monthly INT DEFAULT 0,
  transfer_storage_bytes BIGINT DEFAULT 0,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.unified_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active plans"
  ON public.unified_plans FOR SELECT
  USING (is_active = true);

-- 2. Add free_transfer_bytes to photographer_accounts
ALTER TABLE public.photographer_accounts
  ADD COLUMN IF NOT EXISTS free_transfer_bytes BIGINT NOT NULL DEFAULT 0;

-- 3. Add plan_id to subscriptions_asaas (optional FK)
ALTER TABLE public.subscriptions_asaas
  ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES public.unified_plans(id);

-- 4. Seed unified_plans with all plan data
INSERT INTO public.unified_plans (code, name, description, product_family, monthly_price_cents, yearly_price_cents, includes_studio, includes_select, includes_transfer, select_credits_monthly, transfer_storage_bytes, sort_order) VALUES
  ('studio_starter', 'Lunari Starter', 'Gestão básica para fotógrafos iniciantes', 'studio', 1490, 15198, true, false, false, 0, 0, 10),
  ('studio_pro', 'Lunari Pro', 'Gestão completa para fotógrafos profissionais', 'studio', 3590, 36618, true, false, false, 0, 0, 20),
  ('transfer_5gb', 'Transfer 5GB', 'Armazenamento de 5GB para entrega profissional', 'transfer', 1290, 12384, false, false, true, 0, 5368709120, 30),
  ('transfer_20gb', 'Transfer 20GB', 'Armazenamento de 20GB para entrega profissional', 'transfer', 2490, 23904, false, false, true, 0, 21474836480, 31),
  ('transfer_50gb', 'Transfer 50GB', 'Armazenamento de 50GB para entrega profissional', 'transfer', 3490, 33504, false, false, true, 0, 53687091200, 32),
  ('transfer_100gb', 'Transfer 100GB', 'Armazenamento de 100GB para entrega profissional', 'transfer', 5990, 57504, false, false, true, 0, 107374182400, 33),
  ('combo_pro_select2k', 'Studio Pro + Select 2k', 'Gestão completa com 2.000 créditos mensais', 'combo', 4490, 45259, true, true, false, 2000, 0, 40),
  ('combo_completo', 'Combo Completo', 'Gestão + 2.000 créditos + 20GB armazenamento', 'combo', 6490, 66198, true, true, true, 2000, 21474836480, 41);

-- 5. Update handle_new_user_profile trigger to grant 500 credits + 0.5GB
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pro_plan_id UUID;
  v_is_authorized BOOLEAN;
BEGIN
  -- STEP 1: Create profile (required)
  INSERT INTO public.profiles (user_id, email, nome, avatar_url, is_onboarding_complete)
  VALUES (
    NEW.id, 
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', ''),
    FALSE
  )
  ON CONFLICT (user_id) DO UPDATE SET
    email = EXCLUDED.email,
    nome = COALESCE(NULLIF(profiles.nome, ''), EXCLUDED.nome),
    avatar_url = COALESCE(NULLIF(profiles.avatar_url, ''), EXCLUDED.avatar_url),
    updated_at = now();
  
  RAISE LOG 'Profile created/updated for user: %', NEW.email;
  
  -- STEP 2: Create photographer account with 500 credits + 0.5GB free storage
  INSERT INTO public.photographer_accounts (user_id, account_type, account_status, photo_credits, free_transfer_bytes)
  VALUES (NEW.id, 'gallery_solo', 'active', 500, 536870912)
  ON CONFLICT (user_id) DO NOTHING;
  
  RAISE LOG 'Photographer account created with 500 credits + 0.5GB for user: %', NEW.email;
  
  -- STEP 3: Check if user is admin
  IF NEW.email = 'lisediehlfotos@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
    RAISE LOG 'Admin role assigned to: %', NEW.email;
    RETURN NEW;
  END IF;
  
  -- STEP 4: Check if email is authorized (permanent free access)
  SELECT EXISTS(SELECT 1 FROM public.allowed_emails WHERE email = NEW.email) INTO v_is_authorized;
  IF v_is_authorized THEN
    RAISE LOG 'Authorized email registered (no trial needed): %', NEW.email;
    RETURN NEW;
  END IF;
  
  -- STEP 5: No trial is created for Gallery signups
  -- Studio trial (30 days) is handled by the Lunari Studio project separately
  RAISE LOG 'Gallery signup complete for: %', NEW.email;
  
  RETURN NEW;
END;
$function$;

-- 6. Deactivate old plans table entries
UPDATE public.plans SET is_active = false WHERE is_active = true;
