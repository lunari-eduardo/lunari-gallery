-- ============================================================
-- 1. Corrigir as 2 galerias dessincronizadas via RPC
-- ============================================================
SELECT finalize_gallery_payment('dc7c8539-3c47-477c-9a24-bde150c3d791', NULL, NOW());
SELECT finalize_gallery_payment('f289469f-901d-4a13-95f0-c9977da648e6', NULL, NOW());

-- ============================================================
-- 2. Trigger de segurança: sync_gallery_on_cobranca_paid
-- ============================================================
CREATE OR REPLACE FUNCTION sync_gallery_on_cobranca_paid()
RETURNS TRIGGER AS $$
DECLARE
  v_galeria_id uuid;
  v_session_id text;
BEGIN
  IF NEW.status NOT IN ('pago', 'pago_manual') THEN
    RETURN NEW;
  END IF;
  IF OLD.status IN ('pago', 'pago_manual') THEN
    RETURN NEW;
  END IF;

  v_galeria_id := NEW.galeria_id;
  v_session_id := NEW.session_id;

  IF v_galeria_id IS NULL AND v_session_id IS NOT NULL THEN
    SELECT id INTO v_galeria_id
    FROM galerias
    WHERE session_id = v_session_id
    LIMIT 1;
    IF v_galeria_id IS NOT NULL THEN
      NEW.galeria_id := v_galeria_id;
    END IF;
  END IF;

  IF v_galeria_id IS NOT NULL THEN
    UPDATE galerias
    SET status_pagamento = NEW.status,
        status_selecao = 'selecao_completa',
        finalized_at = COALESCE(finalized_at, NEW.data_pagamento, NOW()),
        updated_at = NOW()
    WHERE id = v_galeria_id
      AND status_pagamento NOT IN ('pago', 'pago_manual');

    IF v_session_id IS NOT NULL THEN
      UPDATE clientes_sessoes
      SET status_galeria = 'selecao_completa',
          status_pagamento_fotos_extra = 'pago',
          updated_at = NOW()
      WHERE session_id = v_session_id
        AND status_pagamento_fotos_extra NOT IN ('pago');
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_gallery_on_cobranca_paid ON cobrancas;
CREATE TRIGGER trg_sync_gallery_on_cobranca_paid
  BEFORE UPDATE ON cobrancas
  FOR EACH ROW
  EXECUTE FUNCTION sync_gallery_on_cobranca_paid();