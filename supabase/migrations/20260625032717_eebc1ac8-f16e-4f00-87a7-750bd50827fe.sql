
-- ============================================================
-- Onda: contrato canônico de cobrança de fotos extras
-- (a) RPC pública de cálculo canônico (consumida por Gestão + Gallery)
-- (b) Endurecimento de tg_protect_no_overcharge para respeitar a regra congelada
-- (c) Endurecimento de finalize_gallery_payment para NUNCA vincular órfãos
--     automaticamente (somente quando finalidade já é 'fotos_extras')
-- (d) Healing pontual da galeria Clarissa Machado
-- ============================================================

-- ---------- helper: preço unitário pela faixa progressiva ----------
CREATE OR REPLACE FUNCTION public._extra_unit_price_for_quantity(
  p_regras_congeladas jsonb,
  p_valor_fixo numeric,
  p_total_extras int
)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_modelo text;
  v_pacote_unit numeric;
  v_unit numeric;
  v_faixas jsonb;
  v_faixa jsonb;
  v_min int;
  v_max int;
BEGIN
  IF p_total_extras IS NULL OR p_total_extras <= 0 THEN
    RETURN 0;
  END IF;

  v_pacote_unit := COALESCE(
    NULLIF((p_regras_congeladas->'pacote'->>'valorFotoExtra')::numeric, 0),
    NULLIF(p_valor_fixo, 0),
    0
  );

  IF p_regras_congeladas IS NULL THEN
    RETURN COALESCE(NULLIF(p_valor_fixo, 0), 0);
  END IF;

  v_modelo := COALESCE(p_regras_congeladas->'precificacaoFotoExtra'->>'modelo', p_regras_congeladas->>'modelo', 'fixo');

  IF v_modelo = 'fixo' THEN
    RETURN COALESCE(
      NULLIF((p_regras_congeladas->'precificacaoFotoExtra'->>'valorFixo')::numeric, 0),
      v_pacote_unit
    );
  END IF;

  IF v_modelo = 'categoria' THEN
    IF COALESCE((p_regras_congeladas->'precificacaoFotoExtra'->'tabelaCategoria'->>'usar_valor_fixo_pacote')::boolean, false) THEN
      RETURN v_pacote_unit;
    END IF;
    v_faixas := p_regras_congeladas->'precificacaoFotoExtra'->'tabelaCategoria'->'faixas';
  ELSE
    v_faixas := p_regras_congeladas->'precificacaoFotoExtra'->'tabelaGlobal'->'faixas';
  END IF;

  IF v_faixas IS NULL OR jsonb_typeof(v_faixas) <> 'array' OR jsonb_array_length(v_faixas) = 0 THEN
    RETURN v_pacote_unit;
  END IF;

  -- Busca faixa onde min <= total <= max (max NULL = ilimitado)
  FOR v_faixa IN SELECT * FROM jsonb_array_elements(v_faixas) LOOP
    v_min := COALESCE((v_faixa->>'min')::int, 0);
    v_max := CASE WHEN v_faixa->>'max' IS NULL OR v_faixa->>'max' = 'null'
                  THEN NULL ELSE (v_faixa->>'max')::int END;
    IF p_total_extras >= v_min AND (v_max IS NULL OR p_total_extras <= v_max) THEN
      v_unit := (v_faixa->>'valor')::numeric;
      EXIT;
    END IF;
  END LOOP;

  -- Fallback: maior faixa (último valor) se nada bateu
  IF v_unit IS NULL THEN
    SELECT (elem->>'valor')::numeric INTO v_unit
    FROM jsonb_array_elements(v_faixas) AS elem
    ORDER BY (elem->>'min')::int DESC
    LIMIT 1;
  END IF;

  RETURN COALESCE(NULLIF(v_unit, 0), v_pacote_unit);
END;
$$;

GRANT EXECUTE ON FUNCTION public._extra_unit_price_for_quantity(jsonb, numeric, int) TO authenticated, anon, service_role;

