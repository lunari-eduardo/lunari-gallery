-- =====================================================
-- SISTEMA DE CRÉDITOS DE FOTO - MIGRAÇÃO
-- =====================================================

-- 1. Adicionar coluna photo_credits em photographer_accounts
ALTER TABLE public.photographer_accounts
ADD COLUMN IF NOT EXISTS photo_credits INTEGER NOT NULL DEFAULT 0;

-- 2. Criar tabela credit_ledger (histórico imutável de movimentações)
CREATE TABLE IF NOT EXISTS public.credit_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Tipo de movimentação
  operation_type TEXT NOT NULL CHECK (operation_type IN (
    'purchase',      -- Compra de créditos
    'bonus',         -- Bônus adicionado (admin)
    'upload',        -- Consumo por upload de foto
    'refund',        -- Estorno manual (excepcional)
    'adjustment'     -- Ajuste administrativo
  )),
  
  -- Valores (positivo = entrada, negativo = saída)
  amount INTEGER NOT NULL,
  
  -- Referências opcionais
  gallery_id UUID REFERENCES public.galerias(id) ON DELETE SET NULL,
  photo_id UUID REFERENCES public.galeria_fotos(id) ON DELETE SET NULL,
  
  -- Metadados
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Quem executou
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para credit_ledger
CREATE INDEX IF NOT EXISTS idx_credit_ledger_user ON credit_ledger(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_gallery ON credit_ledger(gallery_id) WHERE gallery_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_credit_ledger_photo ON credit_ledger(photo_id) WHERE photo_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_credit_ledger_type ON credit_ledger(operation_type);

-- 3. Criar tabela admin_credit_grants (registro de bônus do admin)
CREATE TABLE IF NOT EXISTS public.admin_credit_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_email TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  reason TEXT,
  granted_by UUID NOT NULL REFERENCES auth.users(id),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ledger_id UUID REFERENCES credit_ledger(id)
);

CREATE INDEX IF NOT EXISTS idx_admin_grants_target ON admin_credit_grants(target_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_grants_by ON admin_credit_grants(granted_by);

-- 4. Habilitar RLS
ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_credit_grants ENABLE ROW LEVEL SECURITY;

-- 5. Políticas RLS para credit_ledger
CREATE POLICY "Users can view their own credit history"
ON public.credit_ledger FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only system can insert credit entries"
ON public.credit_ledger FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- 6. Políticas RLS para admin_credit_grants
CREATE POLICY "Admins can view all grants"
ON public.admin_credit_grants FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert grants"
ON public.admin_credit_grants FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 7. Função: consume_photo_credits (consumo atômico)
CREATE OR REPLACE FUNCTION public.consume_photo_credits(
  _user_id UUID,
  _gallery_id UUID,
  _photo_count INTEGER DEFAULT 1
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_current_credits INTEGER;
BEGIN
  -- Admins bypass credit check
  SELECT public.has_role(_user_id, 'admin') INTO v_is_admin;
  IF v_is_admin THEN
    RETURN TRUE;
  END IF;
  
  -- Atomic check and deduct
  UPDATE photographer_accounts
  SET photo_credits = photo_credits - _photo_count,
      updated_at = now()
  WHERE user_id = _user_id
    AND photo_credits >= _photo_count
  RETURNING photo_credits INTO v_current_credits;
  
  IF NOT FOUND THEN
    RETURN FALSE;  -- Insufficient credits
  END IF;
  
  RETURN TRUE;
END;
$$;

-- 8. Função: record_photo_credit_usage (registra no ledger)
CREATE OR REPLACE FUNCTION public.record_photo_credit_usage(
  _user_id UUID,
  _gallery_id UUID,
  _photo_id UUID,
  _description TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ledger_id UUID;
  v_is_admin BOOLEAN;
BEGIN
  -- Check if admin (don't record for admins)
  SELECT public.has_role(_user_id, 'admin') INTO v_is_admin;
  IF v_is_admin THEN
    RETURN NULL;
  END IF;

  INSERT INTO credit_ledger (
    user_id,
    operation_type,
    amount,
    gallery_id,
    photo_id,
    description,
    created_by
  )
  VALUES (
    _user_id,
    'upload',
    -1,
    _gallery_id,
    _photo_id,
    COALESCE(_description, 'Upload de foto'),
    _user_id
  )
  RETURNING id INTO v_ledger_id;
  
  RETURN v_ledger_id;
END;
$$;

-- 9. Função: admin_grant_credits (admin adiciona créditos)
CREATE OR REPLACE FUNCTION public.admin_grant_credits(
  _target_user_id UUID,
  _amount INTEGER,
  _reason TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
  v_is_admin BOOLEAN;
  v_target_email TEXT;
  v_ledger_id UUID;
  v_grant_id UUID;
BEGIN
  -- Get caller ID
  v_admin_id := auth.uid();
  
  -- Verify caller is admin
  SELECT public.has_role(v_admin_id, 'admin') INTO v_is_admin;
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can grant credits';
  END IF;
  
  -- Get target email
  SELECT email INTO v_target_email FROM auth.users WHERE id = _target_user_id;
  IF v_target_email IS NULL THEN
    RAISE EXCEPTION 'Target user not found';
  END IF;
  
  -- Create ledger entry
  INSERT INTO credit_ledger (
    user_id,
    operation_type,
    amount,
    description,
    created_by
  )
  VALUES (
    _target_user_id,
    'bonus',
    _amount,
    COALESCE(_reason, 'Créditos adicionados pelo administrador'),
    v_admin_id
  )
  RETURNING id INTO v_ledger_id;
  
  -- Update balance
  UPDATE photographer_accounts
  SET photo_credits = photo_credits + _amount,
      updated_at = now()
  WHERE user_id = _target_user_id;
  
  -- If no account exists, create one
  IF NOT FOUND THEN
    INSERT INTO photographer_accounts (user_id, photo_credits)
    VALUES (_target_user_id, _amount);
  END IF;
  
  -- Record grant
  INSERT INTO admin_credit_grants (
    target_user_id,
    target_email,
    amount,
    reason,
    granted_by,
    ledger_id
  )
  VALUES (
    _target_user_id,
    v_target_email,
    _amount,
    _reason,
    v_admin_id,
    v_ledger_id
  )
  RETURNING id INTO v_grant_id;
  
  RETURN v_grant_id;
END;
$$;

-- 10. Função: get_photo_credit_balance (para validação)
CREATE OR REPLACE FUNCTION public.get_photo_credit_balance(_user_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(photo_credits, 0)
  FROM photographer_accounts
  WHERE user_id = _user_id;
$$;