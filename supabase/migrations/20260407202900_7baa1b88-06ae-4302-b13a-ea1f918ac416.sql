
-- Fix finalize_gallery_payment: sync gallery when parcelas already resolved payment
CREATE OR REPLACE FUNCTION public.finalize_gallery_payment(
  p_cobranca_id uuid,
  p_receipt_url text DEFAULT NULL,
  p_paid_at timestamptz DEFAULT now(),
  p_manual_method text DEFAULT NULL,
  p_manual_obs text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cobranca RECORD;
  v_galeria_id UUID;
  v_gallery_synced BOOLEAN := false;
  v_final_status TEXT;
  v_has_parcelas BOOLEAN;
  v_current_status TEXT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_cobranca_id::text));

  SELECT * INTO v_cobranca
  FROM public.cobrancas
  WHERE id = p_cobranca_id
  FOR UPDATE;

  IF v_cobranca IS NULL THEN
    RETURN jsonb_build_object('success', false, 'already_paid', false, 'error', 'Cobranca nao encontrada');
  END IF;

  v_final_status := CASE WHEN p_manual_method IS NOT NULL THEN 'pago_manual' ELSE 'pago' END;

  v_galeria_id := v_cobranca.galeria_id;
  IF v_galeria_id IS NULL AND v_cobranca.session_id IS NOT NULL THEN
    SELECT id INTO v_galeria_id
    FROM public.galerias
    WHERE session_id = v_cobranca.session_id
    LIMIT 1;
    IF v_galeria_id IS NOT NULL THEN
      UPDATE public.cobrancas SET galeria_id = v_galeria_id WHERE id = p_cobranca_id;
    END IF;
  END IF;

  -- Already paid: just sync gallery if needed
  IF v_cobranca.status IN ('pago', 'pago_manual') THEN
    IF v_galeria_id IS NOT NULL THEN
      PERFORM 1 FROM public.galerias
      WHERE id = v_galeria_id AND status_pagamento NOT IN ('pago', 'pago_manual');
      IF FOUND THEN
        UPDATE public.galerias
        SET total_fotos_extras_vendidas = COALESCE(total_fotos_extras_vendidas, 0) + COALESCE(v_cobranca.qtd_fotos, 0),
            valor_total_vendido = COALESCE(valor_total_vendido, 0) + COALESCE(v_cobranca.valor, 0),
            status_pagamento = v_cobranca.status, status_selecao = 'selecao_completa',
            finalized_at = COALESCE(finalized_at, v_cobranca.data_pagamento, now()),
            updated_at = now()
        WHERE id = v_galeria_id;
        IF v_cobranca.session_id IS NOT NULL THEN
          UPDATE public.clientes_sessoes
          SET qtd_fotos_extra = COALESCE(
                (SELECT total_fotos_extras_vendidas FROM public.galerias WHERE id = v_galeria_id), 0),
              valor_total_foto_extra = COALESCE(
                (SELECT valor_total_vendido FROM public.galerias WHERE id = v_galeria_id), 0),
              status_galeria = 'selecao_completa',
              status_pagamento_fotos_extra = v_cobranca.status,
              updated_at = now()
          WHERE session_id = v_cobranca.session_id;
        END IF;
        v_gallery_synced := true;
      END IF;
    END IF;
    RETURN jsonb_build_object('success', true, 'already_paid', true,
      'gallery_synced', v_gallery_synced, 'galeria_id', v_galeria_id);
  END IF;

  -- For Asaas payments: check if parcelas exist already
  IF v_cobranca.provedor = 'asaas' AND v_cobranca.mp_payment_id IS NOT NULL AND p_manual_method IS NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM public.cobranca_parcelas WHERE cobranca_id = p_cobranca_id
    ) INTO v_has_parcelas;

    IF v_has_parcelas THEN
      -- Re-read cobranca status (trigger may have updated it to 'pago')
      SELECT status INTO v_current_status FROM public.cobrancas WHERE id = p_cobranca_id;

      IF v_current_status IN ('pago', 'pago_manual') THEN
        -- Trigger already marked as paid, sync gallery now
        IF v_galeria_id IS NOT NULL THEN
          UPDATE public.galerias
          SET total_fotos_extras_vendidas = COALESCE(total_fotos_extras_vendidas, 0) + COALESCE(v_cobranca.qtd_fotos, 0),
              valor_total_vendido = COALESCE(valor_total_vendido, 0) + COALESCE(v_cobranca.valor, 0),
              status_pagamento = v_current_status, status_selecao = 'selecao_completa',
              finalized_at = COALESCE(finalized_at, now()), updated_at = now()
          WHERE id = v_galeria_id
            AND status_pagamento NOT IN ('pago', 'pago_manual');

          IF v_cobranca.session_id IS NOT NULL THEN
            UPDATE public.clientes_sessoes
            SET qtd_fotos_extra = COALESCE(
                  (SELECT total_fotos_extras_vendidas FROM public.galerias WHERE id = v_galeria_id), 0),
                valor_total_foto_extra = COALESCE(
                  (SELECT valor_total_vendido FROM public.galerias WHERE id = v_galeria_id), 0),
                status_galeria = 'selecao_completa',
                status_pagamento_fotos_extra = v_current_status,
                updated_at = now()
            WHERE session_id = v_cobranca.session_id;
          END IF;
        END IF;

        RETURN jsonb_build_object('success', true, 'already_paid', false,
          'delegated_to_parcelas', true, 'parcelas_resolved', true,
          'cobranca_id', p_cobranca_id, 'galeria_id', v_galeria_id);
      END IF;

      -- Parcelas exist but not yet fully paid
      RETURN jsonb_build_object('success', true, 'already_paid', false,
        'delegated_to_parcelas', true, 'parcelas_resolved', false,
        'cobranca_id', p_cobranca_id, 'galeria_id', v_galeria_id);
    END IF;
  END IF;

  -- Mark as paid
  UPDATE public.cobrancas
  SET status = v_final_status, data_pagamento = p_paid_at,
      ip_receipt_url = COALESCE(p_receipt_url, ip_receipt_url),
      metodo_manual = COALESCE(p_manual_method, metodo_manual),
      obs_manual = COALESCE(p_manual_obs, obs_manual),
      updated_at = now()
  WHERE id = p_cobranca_id AND status NOT IN ('pago', 'pago_manual');

  IF v_galeria_id IS NOT NULL THEN
    UPDATE public.galerias
    SET total_fotos_extras_vendidas = COALESCE(total_fotos_extras_vendidas, 0) + COALESCE(v_cobranca.qtd_fotos, 0),
        valor_total_vendido = COALESCE(valor_total_vendido, 0) + COALESCE(v_cobranca.valor, 0),
        status_pagamento = v_final_status, status_selecao = 'selecao_completa',
        finalized_at = p_paid_at, updated_at = now()
    WHERE id = v_galeria_id;
  END IF;

  IF v_cobranca.session_id IS NOT NULL THEN
    UPDATE public.clientes_sessoes
    SET qtd_fotos_extra = COALESCE(
          (SELECT total_fotos_extras_vendidas FROM public.galerias WHERE id = v_galeria_id), 0),
        valor_total_foto_extra = COALESCE(
          (SELECT valor_total_vendido FROM public.galerias WHERE id = v_galeria_id), 0),
        status_galeria = 'selecao_completa',
        status_pagamento_fotos_extra = v_final_status,
        updated_at = now()
    WHERE session_id = v_cobranca.session_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'already_paid', false,
    'cobranca_id', p_cobranca_id, 'galeria_id', v_galeria_id,
    'session_id', v_cobranca.session_id, 'valor', v_cobranca.valor, 'qtd_fotos', v_cobranca.qtd_fotos,
    'needs_fee_reconciliation', (v_cobranca.provedor = 'asaas' AND v_cobranca.mp_payment_id IS NOT NULL AND p_manual_method IS NULL));
END;
$function$;

-- Backfill: fix gallery 294ab43c that was left with zeroed values
UPDATE galerias
SET total_fotos_extras_vendidas = 2, valor_total_vendido = 50
WHERE id = '294ab43c-5078-4ff5-92d9-4649cc5933a1'
  AND (total_fotos_extras_vendidas IS NULL OR total_fotos_extras_vendidas = 0);
