
-- 1) finalize_gallery_payment: total_fotos_extras_vendidas vem da seleção
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
  v_has_parcelas BOOLEAN;
  v_current_status TEXT;
  v_inferred_qtd INT;
  v_match TEXT[];
  v_valor_unit NUMERIC;
  v_sum_qtd INT;
  v_sum_val NUMERIC;
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

  -- Inferência defensiva qtd_fotos quando 0 (mantida para auditoria/financeiro,
  -- não é mais fonte de verdade para a contagem de extras da galeria)
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

  -- BRANCH 1: já paga — só sincroniza se necessário
  IF v_cobranca.status IN ('pago', 'pago_manual') THEN
    IF v_galeria_id IS NOT NULL THEN
      -- Quantidade vem da SELEÇÃO (verdade absoluta), valor vem das cobranças pagas
      SELECT GREATEST(COALESCE(g.fotos_selecionadas,0) - COALESCE(g.fotos_incluidas,0), 0)
      INTO v_sum_qtd
      FROM public.galerias g WHERE g.id = v_galeria_id;

      SELECT COALESCE(SUM(valor), 0)::numeric
      INTO v_sum_val
      FROM public.cobrancas
      WHERE galeria_id = v_galeria_id
        AND status IN ('pago', 'pago_manual')
        AND tipo_cobranca IN ('foto_extra', 'link', 'venda_galeria', 'card', 'pix');

      UPDATE public.galerias
      SET total_fotos_extras_vendidas = v_sum_qtd,
          valor_total_vendido = v_sum_val,
          status_pagamento = v_cobranca.status,
          status_selecao = 'selecao_completa',
          finalized_at = COALESCE(finalized_at, v_cobranca.data_pagamento, now()),
          updated_at = now()
      WHERE id = v_galeria_id;

      UPDATE public.cobrancas SET extras_contabilizados = true WHERE id = p_cobranca_id AND extras_contabilizados IS NOT TRUE;

      IF v_cobranca.session_id IS NOT NULL THEN
        UPDATE public.clientes_sessoes
        SET qtd_fotos_extra = v_sum_qtd,
            valor_total_foto_extra = v_sum_val,
            status_galeria = 'selecao_completa',
            status_pagamento_fotos_extra = v_cobranca.status,
            updated_at = now()
        WHERE session_id = v_cobranca.session_id;
      END IF;
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
      IF v_current_status IN ('pago', 'pago_manual') AND v_galeria_id IS NOT NULL THEN
        SELECT GREATEST(COALESCE(g.fotos_selecionadas,0) - COALESCE(g.fotos_incluidas,0), 0)
        INTO v_sum_qtd
        FROM public.galerias g WHERE g.id = v_galeria_id;

        SELECT COALESCE(SUM(valor), 0)::numeric
        INTO v_sum_val
        FROM public.cobrancas
        WHERE galeria_id = v_galeria_id
          AND status IN ('pago', 'pago_manual')
          AND tipo_cobranca IN ('foto_extra', 'link', 'venda_galeria', 'card', 'pix');

        UPDATE public.galerias
        SET total_fotos_extras_vendidas = v_sum_qtd,
            valor_total_vendido = v_sum_val,
            status_pagamento = v_current_status,
            status_selecao = 'selecao_completa',
            finalized_at = COALESCE(finalized_at, v_cobranca.data_pagamento, now()),
            updated_at = now()
        WHERE id = v_galeria_id;

        UPDATE public.cobrancas SET extras_contabilizados = true WHERE id = p_cobranca_id AND extras_contabilizados IS NOT TRUE;

        IF v_cobranca.session_id IS NOT NULL THEN
          UPDATE public.clientes_sessoes
          SET qtd_fotos_extra = v_sum_qtd, valor_total_foto_extra = v_sum_val,
              status_galeria = 'selecao_completa', status_pagamento_fotos_extra = v_current_status,
              updated_at = now()
          WHERE session_id = v_cobranca.session_id;
        END IF;
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
  UPDATE public.cobrancas
  SET status = v_final_status,
      data_pagamento = COALESCE(data_pagamento, p_paid_at, now()),
      ip_receipt_url = COALESCE(p_receipt_url, ip_receipt_url),
      metodo_manual = COALESCE(p_manual_method, metodo_manual),
      obs_manual = COALESCE(p_manual_obs, obs_manual),
      updated_at = now()
  WHERE id = p_cobranca_id;

  IF v_galeria_id IS NOT NULL THEN
    SELECT GREATEST(COALESCE(g.fotos_selecionadas,0) - COALESCE(g.fotos_incluidas,0), 0)
    INTO v_sum_qtd
    FROM public.galerias g WHERE g.id = v_galeria_id;

    SELECT COALESCE(SUM(valor), 0)::numeric
    INTO v_sum_val
    FROM public.cobrancas
    WHERE galeria_id = v_galeria_id
      AND status IN ('pago', 'pago_manual')
      AND tipo_cobranca IN ('foto_extra', 'link', 'venda_galeria', 'card', 'pix');

    UPDATE public.galerias
    SET total_fotos_extras_vendidas = v_sum_qtd,
        valor_total_vendido = v_sum_val,
        status_pagamento = v_final_status,
        status_selecao = 'selecao_completa',
        finalized_at = COALESCE(finalized_at, p_paid_at, now()),
        updated_at = now()
    WHERE id = v_galeria_id;

    UPDATE public.cobrancas SET extras_contabilizados = true WHERE id = p_cobranca_id AND extras_contabilizados IS NOT TRUE;

    IF v_cobranca.session_id IS NOT NULL THEN
      UPDATE public.clientes_sessoes
      SET qtd_fotos_extra = v_sum_qtd, valor_total_foto_extra = v_sum_val,
          status_galeria = 'selecao_completa', status_pagamento_fotos_extra = v_final_status,
          updated_at = now()
      WHERE session_id = v_cobranca.session_id;
    END IF;
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
END;
$function$;

