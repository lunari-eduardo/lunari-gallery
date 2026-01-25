-- Criar enum para tipos de conta
CREATE TYPE public.account_type AS ENUM ('gallery_solo', 'starter', 'pro', 'pro_gallery');

-- Criar enum para status de conta
CREATE TYPE public.account_status AS ENUM ('active', 'suspended', 'canceled');

-- Criar tabela photographer_accounts
CREATE TABLE public.photographer_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_type account_type NOT NULL DEFAULT 'gallery_solo',
  account_status account_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Cada usuário só pode ter UMA conta
  UNIQUE(user_id)
);

-- Habilitar RLS
ALTER TABLE public.photographer_accounts ENABLE ROW LEVEL SECURITY;

-- Política: usuários podem ler sua própria conta
CREATE POLICY "Users can read own account"
  ON public.photographer_accounts
  FOR SELECT
  USING (auth.uid() = user_id);

-- Política: apenas sistema/admin pode modificar
CREATE POLICY "Admins can manage all accounts"
  ON public.photographer_accounts
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_photographer_accounts_updated_at
  BEFORE UPDATE ON public.photographer_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_photographer_accounts_user_id ON public.photographer_accounts(user_id);
CREATE INDEX idx_photographer_accounts_status ON public.photographer_accounts(account_status);

-- Function para consulta centralizada
CREATE OR REPLACE FUNCTION public.get_photographer_account(_user_id uuid)
RETURNS TABLE(
  account_id uuid,
  account_type account_type,
  account_status account_status,
  is_active boolean,
  has_gestao_integration boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    pa.id as account_id,
    pa.account_type,
    pa.account_status,
    pa.account_status = 'active' as is_active,
    pa.account_type IN ('pro', 'pro_gallery') as has_gestao_integration
  FROM public.photographer_accounts pa
  WHERE pa.user_id = _user_id;
$$;

-- Atualizar trigger handle_new_user_profile para criar conta automaticamente
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  
  -- STEP 2: Create photographer account (Gallery Solo by default)
  INSERT INTO public.photographer_accounts (user_id, account_type, account_status)
  VALUES (NEW.id, 'gallery_solo', 'active')
  ON CONFLICT (user_id) DO NOTHING;
  
  RAISE LOG 'Photographer account created for user: %', NEW.email;
  
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
  
  -- STEP 5: Get pro_monthly plan
  SELECT id INTO v_pro_plan_id FROM public.plans WHERE code = 'pro_monthly' LIMIT 1;
  
  IF v_pro_plan_id IS NULL THEN
    RAISE LOG 'WARNING: pro_monthly plan not found, cannot create trial for user: %', NEW.email;
    RETURN NEW;
  END IF;
  
  -- STEP 6: Create trial subscription (CRITICAL - use ON CONFLICT to handle edge cases)
  INSERT INTO public.subscriptions (
    user_id,
    plan_id,
    status,
    current_period_start,
    current_period_end,
    stripe_subscription_id,
    stripe_customer_id,
    cancel_at_period_end
  )
  VALUES (
    NEW.id,
    v_pro_plan_id,
    'trialing',
    now(),
    now() + INTERVAL '30 days',
    NULL,
    NULL,
    FALSE
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  RAISE LOG 'Trial subscription created for user: % with plan_id: %', NEW.email, v_pro_plan_id;
  
  RETURN NEW;
END;
$$;

-- Migrar usuários existentes que já têm profiles
INSERT INTO public.photographer_accounts (user_id, account_type, account_status)
SELECT 
  p.user_id,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM subscriptions s 
      JOIN plans pl ON pl.id = s.plan_id 
      WHERE s.user_id = p.user_id 
        AND s.status = 'active' 
        AND pl.code LIKE 'pro_galery%'
    ) THEN 'pro_gallery'::account_type
    WHEN EXISTS (
      SELECT 1 FROM subscriptions s 
      JOIN plans pl ON pl.id = s.plan_id 
      WHERE s.user_id = p.user_id 
        AND s.status = 'active' 
        AND pl.code LIKE 'pro%'
    ) THEN 'pro'::account_type
    WHEN EXISTS (
      SELECT 1 FROM subscriptions s 
      JOIN plans pl ON pl.id = s.plan_id 
      WHERE s.user_id = p.user_id 
        AND s.status = 'active' 
        AND pl.code LIKE 'starter%'
    ) THEN 'starter'::account_type
    ELSE 'gallery_solo'::account_type
  END,
  'active'::account_status
FROM profiles p
ON CONFLICT (user_id) DO NOTHING;