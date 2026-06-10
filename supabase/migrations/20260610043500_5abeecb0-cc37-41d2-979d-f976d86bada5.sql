-- 1. Normalização de dados legados
UPDATE public.galerias 
SET venda_modo = CASE 
  WHEN venda_modo = 'view_only' THEN 'no_sale'
  WHEN venda_modo = 'selection' THEN 'sale_without_payment'
  WHEN venda_modo = 'sale' THEN 'sale_with_payment'
  ELSE COALESCE(venda_modo, 'sale_without_payment')
END
WHERE venda_modo IN ('view_only', 'selection', 'sale') OR venda_modo IS NULL;

-- 2. Garantir que o JSON saleSettings exista e esteja sincronizado para galerias ativas
UPDATE public.galerias
SET configuracoes = jsonb_set(
  COALESCE(configuracoes, '{}'::jsonb),
  '{saleSettings}',
  jsonb_build_object(
    'mode', venda_modo,
    'paymentMethod', venda_pagamento_provedor,
    'chargeType', COALESCE(venda_tipo_cobranca, 'only_extras')
  )
)
WHERE status != 'arquivado';

-- 3. Trigger para manter sincronizado o JSON -> Colunas
CREATE OR REPLACE FUNCTION public.sync_gallery_sale_settings()
RETURNS TRIGGER AS $$
BEGIN
  -- Se configuracoes mudou, sincronizar colunas planas
  IF NEW.configuracoes->'saleSettings' IS NOT NULL AND (OLD.configuracoes->'saleSettings' IS DISTINCT FROM NEW.configuracoes->'saleSettings') THEN
    NEW.venda_modo := NEW.configuracoes->'saleSettings'->>'mode';
    NEW.venda_pagamento_provedor := NEW.configuracoes->'saleSettings'->>'paymentMethod';
    NEW.venda_tipo_cobranca := NEW.configuracoes->'saleSettings'->>'chargeType';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_sync_gallery_sale_settings ON public.galerias;
CREATE TRIGGER tr_sync_gallery_sale_settings
BEFORE INSERT OR UPDATE OF configuracoes ON public.galerias
FOR EACH ROW EXECUTE FUNCTION public.sync_gallery_sale_settings();