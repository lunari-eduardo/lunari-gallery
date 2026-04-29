-- ============================================================
-- PARTE 1: Hardening da RPC finalize_gallery_payment
-- Adiciona inferência defensiva de qtd_fotos quando vier 0
-- (mantém colunas usadas pela função original; corrige nomes que
-- realmente existem na tabela `cobrancas`)
-- ============================================================

CREATE OR REPLACE FUNCTION public.finalize_gallery_payment(
  p_cobranca_id uuid,
  p_receipt_url text DEFAULT NULL::text,
  p_paid_at timestamp with time zone DEFAULT now(),
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
  v_should_count BOOLEAN;
  v_inferred_qtd INT;
  v_match TEXT[];
  v_valor_unit NUMERIC;
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

  -- 🛡️ INFERÊNCIA DEFENSIVA de qtd_fotos quando vier 0
  -- Cobranças InfinitePay/MercadoPago tiveram regressão gravando qtd_fotos=0.
  -- Estratégia: extrair "N foto" da descrição, ou dividir valor pelo preço unitário.
  IF COALESCE(v_cobranca.qtd_fotos, 0) = 0 AND v_galeria_id IS NOT NULL AND v_cobranca.valor > 0 THEN
    v_inferred_qtd := NULL;

    IF v_cobranca.descricao IS NOT NULL THEN
      v_match := regexp_match(v_cobranca.descricao, '(\d+)\s*foto', 'i');
      IF v_match IS NOT NULL THEN
        v_inferred_qtd := (v_match[1])::INT;
      END IF;
    END IF;

    IF v_inferred_qtd IS NULL OR v_inferred_qtd = 0 THEN
      SELECT NULLIF(valor_foto_extra, 0) INTO v_valor_unit
      FROM public.galerias
      WHERE id = v_galeria_id;

      IF v_valor_unit IS NOT NULL AND v_valor_unit > 0 THEN
        v_inferred_qtd := ROUND(v_cobranca.valor / v_valor_unit)::INT;
      END IF;
    END IF;

    IF v_inferred_qtd IS NOT NULL AND v_inferred_qtd > 0 THEN
      UPDATE public.cobrancas
      SET qtd_fotos = v_inferred_qtd, updated_at = now()
      WHERE id = p_cobranca_id;
      v_cobranca.qtd_fotos := v_inferred_qtd;
      RAISE NOTICE 'finalize_gallery_payment: inferido qtd_fotos=% para cobranca %', v_inferred_qtd, p_cobranca_id;
    END IF;
  END IF;

  v_should_count := (
    v_cobranca.extras_contabilizados IS NOT TRUE
    AND COALESCE(v_cobranca.qtd_fotos, 0) > 0
    AND v_galeria_id IS NOT NULL
  );

  -- BRANCH 1: Already paid - sync gallery if needed (idempotente por cobrança)
  IF v_cobranca.status IN ('pago', 'pago_manual') THEN
    IF v_should_count THEN
      UPDATE public.galerias
      SET total_fotos_extras_vendidas = COALESCE(total_fotos_extras_vendidas, 0) + v_cobranca.qtd_fotos,
          valor_total_vendido = COALESCE(valor_total_vendido, 0) + v_cobranca.valor,
          status_pagamento = v_cobranca.status,
          status_selecao = 'selecao_completa',
          finalized_at = COALESCE(finalized_at, v_cobranca.data_pagamento, now()),
          updated_at = now()
      WHERE id = v_galeria_id;

      UPDATE public.cobrancas SET extras_contabilizados = true WHERE id = p_cobranca_id;

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

    IF v_cobranca.visitor_id IS NOT NULL THEN
      UPDATE public.galeria_visitantes
      SET status = 'finalizado',
          status_selecao = 'selecao_completa',
          finalized_at = COALESCE(v_cobranca.data_pagamento, now()),
          updated_at = now()
      WHERE id = v_cobranca.visitor_id
        AND status != 'finalizado';
    END IF;

    RETURN jsonb_build_object('success', true, 'already_paid', true,
      'gallery_synced', v_gallery_synced, 'galeria_id', v_galeria_id);
  END IF;

  -- BRANCH 2: Asaas com parcelas
  IF v_cobranca.provedor = 'asaas' AND v_cobranca.mp_payment_id IS NOT NULL AND p_manual_method IS NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM public.cobranca_parcelas WHERE cobranca_id = p_cobranca_id
    ) INTO v_has_parcelas;

    IF v_has_parcelas THEN
      SELECT status INTO v_current_status FROM public.cobrancas WHERE id = p_cobranca_id;

      IF v_current_status IN ('pago', 'pago_manual') THEN
        v_should_count := (
          (SELECT extras_contabilizados FROM public.cobrancas WHERE id = p_cobranca_id) IS NOT TRUE
          AND COALESCE(v_cobranca.qtd_fotos, 0) > 0
          AND v_galeria_id IS NOT NULL
        );

        IF v_should_count THEN
          UPDATE public.galerias
          SET total_fotos_extras_vendidas = COALESCE(total_fotos_extras_vendidas, 0) + v_cobranca.qtd_fotos,
              valor_total_vendido = COALESCE(valor_total_vendido, 0) + v_cobranca.valor,
              status_pagamento = v_current_status,
              status_selecao = 'selecao_completa',
              finalized_at = COALESCE(finalized_at, v_cobranca.data_pagamento, now()),
              updated_at = now()
          WHERE id = v_galeria_id;

          UPDATE public.cobrancas SET extras_contabilizados = true WHERE id = p_cobranca_id;

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
          v_gallery_synced := true;
        END IF;

        IF v_cobranca.visitor_id IS NOT NULL THEN
          UPDATE public.galeria_visitantes
          SET status = 'finalizado',
              status_selecao = 'selecao_completa',
              finalized_at = COALESCE(v_cobranca.data_pagamento, now()),
              updated_at = now()
          WHERE id = v_cobranca.visitor_id
            AND status != 'finalizado';
        END IF;
      END IF;

      RETURN jsonb_build_object('success', true, 'already_paid', false,
        'has_parcelas', true, 'current_status', v_current_status,
        'gallery_synced', v_gallery_synced, 'galeria_id', v_galeria_id);
    END IF;
  END IF;

  -- BRANCH 3: First-time finalization
  UPDATE public.cobrancas
  SET status = v_final_status,
      data_pagamento = COALESCE(data_pagamento, p_paid_at, now()),
      ip_receipt_url = COALESCE(p_receipt_url, ip_receipt_url),
      metodo_manual = COALESCE(p_manual_method, metodo_manual),
      obs_manual = COALESCE(p_manual_obs, obs_manual),
      updated_at = now()
  WHERE id = p_cobranca_id;

  IF v_should_count THEN
    UPDATE public.galerias
    SET total_fotos_extras_vendidas = COALESCE(total_fotos_extras_vendidas, 0) + v_cobranca.qtd_fotos,
        valor_total_vendido = COALESCE(valor_total_vendido, 0) + v_cobranca.valor,
        status_pagamento = v_final_status,
        status_selecao = 'selecao_completa',
        finalized_at = COALESCE(finalized_at, p_paid_at, now()),
        updated_at = now()
    WHERE id = v_galeria_id;

    UPDATE public.cobrancas SET extras_contabilizados = true WHERE id = p_cobranca_id;

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
    v_gallery_synced := true;
  END IF;

  IF v_cobranca.visitor_id IS NOT NULL THEN
    UPDATE public.galeria_visitantes
    SET status = 'finalizado',
        status_selecao = 'selecao_completa',
        finalized_at = COALESCE(p_paid_at, now()),
        updated_at = now()
    WHERE id = v_cobranca.visitor_id
      AND status != 'finalizado';
  END IF;

  RETURN jsonb_build_object('success', true, 'already_paid', false,
    'gallery_synced', v_gallery_synced, 'galeria_id', v_galeria_id,
    'final_status', v_final_status);