-- 2) reconcile_gallery_extras_counters: mesma fonte
CREATE OR REPLACE FUNCTION public.reconcile_gallery_extras_counters()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_galerias_corrigidas INT := 0;
  v_sessoes_corrigidas INT := 0;
BEGIN
  WITH agg AS (
    SELECT g.id AS galeria_id,
           GREATEST(COALESCE(g.fotos_selecionadas,0) - COALESCE(g.fotos_incluidas,0), 0)::int AS sum_qtd,
           COALESCE((
             SELECT SUM(c.valor) FROM public.cobrancas c
             WHERE c.galeria_id = g.id
               AND c.status IN ('pago','pago_manual')
               AND c.tipo_cobranca IN ('foto_extra','link','venda_galeria','card','pix')
           ),0)::numeric AS sum_val
    FROM public.galerias g
    WHERE EXISTS (
      SELECT 1 FROM public.cobrancas c2
      WHERE c2.galeria_id = g.id AND c2.status IN ('pago','pago_manual')
    )
  ),
  upd AS (
    UPDATE public.galerias g
    SET total_fotos_extras_vendidas = a.sum_qtd,
        valor_total_vendido = a.sum_val,
        updated_at = now()
    FROM agg a
    WHERE g.id = a.galeria_id
      AND (
        COALESCE(g.total_fotos_extras_vendidas,0) <> a.sum_qtd
        OR COALESCE(g.valor_total_vendido,0) <> a.sum_val
      )
    RETURNING g.id
  )
  SELECT count(*) INTO v_galerias_corrigidas FROM upd;

  WITH upd AS (
    UPDATE public.clientes_sessoes s
    SET qtd_fotos_extra = g.total_fotos_extras_vendidas,
        valor_total_foto_extra = g.valor_total_vendido,
        updated_at = now()
    FROM public.galerias g
    WHERE g.session_id = s.session_id
      AND g.session_id IS NOT NULL
      AND (
        COALESCE(s.qtd_fotos_extra,0) <> COALESCE(g.total_fotos_extras_vendidas,0)
        OR COALESCE(s.valor_total_foto_extra,0) <> COALESCE(g.valor_total_vendido,0)
      )
    RETURNING s.id
  )
  SELECT count(*) INTO v_sessoes_corrigidas FROM upd;

  RETURN jsonb_build_object(
    'success', true,
    'galerias_corrigidas', v_galerias_corrigidas,
    'sessoes_corrigidas', v_sessoes_corrigidas
  );
