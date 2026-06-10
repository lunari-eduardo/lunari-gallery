-- 1. Corrigir dados inconsistentes baseados no JSON
UPDATE public.galerias 
SET 
  venda_modo = COALESCE((configuracoes->'saleSettings'->>'mode'), 'sale_without_payment'),
  venda_pagamento_provedor = (configuracoes->'saleSettings'->>'paymentMethod'),
  venda_tipo_cobranca = COALESCE((configuracoes->'saleSettings'->>'chargeType'), 'only_extras')
WHERE 
  venda_modo = 'view_only' 
  OR venda_modo IS NULL;

-- 2. Ajustar default da coluna para evitar 'view_only' (valor legado/inválido)
ALTER TABLE public.galerias ALTER COLUMN venda_modo SET DEFAULT 'sale_without_payment';

-- 3. Função de sincronização JSON -> Colunas
CREATE OR REPLACE FUNCTION public.sync_gallery_sale_columns()
RETURNS TRIGGER AS $$
BEGIN
  -- Se o JSON de configurações mudou ou é novo
  IF (TG_OP = 'INSERT' AND NEW.configuracoes IS NOT NULL) OR 
     (TG_OP = 'UPDATE' AND OLD.configuracoes IS DISTINCT FROM NEW.configuracoes) THEN
    
    -- Sincroniza se existir saleSettings no JSON
    IF NEW.configuracoes->'saleSettings' IS NOT NULL THEN
      NEW.venda_modo := COALESCE(NEW.configuracoes->'saleSettings'->>'mode', NEW.venda_modo);
      NEW.venda_pagamento_provedor := COALESCE(NEW.configuracoes->'saleSettings'->>'paymentMethod', NEW.venda_pagamento_provedor);
      NEW.venda_tipo_cobranca := COALESCE(NEW.configuracoes->'saleSettings'->>'chargeType', NEW.venda_tipo_cobranca);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Criar Trigger
DROP TRIGGER IF EXISTS trg_sync_gallery_sale_columns ON public.galerias;
CREATE TRIGGER trg_sync_gallery_sale_columns
BEFORE INSERT OR UPDATE ON public.galerias
FOR EACH ROW
EXECUTE FUNCTION public.sync_gallery_sale_columns();