-- ---------- RPC canônica de cálculo da cobrança de extras ----------
-- Esta é a fonte ÚNICA de verdade consumida tanto pelo Gallery quanto pelo Gestão.
-- Sempre devolve o cálculo correto pela regra progressiva congelada.
CREATE OR REPLACE FUNCTION public.calculate_gallery_extra_payment(
  p_gallery_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_g RECORD;
  v_regras jsonb;
  v_rules_source text := 'gallery_fixed';
  v_sess RECORD;
  v_selected int := 0;
  v_included int := 0;
  v_extras_necess int := 0;
  v_extras_pagas int := 0;
  v_valor_pago numeric := 0;
  v_unit numeric := 0;
  v_ideal numeric := 0;
  v_a_cobrar numeric := 0;
BEGIN
  SELECT id, user_id, fotos_incluidas, fotos_selecionadas,
         valor_foto_extra, regras_congeladas, session_id,
         total_fotos_extras_vendidas, valor_total_vendido
  INTO v_g FROM galerias WHERE id = p_gallery_id;
  IF v_g IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'GALLERY_NOT_FOUND');
  END IF;

  v_selected := COALESCE(v_g.fotos_selecionadas, 0);
  v_included := COALESCE(v_g.fotos_incluidas, 0);
  v_extras_necess := GREATEST(0, v_selected - v_included);

  v_regras := v_g.regras_congeladas;
  IF v_regras IS NOT NULL THEN
    v_rules_source := 'gallery_frozen';
  ELSIF v_g.session_id IS NOT NULL THEN
    SELECT regras_congeladas INTO v_sess FROM clientes_sessoes
     WHERE session_id = v_g.session_id LIMIT 1;
    IF v_sess.regras_congeladas IS NOT NULL THEN
      v_regras := v_sess.regras_congeladas;
      v_rules_source := 'session_frozen';
    END IF;
  END IF;

  -- Soma cobranças pagas de extras desta galeria (fonte única)
  SELECT COALESCE(SUM(valor), 0)::numeric,
         COALESCE(SUM(COALESCE(NULLIF(qtd_fotos, 0), 0)), 0)::int
    INTO v_valor_pago, v_extras_pagas
   FROM cobrancas
   WHERE galeria_id = p_gallery_id
     AND finalidade = 'fotos_extras'
     AND status IN ('pago', 'pago_manual');

  v_unit := public._extra_unit_price_for_quantity(v_regras, v_g.valor_foto_extra, v_extras_necess);
  v_ideal := ROUND((v_extras_necess * v_unit)::numeric, 2);
  v_a_cobrar := GREATEST(0, ROUND((v_ideal - v_valor_pago)::numeric, 2));

  RETURN jsonb_build_object(
    'success', true,
    'gallery_id', p_gallery_id,
    'user_id', v_g.user_id,
    'session_id', v_g.session_id,
    'selected_count', v_selected,
    'included_count', v_included,
    'extras_necessarias', v_extras_necess,
    'extras_pagas', v_extras_pagas,
    'valor_pago', v_valor_pago,
    'valor_unitario', v_unit,
    'valor_total_ideal', v_ideal,
    'valor_a_cobrar', v_a_cobrar,
    'rules_source', v_rules_source
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.calculate_gallery_extra_payment(uuid) TO authenticated, anon, service_role;

-- ---------- Endurecimento: tg_protect_no_overcharge usa regra congelada ----------
CREATE OR REPLACE FUNCTION public.tg_protect_no_overcharge()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_calc jsonb;
  v_pago numeric;
  v_ideal numeric;
  v_max numeric;
BEGIN
  IF NEW.galeria_id IS NULL OR COALESCE(NEW.valor, 0) <= 0 THEN
    RETURN NEW;
  END IF;
  IF NEW.finalidade IS DISTINCT FROM 'fotos_extras' THEN
    RETURN NEW;
  END IF;

  v_calc := public.calculate_gallery_extra_payment(NEW.galeria_id);
  IF (v_calc->>'success')::boolean IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  v_ideal := COALESCE((v_calc->>'valor_total_ideal')::numeric, 0);

  -- Soma cobranças pagas ATIVAS de outras cobranças
  SELECT COALESCE(SUM(valor), 0) INTO v_pago
    FROM cobrancas
   WHERE galeria_id = NEW.galeria_id
     AND finalidade = 'fotos_extras'
     AND status IN ('pago','pago_manual')
     AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  v_max := v_ideal;
  -- tolerância de 1 centavo para arredondamentos do gateway
  IF v_max > 0 AND (v_pago + NEW.valor) > v_max + 0.01 THEN
    RAISE EXCEPTION
      'Cobrança excederia o saldo devido pela regra congelada. Já pago=R$%, nova=R$%, máximo permitido=R$% (fonte: %)',
      v_pago, NEW.valor, v_max, v_calc->>'rules_source';
  END IF;

  RETURN NEW;
END;
$$;

-- ---------- Endurecimento: finalize_gallery_payment NÃO vincula órfãos ----------
-- A única rota para vincular cobrança órfã a galeria continua sendo:
--   public.claim_orphan_payment_for_gallery(p_cobranca_id, p_galeria_id)
-- finalize_gallery_payment passa a sincronizar galeria SOMENTE quando
-- finalidade='fotos_extras' E galeria_id já está preenchido.
CREATE OR REPLACE FUNCTION public.finalize_gallery_payment(
  p_cobranca_id uuid,
  p_receipt_url text DEFAULT NULL,
  p_paid_at timestamptz DEFAULT NULL,
  p_manual_method text DEFAULT NULL,
  p_manual_obs text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cobranca RECORD;
  v_galeria_id UUID;
  v_gallery_synced BOOLEAN := false;
  v_final_status TEXT;
  v_sum_qtd INT;
  v_sum_val NUMERIC;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_cobranca_id::text));

  SELECT * INTO v_cobranca FROM public.cobrancas WHERE id = p_cobranca_id FOR UPDATE;
  IF v_cobranca IS NULL THEN
    RETURN jsonb_build_object('success', false, 'already_paid', false, 'error', 'Cobranca nao encontrada');
  END IF;

  v_final_status := CASE WHEN p_manual_method IS NOT NULL THEN 'pago_manual' ELSE 'pago' END;

  -- ⚠️ REGRA NOVA: só consideramos galeria se a cobrança JÁ está marcada como fotos_extras
  -- e JÁ tem galeria_id. Não inferimos mais por session_id.
  IF v_cobranca.finalidade = 'fotos_extras' AND v_cobranca.galeria_id IS NOT NULL THEN
    v_galeria_id := v_cobranca.galeria_id;
  ELSE
    v_galeria_id := NULL;
  END IF;

  -- Caso 1: cobrança já estava paga — apenas re-sincroniza agregados se for de galeria
  IF v_cobranca.status IN ('pago','pago_manual') THEN
    IF v_galeria_id IS NOT NULL THEN
      SELECT GREATEST(COALESCE(g.fotos_selecionadas,0)
              - COALESCE(NULLIF(v_cobranca.snapshot_fotos_incluidas, 0), g.fotos_incluidas, 0), 0)
        INTO v_sum_qtd
        FROM public.galerias g WHERE g.id = v_galeria_id;

      SELECT COALESCE(SUM(valor),0)::numeric INTO v_sum_val
        FROM public.cobrancas
       WHERE galeria_id = v_galeria_id
         AND finalidade = 'fotos_extras'
         AND status IN ('pago','pago_manual');

      UPDATE public.galerias
         SET status = 'selecao_completa',
             total_fotos_extras_vendidas = v_sum_qtd,
             valor_total_vendido = v_sum_val,
             status_pagamento = v_cobranca.status,
             status_selecao = 'selecao_completa',
             finalized_at = COALESCE(finalized_at, v_cobranca.data_pagamento, now()),
             updated_at = now()
       WHERE id = v_galeria_id;

      UPDATE public.cobrancas SET extras_contabilizados = true
       WHERE id = p_cobranca_id AND extras_contabilizados IS NOT TRUE;

      v_gallery_synced := true;
    END IF;

    IF v_cobranca.visitor_id IS NOT NULL THEN
      UPDATE public.galeria_visitantes
         SET status = 'finalizado', status_selecao = 'selecao_completa',
             finalized_at = COALESCE(v_cobranca.data_pagamento, now()), updated_at = now()
       WHERE id = v_cobranca.visitor_id AND status <> 'finalizado';
    END IF;

    RETURN jsonb_build_object('success', true, 'already_paid', true,
      'gallery_synced', v_gallery_synced, 'galeria_id', v_galeria_id);
  END IF;

  -- Caso 2: marca como paga + sincroniza
  UPDATE public.cobrancas
     SET status = v_final_status,
         data_pagamento = COALESCE(p_paid_at, now()),
         ip_receipt_url = COALESCE(p_receipt_url, ip_receipt_url),
         obs_manual = COALESCE(p_manual_obs, obs_manual),
         updated_at = now()
   WHERE id = p_cobranca_id;

  IF v_galeria_id IS NOT NULL THEN
    SELECT GREATEST(COALESCE(g.fotos_selecionadas,0)
            - COALESCE(NULLIF(v_cobranca.snapshot_fotos_incluidas, 0), g.fotos_incluidas, 0), 0)
      INTO v_sum_qtd
      FROM public.galerias g WHERE g.id = v_galeria_id;

    SELECT COALESCE(SUM(valor),0)::numeric INTO v_sum_val
      FROM public.cobrancas
     WHERE galeria_id = v_galeria_id
       AND finalidade = 'fotos_extras'
       AND status IN ('pago','pago_manual');

    UPDATE public.galerias
       SET status = 'selecao_completa',
           total_fotos_extras_vendidas = v_sum_qtd,
           valor_total_vendido = v_sum_val,
           status_pagamento = v_final_status,
           status_selecao = 'selecao_completa',
           finalized_at = COALESCE(finalized_at, COALESCE(p_paid_at, now())),
           updated_at = now()
     WHERE id = v_galeria_id;

    UPDATE public.cobrancas SET extras_contabilizados = true
     WHERE id = p_cobranca_id AND extras_contabilizados IS NOT TRUE;

    v_gallery_synced := true;
  END IF;

  IF v_cobranca.visitor_id IS NOT NULL THEN
    UPDATE public.galeria_visitantes
       SET status = 'finalizado', status_selecao = 'selecao_completa',
           finalized_at = COALESCE(p_paid_at, now()), updated_at = now()
     WHERE id = v_cobranca.visitor_id AND status <> 'finalizado';
  END IF;

  RETURN jsonb_build_object('success', true, 'already_paid', false,
    'gallery_synced', v_gallery_synced, 'galeria_id', v_galeria_id);
