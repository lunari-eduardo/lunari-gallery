
-- ============================================================
-- 1) Conserto definitivo do trigger trigger_finalize_payment_on_status_change
--    Bug: referenciava NEW.observacoes (coluna inexistente).
--    Correto: NEW.obs_manual.
--    Também adicionamos log estruturado em audit_log para
--    eliminar a falha silenciosa que mascarou esse bug.
-- ============================================================
CREATE OR REPLACE FUNCTION public.trigger_finalize_payment_on_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.status IN ('pago','pago_manual')
     AND (OLD.status IS NULL OR OLD.status NOT IN ('pago','pago_manual'))
     AND NEW.galeria_id IS NOT NULL
     AND NEW.extras_contabilizados IS NOT TRUE
  THEN
    BEGIN
      PERFORM public.finalize_gallery_payment(
        NEW.id,
        NEW.ip_receipt_url,
        NEW.data_pagamento,
        NEW.metodo_manual,
        NEW.obs_manual
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'auto-finalize falhou para cobranca %: % (SQLSTATE %)', NEW.id, SQLERRM, SQLSTATE;
      BEGIN
        INSERT INTO public.audit_log(action, resource_type, resource_id, gallery_id, metadata)
        VALUES (
          'auto_finalize_failed',
          'cobranca',
          NEW.id,
          NEW.galeria_id,
          jsonb_build_object(
            'error', SQLERRM,
            'sqlstate', SQLSTATE,
            'status_old', OLD.status,
            'status_new', NEW.status,
            'provedor', NEW.provedor
          )
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'falha ao gravar audit_log de auto_finalize_failed: %', SQLERRM;
      END;
    END;
  END IF;
  RETURN NEW;
END;
$function$;

-- ============================================================
-- 2) Job de reconciliação periódica (defesa em profundidade)
--    Detecta cobranças pagas com galeria vinculada mas
--    sem extras contabilizados e dispara o RPC.
-- ============================================================
CREATE OR REPLACE FUNCTION public.reconcile_orphan_paid_gallery_charges()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_cob RECORD;
  v_processed INT := 0;
  v_errors INT := 0;
  v_details JSONB := '[]'::jsonb;
BEGIN
  FOR v_cob IN
    SELECT id, ip_receipt_url, data_pagamento, galeria_id, status
    FROM public.cobrancas
    WHERE status IN ('pago','pago_manual')
      AND galeria_id IS NOT NULL
      AND extras_contabilizados IS NOT TRUE
      AND updated_at > now() - interval '14 days'
    ORDER BY updated_at DESC
    LIMIT 100
  LOOP
    BEGIN
      PERFORM public.finalize_gallery_payment(
        v_cob.id,
        v_cob.ip_receipt_url,
        COALESCE(v_cob.data_pagamento, now())
      );
      v_processed := v_processed + 1;
      v_details := v_details || jsonb_build_object(
        'cobranca_id', v_cob.id,
        'galeria_id', v_cob.galeria_id,
        'status', 'reconciled'
      );
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
      v_details := v_details || jsonb_build_object(
        'cobranca_id', v_cob.id,
        'galeria_id', v_cob.galeria_id,
        'status', 'error',
        'error', SQLERRM
      );
    END;
  END LOOP;

  IF v_processed > 0 OR v_errors > 0 THEN
    INSERT INTO public.audit_log(action, resource_type, resource_id, metadata)
    VALUES (
      'reconcile_orphan_paid_gallery_charges',
      'system',
      gen_random_uuid(),
      jsonb_build_object(
        'processed', v_processed,
        'errors', v_errors,
        'details', v_details,
        'ran_at', now()
      )
    );
  END IF;

  RETURN jsonb_build_object('processed', v_processed, 'errors', v_errors, 'details', v_details);
END;
$function$;

-- ============================================================
-- 3) Agendamento via pg_cron — roda a cada 15 minutos
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  -- Remove agendamento anterior se existir (idempotência)
  PERFORM cron.unschedule('reconcile-orphan-paid-gallery-charges')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'reconcile-orphan-paid-gallery-charges');
END $$;

SELECT cron.schedule(
  'reconcile-orphan-paid-gallery-charges',
  '*/15 * * * *',
  $$SELECT public.reconcile_orphan_paid_gallery_charges();$$
);

-- ============================================================
-- 4) Data fix retroativo — Cecília - Newborn
-- ============================================================
SELECT public.finalize_gallery_payment(
  'b5b07364-0f08-4716-86d7-72620b707f55'::uuid,
  NULL,
  '2026-06-22 13:34:25.729+00'::timestamptz
);
