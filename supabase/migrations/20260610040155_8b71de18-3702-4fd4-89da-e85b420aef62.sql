-- Normalize and sync venda_* columns with configuracoes.saleSettings
-- Fix inconsistencies caused by stale defaults or divergent updates

-- 1. Normalize existing galerias where JSON and columns diverge
UPDATE public.galerias
SET 
  venda_modo = CASE 
    WHEN configuracoes IS NOT NULL AND configuracoes->>'saleSettings' IS NOT NULL
    THEN (configuracoes->'saleSettings'->>'mode')
    WHEN venda_modo NOT IN ('no_sale', 'sale_with_payment', 'sale_without_payment')
    THEN 'sale_without_payment'
    ELSE venda_modo
  END,
  venda_pagamento_provedor = CASE 
    WHEN configuracoes IS NOT NULL AND configuracoes->>'saleSettings' IS NOT NULL
    THEN (configuracoes->'saleSettings'->>'paymentMethod')
    ELSE venda_pagamento_provedor
  END,
  venda_tipo_cobranca = CASE 
    WHEN configuracoes IS NOT NULL AND configuracoes->>'saleSettings' IS NOT NULL
    THEN (configuracoes->'saleSettings'->>'chargeType')
    ELSE venda_tipo_cobranca
  END,
  updated_at = NOW()
WHERE 
  venda_modo != (CASE 
    WHEN configuracoes IS NOT NULL AND configuracoes->>'saleSettings' IS NOT NULL
    THEN (configuracoes->'saleSettings'->>'mode')
    ELSE venda_modo
  END)
  OR venda_pagamento_provedor != (CASE 
    WHEN configuracoes IS NOT NULL AND configuracoes->>'saleSettings' IS NOT NULL
    THEN (configuracoes->'saleSettings'->>'paymentMethod')
    ELSE venda_pagamento_provedor
  END)
  OR venda_tipo_cobranca != (CASE 
    WHEN configuracoes IS NOT NULL AND configuracoes->>'saleSettings' IS NOT NULL
    THEN (configuracoes->'saleSettings'->>'chargeType')
    ELSE venda_tipo_cobranca
  END);

-- 2. Create trigger to keep venda_* in sync with configuracoes.saleSettings on update
CREATE OR REPLACE FUNCTION public.sync_venda_columns_with_json()
RETURNS TRIGGER AS $$
BEGIN
  -- Only sync if configuracoes changed and saleSettings exists
  IF NEW.configuracoes IS DISTINCT FROM OLD.configuracoes THEN
    NEW.venda_modo = COALESCE(
      (NEW.configuracoes->'saleSettings'->>'mode'),
      NEW.venda_modo
    );
    NEW.venda_pagamento_provedor = COALESCE(
      (NEW.configuracoes->'saleSettings'->>'paymentMethod'),
      NEW.venda_pagamento_provedor
    );
    NEW.venda_tipo_cobranca = COALESCE(
      (NEW.configuracoes->'saleSettings'->>'chargeType'),
      NEW.venda_tipo_cobranca
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trg_sync_venda_columns ON public.galerias;

-- Create trigger to sync venda_* columns when configuracoes changes
CREATE TRIGGER trg_sync_venda_columns
BEFORE UPDATE ON public.galerias
FOR EACH ROW
EXECUTE FUNCTION public.sync_venda_columns_with_json();

-- 3. Change default for venda_modo to match current contract
ALTER TABLE public.galerias
  ALTER COLUMN venda_modo SET DEFAULT 'sale_without_payment';
