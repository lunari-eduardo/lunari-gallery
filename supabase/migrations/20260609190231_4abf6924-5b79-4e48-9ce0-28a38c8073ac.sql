-- Add explicit columns for sale settings to decouple from JSON configuracoes
ALTER TABLE public.galerias 
ADD COLUMN IF NOT EXISTS venda_modo TEXT DEFAULT 'view_only',
ADD COLUMN IF NOT EXISTS venda_pagamento_provedor TEXT,
ADD COLUMN IF NOT EXISTS venda_tipo_cobranca TEXT DEFAULT 'only_extras';

-- Grant permissions
GRANT SELECT, UPDATE ON public.galerias TO authenticated;
GRANT ALL ON public.galerias TO service_role;

-- Backfill data from existing JSON configuracoes if possible
UPDATE public.galerias 
SET 
  venda_modo = COALESCE((configuracoes->'saleSettings'->>'mode'), 'view_only'),
  venda_pagamento_provedor = (configuracoes->'saleSettings'->>'paymentMethod'),
  venda_tipo_cobranca = COALESCE((configuracoes->'saleSettings'->>'chargeType'), 'only_extras')
WHERE configuracoes IS NOT NULL;