END;
$function$;

-- 3) protect_gallery_extras_downgrade: permite quando bate com a seleção real
CREATE OR REPLACE FUNCTION public.protect_gallery_extras_downgrade()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_extras_selecionados INT;
BEGIN
  IF NEW.total_fotos_extras_vendidas < OLD.total_fotos_extras_vendidas THEN
    v_extras_selecionados := GREATEST(COALESCE(NEW.fotos_selecionadas,0) - COALESCE(NEW.fotos_incluidas,0), 0);

    -- Permite ajuste que reflete a seleção real (fonte de verdade)
    IF NEW.total_fotos_extras_vendidas = v_extras_selecionados THEN
      RETURN NEW;
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.cobrancas
      WHERE galeria_id = NEW.id
        AND status = 'pago'
        AND COALESCE(qtd_fotos, 0) > 0
    ) THEN
      INSERT INTO public.audit_log(action, resource_type, resource_id, gallery_id, metadata)
      VALUES(
        'blocked_extras_downgrade',
        'galeria',
        NEW.id,
        NEW.id,
        jsonb_build_object(
          'old_qtd', OLD.total_fotos_extras_vendidas,
          'new_qtd', NEW.total_fotos_extras_vendidas,
          'old_total', OLD.valor_total_vendido,
          'new_total', NEW.valor_total_vendido,
          'extras_selecionados', v_extras_selecionados,
          'reason', 'has_paid_charges'
        )
      );
      RAISE EXCEPTION 'Não é possível reduzir fotos extras: existem cobranças pagas vinculadas a esta galeria. Use "Reconciliar crédito" no Workflow para ajustar manualmente.';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- 4) sync_gallery_extras_to_session: unitário efetivo usa qtd paga; propaga qtd da galeria (que agora é da seleção)
CREATE OR REPLACE FUNCTION public.sync_gallery_extras_to_session()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_unit_efetivo NUMERIC;
  v_unit_base NUMERIC;
  v_qtd_pagos INT;
  v_fotos_incluidas_mudou BOOLEAN;
  v_extras_mudou BOOLEAN;
