
-- =============================================================================
-- Sale mode: fonte de verdade única (colunas) + sync bidirecional com JSON
-- =============================================================================
-- Problema: `galerias.configuracoes.saleSettings.mode` (JSON legado) e as colunas
-- canônicas `venda_modo`/`venda_pagamento_provedor`/`venda_tipo_cobranca`
-- podem divergir. Isso quebra o frontend do cliente (default silencioso para
-- `sale_without_payment` esconde o botão "Confirmar e Pagar", causa redirecionamento
-- errado e finaliza galeria como "concluída" mesmo com pagamento pendente).
--
-- Solução: trigger AFTER UPDATE/INSERT que espelha as colunas → JSON.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sync_gallery_sale_settings_json()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_config jsonb;
  v_sale  jsonb;
BEGIN
  -- Se nenhuma coluna canônica tem valor, não mexe no JSON.
  IF NEW.venda_modo IS NULL
     AND NEW.venda_pagamento_provedor IS NULL
     AND NEW.venda_tipo_cobranca IS NULL THEN
    RETURN NEW;
  END IF;

  v_config := COALESCE(NEW.configuracoes, '{}'::jsonb);
  v_sale := COALESCE(v_config->'saleSettings', '{}'::jsonb);

  IF NEW.venda_modo IS NOT NULL THEN
    v_sale := jsonb_set(v_sale, '{mode}', to_jsonb(NEW.venda_modo::text), true);
  END IF;
  IF NEW.venda_pagamento_provedor IS NOT NULL THEN
    v_sale := jsonb_set(v_sale, '{paymentMethod}', to_jsonb(NEW.venda_pagamento_provedor::text), true);
  END IF;
  IF NEW.venda_tipo_cobranca IS NOT NULL THEN
    v_sale := jsonb_set(v_sale, '{chargeType}', to_jsonb(NEW.venda_tipo_cobranca::text), true);
  END IF;

  v_config := jsonb_set(v_config, '{saleSettings}', v_sale, true);
  NEW.configuracoes := v_config;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_sync_gallery_sale_settings_json ON public.galerias;
CREATE TRIGGER tg_sync_gallery_sale_settings_json
BEFORE INSERT OR UPDATE OF venda_modo, venda_pagamento_provedor, venda_tipo_cobranca, configuracoes ON public.galerias
FOR EACH ROW
EXECUTE FUNCTION public.sync_gallery_sale_settings_json();

-- Backfill idempotente: reconcilia todas as galerias existentes onde o JSON diverge
-- das colunas (ou onde o JSON não tem `mode`/`paymentMethod`/`chargeType`).
UPDATE public.galerias g
   SET configuracoes = jsonb_set(
         jsonb_set(
           jsonb_set(
             COALESCE(g.configuracoes, '{}'::jsonb),
             '{saleSettings,mode}',
             to_jsonb(COALESCE(g.venda_modo, (g.configuracoes->'saleSettings'->>'mode'), 'no_sale')),
             true
           ),
           '{saleSettings,paymentMethod}',
           to_jsonb(COALESCE(g.venda_pagamento_provedor, (g.configuracoes->'saleSettings'->>'paymentMethod'))),
           true
         ),
         '{saleSettings,chargeType}',
         to_jsonb(COALESCE(g.venda_tipo_cobranca, (g.configuracoes->'saleSettings'->>'chargeType'), 'only_extras')),
         true
       )
 WHERE (g.venda_modo IS NOT NULL AND (g.configuracoes->'saleSettings'->>'mode') IS DISTINCT FROM g.venda_modo)
    OR (g.venda_pagamento_provedor IS NOT NULL AND (g.configuracoes->'saleSettings'->>'paymentMethod') IS DISTINCT FROM g.venda_pagamento_provedor)
    OR (g.venda_tipo_cobranca IS NOT NULL AND (g.configuracoes->'saleSettings'->>'chargeType') IS DISTINCT FROM g.venda_tipo_cobranca);