END;
$$;

-- ============================================================
-- (d) HEALING — Galeria Clarissa Machado
-- ============================================================
-- Contexto:
--   galeria 523640bd-1ba2-456a-93d2-a16b8eaf11f2
--   cobrança e9083990-fab5-4953-afc7-7ae0706cf7b6 (R$125 pago, sem galeria)
--   regra correta: 5 extras x R$23 = R$115
--   cliente pagou R$10 a mais -> registrar overpayment
DO $$
DECLARE
  v_cob_id uuid := 'e9083990-fab5-4953-afc7-7ae0706cf7b6';
  v_gal_id uuid := '523640bd-1ba2-456a-93d2-a16b8eaf11f2';
  v_tx_id  uuid := '7fef963b-4497-41e8-b9ad-511db35f1b27';
  v_sess   text := 'workflow-1781641629524-pzxoid8zxnn';
  v_finalize jsonb;
  v_paid_at timestamptz;
BEGIN
  SELECT data_pagamento INTO v_paid_at FROM cobrancas WHERE id = v_cob_id;

  -- 1) Vincular a cobrança à galeria como fotos_extras
  UPDATE cobrancas
     SET galeria_id = v_gal_id,
         finalidade = 'fotos_extras',
         qtd_fotos = 5,
         snapshot_fotos_incluidas = 10,
         updated_at = now()
   WHERE id = v_cob_id;

  -- 2) Tirar session_id da transação (extras não pertencem à receita da sessão)
  UPDATE clientes_transacoes
     SET session_id = NULL,
         descricao = 'Pagamento InfinitePay [extras Clarissa Machado] (cobranca ' || v_cob_id::text || ') [healing]',
         updated_at = now()
   WHERE id = v_tx_id;

  -- 3) Sincronizar galeria via RPC canônica (idempotente)
  SELECT public.finalize_gallery_payment(
           v_cob_id,
           'https://recibo.infinitepay.io/5e7620da-7671-4b73-a7b5-55630c0e2f3a',
           v_paid_at,
           NULL, NULL)
    INTO v_finalize;

  RAISE NOTICE 'Healing Clarissa - finalize result: %', v_finalize;

  -- 4) Limpar imputação dos extras na sessão: receita pertence à galeria.
  --    Recompute_session_paid já roda via trigger ao UPDATE da transação acima.
  UPDATE clientes_sessoes
     SET qtd_fotos_extra = 0,
         valor_total_foto_extra = 0,
         status_pagamento_fotos_extra = 'pago',
         status_galeria = 'selecao_completa',
         updated_at = now()
   WHERE session_id = v_sess;

  -- 5) Auditar overpayment (R$10) para a fotógrafa decidir estorno/crédito
  INSERT INTO public.audit_log (action, actor_type, resource_type, resource_id, gallery_id, metadata)
  VALUES (
    'extras_overpayment_detected',
    'system',
    'cobranca',
    v_cob_id,
    v_gal_id,
    jsonb_build_object(
      'valor_pago_gateway', 125,
      'valor_ideal_pela_regra', 115,
      'diferenca', 10,
      'origem', 'healing_clarissa',
      'observacao', 'Cobrança criada pelo fluxo legacy sem finalidade/galeria_id; valor cobrado ignorou a faixa progressiva (4-7 = R$23). Após healing, galeria sincronizada como paga e R$10 fica como crédito a estornar/manter.'
    )
  );

  RAISE NOTICE 'Healing Clarissa concluído.';
END $$;
