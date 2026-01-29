-- =============================================
-- MERCADO PAGO CHECKOUT TRANSPARENTE - CRÉDITOS
-- =============================================

-- Tabela de pacotes de créditos disponíveis para compra
CREATE TABLE public.gallery_credit_packages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  credits INTEGER NOT NULL,
  price_cents INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Inserir pacotes iniciais
INSERT INTO public.gallery_credit_packages (credits, price_cents, name, description, sort_order) VALUES
  (2000, 1900, 'Starter', '2.000 créditos', 1),
  (5000, 3900, 'Basic', '5.000 créditos', 2),
  (10000, 6900, 'Pro', '10.000 créditos', 3),
  (20000, 9900, 'Enterprise', '20.000 créditos', 4);

-- Tabela de histórico de compras de créditos
CREATE TABLE public.credit_purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  package_id UUID REFERENCES public.gallery_credit_packages(id),
  credits_amount INTEGER NOT NULL,
  price_cents INTEGER NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('pix', 'credit_card')),
  mp_payment_id TEXT,
  mp_status TEXT NOT NULL DEFAULT 'pending',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled', 'refunded')),
  pix_qr_code TEXT,
  pix_qr_code_base64 TEXT,
  pix_copia_cola TEXT,
  pix_expiration TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  paid_at TIMESTAMP WITH TIME ZONE,
  ledger_id UUID REFERENCES public.credit_ledger(id),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Índices para performance
CREATE INDEX idx_credit_purchases_user_id ON public.credit_purchases(user_id);
CREATE INDEX idx_credit_purchases_mp_payment_id ON public.credit_purchases(mp_payment_id);
CREATE INDEX idx_credit_purchases_status ON public.credit_purchases(status);

-- RLS para gallery_credit_packages (leitura pública para usuários autenticados)
ALTER TABLE public.gallery_credit_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view active packages"
  ON public.gallery_credit_packages
  FOR SELECT
  USING (active = true);

CREATE POLICY "Admins can manage packages"
  ON public.gallery_credit_packages
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- RLS para credit_purchases
ALTER TABLE public.credit_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own purchases"
  ON public.credit_purchases
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own purchases"
  ON public.credit_purchases
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "System can update purchases"
  ON public.credit_purchases
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admins can manage all purchases"
  ON public.credit_purchases
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- RPC para adicionar créditos após pagamento confirmado
CREATE OR REPLACE FUNCTION public.purchase_credits(
  _user_id UUID,
  _amount INTEGER,
  _purchase_id UUID,
  _description TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ledger_id UUID;
BEGIN
  -- Verificar se a compra existe e está pendente
  IF NOT EXISTS (
    SELECT 1 FROM credit_purchases 
    WHERE id = _purchase_id AND user_id = _user_id AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'Compra não encontrada ou já processada';
  END IF;

  -- Registrar no ledger
  INSERT INTO credit_ledger (user_id, operation_type, amount, description, metadata)
  VALUES (
    _user_id, 
    'purchase', 
    _amount, 
    COALESCE(_description, 'Compra de créditos via Mercado Pago'), 
    jsonb_build_object('purchase_id', _purchase_id)
  )
  RETURNING id INTO v_ledger_id;
  
  -- Atualizar saldo na conta do fotógrafo
  UPDATE photographer_accounts
  SET photo_credits = photo_credits + _amount, updated_at = now()
  WHERE user_id = _user_id;
  
  -- Criar conta se não existir
  IF NOT FOUND THEN
    INSERT INTO photographer_accounts (user_id, photo_credits)
    VALUES (_user_id, _amount);
  END IF;
  
  -- Atualizar compra com referência ao ledger
  UPDATE credit_purchases
  SET ledger_id = v_ledger_id, status = 'approved', paid_at = now()
  WHERE id = _purchase_id;
  
  RETURN v_ledger_id;
END;
$$;