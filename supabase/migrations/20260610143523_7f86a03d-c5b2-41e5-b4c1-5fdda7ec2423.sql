CREATE OR REPLACE FUNCTION public.finalize_gallery_payment(p_cobranca_id uuid, p_receipt_url text DEFAULT NULL::text, p_paid_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_manual_method text DEFAULT NULL::text, p_manual_obs text DEFAULT NULL::text)
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
  v_current_status TEXT;
  v_inferred_qtd INT;
  v_match TEXT[];
  v_valor_unit NUMERIC;
  v_sum_qtd INT;
  v_sum_val NUMERIC;
  v_correlation_id UUID;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_cobranca_id::text));

  SELECT * INTO v_cobranca FROM public.cobrancas WHERE id = p_cobranca_id FOR UPDATE;
  IF v_cobranca IS NULL THEN
    RETURN jsonb_build_object('success', false, 'already_paid', false, 'error', 'Cobranca nao encontrada');
  END IF;

  v_correlation_id := COALESCE(v_cobranca.correlation_id, current_setting('app.correlation_id', true)::uuid);
  v_final_status := CASE WHEN p_manual_method IS NOT NULL THEN 'pago_manual' ELSE 'pago' END;

  v_galeria_id := v_cobranca.galeria_id;
  IF v_galeria_id IS NULL AND v_cobranca.session_id IS NOT NULL THEN
    SELECT id INTO v_galeria_id FROM public.galerias WHERE session_id = v_cobranca.session_id LIMIT 1;
    IF v_galeria_id IS NOT NULL THEN
      UPDATE public.cobrancas SET galeria_id = v_galeria_id WHERE id = p_cobranca_id;
      v_cobranca.galeria_id := v_galeria_id;
    END IF;
  END IF;

  IF v_cobranca.status IN ('pago','pago_manual') THEN
    IF v_galeria_id IS NOT NULL THEN
      SELECT GREATEST(COALESCE(g.fotos_selecionadas,0) - COALESCE(v_cobranca.snapshot_fotos_incluidas, g.fotos_incluidas, 0), 0)
      INTO v_sum_qtd FROM public.galerias g WHERE g.id = v_galeria_id;

      SELECT COALESCE(SUM(valor),0)::numeric INTO v_sum_val
      FROM public.cobrancas
      WHERE galeria_id = v_galeria_id
        AND status IN ('pago','pago_manual')
        AND tipo_cobranca IN ('foto_extra','link','venda_galeria','card','pix');

      UPDATE public.galerias
      SET status = 'selecao_completa', -- Adicionado para sincronizar badge
          total_fotos_extras_vendidas = v_sum_qtd,
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

  UPDATE public.cobrancas 
  SET status = v_final_status,
      data_pagamento = COALESCE(p_paid_at, now()),
      updated_at = now()
  WHERE id = p_cobranca_id;

  IF v_galeria_id IS NOT NULL THEN
    SELECT GREATEST(COALESCE(g.fotos_selecionadas,0) - COALESCE(v_cobranca.snapshot_fotos_incluidas, g.fotos_incluidas, 0), 0)
    INTO v_sum_qtd FROM public.galerias g WHERE g.id = v_galeria_id;

    SELECT COALESCE(SUM(valor),0)::numeric INTO v_sum_val
    FROM public.cobrancas
    WHERE galeria_id = v_galeria_id
      AND status IN ('pago','pago_manual')
      AND tipo_cobranca IN ('foto_extra','link','venda_galeria','card','pix');

    UPDATE public.galerias
    SET status = 'selecao_completa', -- Adicionado para sincronizar badge
        total_fotos_extras_vendidas = v_sum_qtd,
        valor_total_vendido = v_sum_val,
        status_pagamento = v_final_status,
        status_selecao = 'selecao_completa',
        finalized_at = COALESCE(finalized_at, p_paid_at, now()),
        updated_at = now()
    WHERE id = v_galeria_id;

    IF v_cobranca.session_id IS NOT NULL THEN
      UPDATE public.clientes_sessoes
      SET qtd_fotos_extra = v_sum_qtd,
          valor_total_foto_extra = v_sum_val,
          status_galeria = 'selecao_completa',
          status_pagamento_fotos_extra = v_final_status,
          updated_at = now()
      WHERE session_id = v_cobranca.session_id;
    END IF;
    
    UPDATE public.cobrancas SET extras_contabilizados = true WHERE id = p_cobranca_id;
    v_gallery_synced := true;
  END IF;

  IF v_cobranca.visitor_id IS NOT NULL THEN
    UPDATE public.galeria_visitantes
    SET status = 'finalizado', status_selecao = 'selecao_completa',
        finalized_at = COALESCE(p_paid_at, now()), updated_at = now()
    WHERE id = v_cobranca.visitor_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'already_paid', false,
    'gallery_synced', v_gallery_synced, 'galeria_id', v_galeria_id);
END;
$function$;