BEGIN
  v_extras_mudou := (NEW.valor_foto_extra IS DISTINCT FROM OLD.valor_foto_extra)
                 OR (NEW.total_fotos_extras_vendidas IS DISTINCT FROM OLD.total_fotos_extras_vendidas)
                 OR (NEW.valor_total_vendido IS DISTINCT FROM OLD.valor_total_vendido);

  v_fotos_incluidas_mudou := (NEW.fotos_incluidas IS DISTINCT FROM OLD.fotos_incluidas);

  IF v_extras_mudou THEN
    v_unit_base := ROUND(LEAST(GREATEST(COALESCE(NEW.valor_foto_extra, 0), 0), 999.99)::numeric, 2);

    -- unitário efetivo: usa qtd_fotos das cobranças pagas (preço médio efetivo cobrado)
    SELECT COALESCE(SUM(qtd_fotos),0)::int INTO v_qtd_pagos
    FROM public.cobrancas
    WHERE galeria_id = NEW.id
      AND status IN ('pago','pago_manual')
      AND tipo_cobranca IN ('foto_extra','link','venda_galeria','card','pix');

    v_unit_efetivo := CASE
      WHEN v_qtd_pagos > 0 AND COALESCE(NEW.valor_total_vendido, 0) > 0
      THEN ROUND((NEW.valor_total_vendido / v_qtd_pagos)::numeric, 2)
      ELSE v_unit_base
    END;

    UPDATE public.clientes_sessoes s
    SET
      valor_foto_extra = v_unit_efetivo,
      qtd_fotos_extra = COALESCE(NEW.total_fotos_extras_vendidas, 0),
      valor_total_foto_extra = COALESCE(NEW.valor_total_vendido, 0),
      regras_congeladas = CASE
        WHEN s.regras_congeladas IS NOT NULL
             AND jsonb_typeof(s.regras_congeladas->'pacote') = 'object'
        THEN jsonb_set(
               s.regras_congeladas,
               '{pacote,valorFotoExtraEfetivo}',
               to_jsonb(v_unit_efetivo),
               true
             )
        ELSE s.regras_congeladas
      END,
      updated_at = now()
    WHERE s.galeria_id = NEW.id
      AND (
        s.valor_foto_extra IS DISTINCT FROM v_unit_efetivo
        OR s.qtd_fotos_extra IS DISTINCT FROM COALESCE(NEW.total_fotos_extras_vendidas, 0)
        OR s.valor_total_foto_extra IS DISTINCT FROM COALESCE(NEW.valor_total_vendido, 0)
        OR (
          s.regras_congeladas IS NOT NULL
          AND jsonb_typeof(s.regras_congeladas->'pacote') = 'object'
          AND COALESCE((s.regras_congeladas->'pacote'->>'valorFotoExtraEfetivo')::numeric, -1) IS DISTINCT FROM v_unit_efetivo
        )
      );

    IF NEW.regras_congeladas IS NOT NULL
       AND jsonb_typeof(NEW.regras_congeladas->'pacote') = 'object'
       AND COALESCE((NEW.regras_congeladas->'pacote'->>'valorFotoExtra')::numeric, -1) IS DISTINCT FROM v_unit_base
       AND pg_trigger_depth() < 2 THEN
      UPDATE public.galerias g
      SET regras_congeladas = jsonb_set(
            NEW.regras_congeladas,
            '{pacote,valorFotoExtra}',
            to_jsonb(v_unit_base),
            true
          )
      WHERE g.id = NEW.id;
    END IF;
  END IF;

  IF v_fotos_incluidas_mudou THEN
    IF NEW.regras_congeladas IS NOT NULL
       AND jsonb_typeof(NEW.regras_congeladas->'pacote') = 'object'
       AND COALESCE((NEW.regras_congeladas->'pacote'->>'fotosIncluidas')::int, -1) IS DISTINCT FROM COALESCE(NEW.fotos_incluidas, 0)
       AND pg_trigger_depth() < 2 THEN
      UPDATE public.galerias g
      SET regras_congeladas = jsonb_set(
            COALESCE(g.regras_congeladas, '{}'::jsonb),
            '{pacote,fotosIncluidas}',
            to_jsonb(COALESCE(NEW.fotos_incluidas, 0)),
            true
          )
      WHERE g.id = NEW.id;
    END IF;

    UPDATE public.clientes_sessoes s
    SET
      regras_congeladas = jsonb_set(
        COALESCE(s.regras_congeladas, '{}'::jsonb),
        '{pacote,fotosIncluidas}',
        to_jsonb(COALESCE(NEW.fotos_incluidas, 0)),
        true
      ),
      updated_at = now()
    WHERE s.galeria_id = NEW.id
      AND (
        s.regras_congeladas IS NULL
        OR jsonb_typeof(s.regras_congeladas->'pacote') <> 'object'
        OR COALESCE((s.regras_congeladas->'pacote'->>'fotosIncluidas')::int, -1) IS DISTINCT FROM COALESCE(NEW.fotos_incluidas, 0)
      );
  END IF;

  RETURN NEW;
END;
$function$;

-- 5) Backfill: reconcilia todas as galerias afetadas
SELECT public.reconcile_gallery_extras_counters();