END;
$function$;

-- ============================================================
-- PARTE 2: Backfill de qtd_fotos em cobranças pagas afetadas
-- ============================================================

UPDATE public.cobrancas
SET qtd_fotos = (regexp_match(descricao, '(\d+)\s*foto', 'i'))[1]::INT,
    updated_at = now()
WHERE status IN ('pago', 'pago_manual')
  AND COALESCE(qtd_fotos, 0) = 0
  AND provedor IN ('infinitepay', 'mercadopago')
  AND galeria_id IS NOT NULL
  AND descricao ~* '\d+\s*foto'
  AND (regexp_match(descricao, '(\d+)\s*foto', 'i'))[1]::INT > 0;

-- ============================================================
-- PARTE 3: Reconciliar galerias afetadas (RPC idempotente)
-- ============================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT id, ip_receipt_url, data_pagamento
    FROM public.cobrancas
    WHERE status IN ('pago', 'pago_manual')
      AND COALESCE(qtd_fotos, 0) > 0
      AND extras_contabilizados IS NOT TRUE
      AND galeria_id IS NOT NULL
      AND provedor IN ('infinitepay', 'mercadopago')
  LOOP
    PERFORM public.finalize_gallery_payment(
      r.id, r.ip_receipt_url, COALESCE(r.data_pagamento, now()), NULL, NULL
    );
  END LOOP;
END $$;

-- ============================================================
-- PARTE 4: Cancelar a 2ª cobrança duplicada da galeria Lucca
-- ============================================================

UPDATE public.cobrancas
SET status = 'cancelado',
    obs_manual = COALESCE(obs_manual || E'\n', '') ||
                 '[Auto-reconcile] Cancelada: cobrança duplicada criada após reativação enquanto extras já estavam pagos.',
    updated_at = now()
WHERE id = '7d7ebd3b-808d-4759-83e9-813f615f44c4'
  AND status = 'pendente';

-- ============================================================
-- PARTE 5: Caso especial — Olívia - Newborn
-- ============================================================

UPDATE public.cobrancas
SET extras_contabilizados = false,
    qtd_fotos = 10,
    updated_at = now()
WHERE id = '4ae71388-912f-43e4-989d-a559de81f159'
  AND COALESCE(qtd_fotos, 0) = 0;

DO $$
DECLARE
  v_url TEXT;
  v_paid TIMESTAMPTZ;
BEGIN
  SELECT ip_receipt_url, data_pagamento INTO v_url, v_paid
  FROM public.cobrancas WHERE id = '4ae71388-912f-43e4-989d-a559de81f159';
  PERFORM public.finalize_gallery_payment(
    '4ae71388-912f-43e4-989d-a559de81f159'::uuid, v_url, COALESCE(v_paid, now()), NULL, NULL
  );
END $$;