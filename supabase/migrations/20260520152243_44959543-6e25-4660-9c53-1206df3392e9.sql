
-- 1) Update RPC: set provedor='manual' on first-time manual finalization (Branch 3)
CREATE OR REPLACE FUNCTION public.finalize_gallery_payment(
  p_cobranca_id uuid,
  p_receipt_url text DEFAULT NULL::text,
  p_paid_at timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_manual_method text DEFAULT NULL::text,
  p_manual_obs text DEFAULT NULL::text
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
  v_inferred_qtd INT;
  v_match TEXT[];
  v_valor_unit NUMERIC;
  v_sum_qtd INT;
  v_sum_val NUMERIC;
  v_new_provedor TEXT;
  v_obs_prefix TEXT;
  v_merged_obs TEXT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_cobranca_id::text));

  SELECT * INTO v_cobranca FROM public.cobrancas WHERE id = p_cobranca_id FOR UPDATE;
  IF v_cobranca IS NULL THEN
    RETURN jsonb_build_object('success', false, 'already_paid', false, 'error', 'Cobranca nao encontrada');
  END IF;

  v_final_status := CASE WHEN p_manual_method IS NOT NULL THEN 'pago_manual' ELSE 'pago' END;

  v_galeria_id := v_cobranca.galeria_id;
  IF v_galeria_id IS NULL AND v_cobranca.session_id IS NOT NULL THEN
    SELECT id INTO v_galeria_id FROM public.galerias WHERE session_id = v_cobranca.session_id LIMIT 1;
    IF v_galeria_id IS NOT NULL THEN
      UPDATE public.cobrancas SET galeria_id = v_galeria_id WHERE id = p_cobranca_id;
      v_cobranca.galeria_id := v_galeria_id;
    END IF;
  END IF;

  -- Inferência defensiva de qtd_fotos
  IF COALESCE(v_cobranca.qtd_fotos, 0) = 0 AND v_galeria_id IS NOT NULL AND v_cobranca.valor > 0 THEN
    v_inferred_qtd := NULL;
    IF v_cobranca.descricao IS NOT NULL THEN
      v_match := regexp_match(v_cobranca.descricao, '(\d+)\s*foto', 'i');
      IF v_match IS NOT NULL THEN v_inferred_qtd := (v_match[1])::INT; END IF;
    END IF;
    IF v_inferred_qtd IS NULL OR v_inferred_qtd = 0 THEN
      SELECT NULLIF(valor_foto_extra, 0) INTO v_valor_unit FROM public.galerias WHERE id = v_galeria_id;
      IF v_valor_unit IS NOT NULL AND v_valor_unit > 0 THEN
        v_inferred_qtd := ROUND(v_cobranca.valor / v_valor_unit)::INT;
      END IF;
    END IF;
    IF v_inferred_qtd IS NOT NULL AND v_inferred_qtd > 0 THEN
      UPDATE public.cobrancas SET qtd_fotos = v_inferred_qtd, updated_at = now() WHERE id = p_cobranca_id;
      v_cobranca.qtd_fotos := v_inferred_qtd;
    END IF;
  END IF;

  -- BRANCH 1: já paga
  IF v_cobranca.status IN ('pago','pago_manual') THEN
    IF v_galeria_id IS NOT NULL THEN
      SELECT GREATEST(COALESCE(g.fotos_selecionadas,0) - COALESCE(g.fotos_incluidas,0), 0)
      INTO v_sum_qtd FROM public.galerias g WHERE g.id = v_galeria_id;

      SELECT COALESCE(SUM(valor),0)::numeric INTO v_sum_val
      FROM public.cobrancas
      WHERE galeria_id = v_galeria_id
        AND status IN ('pago','pago_manual')
        AND tipo_cobranca IN ('foto_extra','link','venda_galeria','card','pix');

      UPDATE public.galerias
      SET total_fotos_extras_vendidas = v_sum_qtd,
          valor_total_vendido = v_sum_val,
          status_pagamento = v_cobranca.status,
          status_selecao = 'selecao_completa',
          finalized_at = COALESCE(finalized_at, v_cobranca.data_pagamento, now()),
          updated_at = now()
      WHERE id = v_galeria_id;

      IF v_cobranca.session_id IS NOT NULL THEN
        UPDATE public.clientes_sessoes
        SET qtd_fotos_extra = v_sum_qtd,
            valor_total_foto_extra = v_sum_val,
            status_galeria = 'selecao_completa',
            status_pagamento_fotos_extra = v_cobranca.status,
            updated_at = now()
        WHERE session_id = v_cobranca.session_id;
      END IF;

      UPDATE public.cobrancas SET extras_contabilizados = true
      WHERE id = p_cobranca_id AND extras_contabilizados IS NOT TRUE;

      v_gallery_synced := true;
    END IF;

    IF v_cobranca.visitor_id IS NOT NULL THEN
      UPDATE public.galeria_visitantes
      SET status = 'finalizado', status_selecao = 'selecao_completa',
          finalized_at = COALESCE(v_cobranca.data_pagamento, now()), updated_at = now()
      WHERE id = v_cobranca.visitor_id AND status != 'finalizado';
    END IF;

    RETURN jsonb_build_object('success', true, 'already_paid', true,
      'gallery_synced', v_gallery_synced, 'galeria_id', v_galeria_id);
  END IF;

  -- BRANCH 2: Asaas com parcelas
  IF v_cobranca.provedor = 'asaas' AND v_cobranca.mp_payment_id IS NOT NULL AND p_manual_method IS NULL THEN
    SELECT EXISTS(SELECT 1 FROM public.cobranca_parcelas WHERE cobranca_id = p_cobranca_id) INTO v_has_parcelas;
    IF v_has_parcelas THEN
      SELECT status INTO v_current_status FROM public.cobrancas WHERE id = p_cobranca_id;
      IF v_current_status IN ('pago','pago_manual') AND v_galeria_id IS NOT NULL THEN
        SELECT GREATEST(COALESCE(g.fotos_selecionadas,0) - COALESCE(g.fotos_incluidas,0), 0)
        INTO v_sum_qtd FROM public.galerias g WHERE g.id = v_galeria_id;

        SELECT COALESCE(SUM(valor),0)::numeric INTO v_sum_val
        FROM public.cobrancas
        WHERE galeria_id = v_galeria_id
          AND status IN ('pago','pago_manual')
          AND tipo_cobranca IN ('foto_extra','link','venda_galeria','card','pix');

        UPDATE public.galerias
        SET total_fotos_extras_vendidas = v_sum_qtd,
            valor_total_vendido = v_sum_val,
            status_pagamento = v_current_status,
            status_selecao = 'selecao_completa',
            finalized_at = COALESCE(finalized_at, v_cobranca.data_pagamento, now()),
            updated_at = now()
        WHERE id = v_galeria_id;

        IF v_cobranca.session_id IS NOT NULL THEN
          UPDATE public.clientes_sessoes
          SET qtd_fotos_extra = v_sum_qtd, valor_total_foto_extra = v_sum_val,
              status_galeria = 'selecao_completa', status_pagamento_fotos_extra = v_current_status,
              updated_at = now()
          WHERE session_id = v_cobranca.session_id;
        END IF;

        UPDATE public.cobrancas SET extras_contabilizados = true
        WHERE id = p_cobranca_id AND extras_contabilizados IS NOT TRUE;
        v_gallery_synced := true;

        IF v_cobranca.visitor_id IS NOT NULL THEN
          UPDATE public.galeria_visitantes
          SET status = 'finalizado', status_selecao = 'selecao_completa',
              finalized_at = COALESCE(v_cobranca.data_pagamento, now()), updated_at = now()
          WHERE id = v_cobranca.visitor_id AND status != 'finalizado';
        END IF;
      END IF;
      RETURN jsonb_build_object('success', true, 'already_paid', false,
        'has_parcelas', true, 'current_status', v_current_status,
        'gallery_synced', v_gallery_synced, 'galeria_id', v_galeria_id);
    END IF;
  END IF;

  -- BRANCH 3: First-time finalization
  -- Se for manual e a cobrança tinha provedor digital, reescreve provedor='manual'
  -- e preserva o provedor original na obs_manual (auditoria).
  IF p_manual_method IS NOT NULL
     AND v_cobranca.provedor IS NOT NULL
     AND v_cobranca.provedor <> 'manual' THEN
    v_new_provedor := 'manual';
    v_obs_prefix := '[orig: ' || v_cobranca.provedor || '] ';
  ELSE
    v_new_provedor := v_cobranca.provedor;
    v_obs_prefix := '';
  END IF;

  v_merged_obs := NULLIF(
    v_obs_prefix || COALESCE(p_manual_obs, v_cobranca.obs_manual, ''),
    ''
  );

  UPDATE public.cobrancas
  SET status = v_final_status,
      data_pagamento = COALESCE(data_pagamento, p_paid_at, now()),
      ip_receipt_url = COALESCE(p_receipt_url, ip_receipt_url),
      metodo_manual = COALESCE(p_manual_method, metodo_manual),
      obs_manual = COALESCE(v_merged_obs, obs_manual),
      provedor = v_new_provedor,
      updated_at = now()
  WHERE id = p_cobranca_id;

  IF v_galeria_id IS NOT NULL THEN
    SELECT GREATEST(COALESCE(g.fotos_selecionadas,0) - COALESCE(g.fotos_incluidas,0), 0)
    INTO v_sum_qtd FROM public.galerias g WHERE g.id = v_galeria_id;

    SELECT COALESCE(SUM(valor),0)::numeric INTO v_sum_val
    FROM public.cobrancas
    WHERE galeria_id = v_galeria_id
      AND status IN ('pago','pago_manual')
      AND tipo_cobranca IN ('foto_extra','link','venda_galeria','card','pix');

    UPDATE public.galerias
    SET total_fotos_extras_vendidas = v_sum_qtd,
        valor_total_vendido = v_sum_val,
        status_pagamento = v_final_status,
        status_selecao = 'selecao_completa',
        finalized_at = COALESCE(finalized_at, p_paid_at, now()),
        updated_at = now()
    WHERE id = v_galeria_id;

    IF v_cobranca.session_id IS NOT NULL THEN
      UPDATE public.clientes_sessoes
      SET qtd_fotos_extra = v_sum_qtd, valor_total_foto_extra = v_sum_val,
          status_galeria = 'selecao_completa', status_pagamento_fotos_extra = v_final_status,
          updated_at = now()
      WHERE session_id = v_cobranca.session_id;
    END IF;

    UPDATE public.cobrancas SET extras_contabilizados = true
    WHERE id = p_cobranca_id AND extras_contabilizados IS NOT TRUE;
    v_gallery_synced := true;
  END IF;

  IF v_cobranca.visitor_id IS NOT NULL THEN
    UPDATE public.galeria_visitantes
    SET status = 'finalizado', status_selecao = 'selecao_completa',
        finalized_at = COALESCE(p_paid_at, now()), updated_at = now()
    WHERE id = v_cobranca.visitor_id AND status != 'finalizado';
  END IF;

  RETURN jsonb_build_object('success', true, 'already_paid', false,
    'gallery_synced', v_gallery_synced, 'galeria_id', v_galeria_id,
    'final_status', v_final_status);

EXCEPTION WHEN OTHERS THEN
  BEGIN
    INSERT INTO public.audit_log(action, actor_type, resource_type, resource_id, gallery_id, metadata)
    VALUES('finalize_gallery_payment_failed','system','cobranca', p_cobranca_id, v_galeria_id,
      jsonb_build_object('error', SQLERRM, 'sqlstate', SQLSTATE));
  EXCEPTION WHEN OTHERS THEN NULL; END;
  RAISE;
END;
$function$;

-- 2) Backfill: historical pago_manual rows that still carry the digital provedor
UPDATE public.cobrancas
SET provedor = 'manual',
    obs_manual = '[orig: ' || provedor || '] ' || COALESCE(obs_manual, ''),
    updated_at = now()
WHERE status = 'pago_manual'
  AND metodo_manual IS NOT NULL
  AND provedor IS NOT NULL
  AND provedor <> 'manual';
