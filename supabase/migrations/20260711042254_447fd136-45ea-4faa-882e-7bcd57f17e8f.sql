DROP FUNCTION IF EXISTS public.calculate_gallery_extra_payment(uuid) CASCADE;

CREATE OR REPLACE FUNCTION public.calculate_gallery_extra_payment(
  p_gallery_id uuid,
  p_bypass_pre_selecao_gate boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_g RECORD;
  v_regras jsonb;
  v_rules_source text := 'gallery_fixed';
  v_sess RECORD;
  v_selected int := 0;
  v_included int := 0;
  v_charge_type text := 'only_extras';
  v_extras_necess int := 0;
  v_extras_pagas int := 0;
  v_extras_a_cobrar int := 0;
  v_valor_pago numeric := 0;
  v_unit numeric := 0;
  v_ideal numeric := 0;
  v_a_cobrar numeric := 0;
  v_is_fully_paid boolean := false;
  v_sess_base numeric := 0;
  v_sess_adic numeric := 0;
  v_sess_desc numeric := 0;
  v_sess_prod numeric := 0;
  v_excedente numeric := 0;
  v_ideal_liq numeric := 0;
  v_has_paid boolean := false;
  v_pre_selecao boolean := false;
BEGIN
  SELECT id, user_id, fotos_incluidas, fotos_selecionadas,
         valor_foto_extra, regras_congeladas, session_id,
         total_fotos_extras_vendidas, valor_total_vendido,
         venda_tipo_cobranca, configuracoes, status
  INTO v_g FROM galerias WHERE id = p_gallery_id;
  IF v_g IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'GALLERY_NOT_FOUND');
  END IF;

  -- Gate pré-seleção (apenas para caminhos de LEITURA):
  -- Se galeria ainda não finalizou seleção e não tem cobrança paga,
  -- não retornar extras a cobrar. `p_bypass_pre_selecao_gate=true` desativa o gate
  -- e é usado exclusivamente por `confirm-selection` no momento canônico da
  -- transição selecao_iniciada -> selecao_completa.
  IF NOT p_bypass_pre_selecao_gate
     AND v_g.status IN ('rascunho','enviado','selecao_iniciada') THEN
    SELECT EXISTS (
      SELECT 1 FROM public.cobrancas c
       WHERE c.galeria_id = p_gallery_id
         AND c.finalidade IN ('fotos_extras','sessao_e_extras')
         AND c.status IN ('pago','pago_manual')
    ) INTO v_has_paid;
    IF NOT v_has_paid THEN
      v_pre_selecao := true;
    END IF;
  END IF;

  IF v_pre_selecao THEN
    RETURN jsonb_build_object(
      'success', true,
      'gallery_id', p_gallery_id,
      'user_id', v_g.user_id,
      'session_id', v_g.session_id,
      'charge_type', 'only_extras',
      'selected_count', COALESCE(v_g.fotos_selecionadas, 0),
      'included_count', COALESCE(v_g.fotos_incluidas, 0),
      'extras_necessarias', 0,
      'extras_pagas', 0,
      'extras_a_cobrar', 0,
      'valor_pago', 0,
      'valor_unitario', COALESCE(v_g.valor_foto_extra, 0),
      'valor_total_ideal', 0,
      'valor_total_ideal_bruto', 0,
      'valor_a_cobrar', 0,
      'is_fully_paid', true,
      'rules_source', 'pre_selecao_gate',
      'desconto_sessao_excedente', 0,
      'pre_selecao', true
    );
  END IF;

  v_selected := COALESCE(v_g.fotos_selecionadas, 0);
  v_included := COALESCE(v_g.fotos_incluidas, 0);

  v_charge_type := COALESCE(
    v_g.venda_tipo_cobranca,
    NULLIF(v_g.configuracoes->'saleSettings'->>'chargeType', ''),
    'only_extras'
  );
  IF v_charge_type NOT IN ('all_selected','only_extras') THEN
    v_charge_type := 'only_extras';
  END IF;

  IF v_charge_type = 'all_selected' THEN
    v_extras_necess := v_selected;
  ELSE
    v_extras_necess := GREATEST(0, v_selected - v_included);
  END IF;

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

  SELECT
    COALESCE(SUM(
      CASE finalidade
        WHEN 'fotos_extras'    THEN valor
        WHEN 'sessao_e_extras' THEN COALESCE(valor_extras_componente, 0)
        ELSE 0
      END
    ), 0)::numeric,
    COALESCE(SUM(COALESCE(NULLIF(qtd_fotos, 0), 0)), 0)::int
    INTO v_valor_pago, v_extras_pagas
   FROM cobrancas
   WHERE galeria_id = p_gallery_id
     AND finalidade IN ('fotos_extras','sessao_e_extras')
     AND status IN ('pago', 'pago_manual');

  v_extras_a_cobrar := GREATEST(0, v_extras_necess - v_extras_pagas);

  v_unit  := public._extra_unit_price_for_quantity(v_regras, v_g.valor_foto_extra, v_extras_necess);
  v_ideal := ROUND((v_extras_necess * v_unit)::numeric, 2);

  IF v_g.session_id IS NOT NULL THEN
    SELECT s.valor_base_pacote, s.valor_adicional, s.desconto, s.produtos_incluidos
      INTO v_sess
      FROM clientes_sessoes s
     WHERE s.session_id = v_g.session_id
     LIMIT 1;

    v_sess_base := COALESCE(v_sess.valor_base_pacote, 0);
    v_sess_adic := COALESCE(v_sess.valor_adicional, 0);
    v_sess_desc := COALESCE(v_sess.desconto, 0);

    IF v_sess.produtos_incluidos IS NOT NULL
       AND jsonb_typeof(v_sess.produtos_incluidos) = 'array' THEN
      SELECT COALESCE(SUM(
               CASE WHEN p->>'tipo' = 'manual'
                    THEN COALESCE((p->>'quantidade')::numeric,0)
                         * COALESCE((p->>'valorUnitario')::numeric,0)
                    ELSE 0 END
             ), 0)
        INTO v_sess_prod
        FROM jsonb_array_elements(v_sess.produtos_incluidos) p;
    END IF;

    v_excedente := GREATEST(0, v_sess_desc - (v_sess_base + v_sess_adic + v_sess_prod));
    v_excedente := LEAST(v_excedente, v_ideal);
  END IF;

  v_ideal_liq := GREATEST(0, ROUND((v_ideal - v_excedente)::numeric, 2));
  v_a_cobrar  := GREATEST(0, ROUND((v_ideal_liq - v_valor_pago)::numeric, 2));

  v_is_fully_paid := (v_a_cobrar <= 0);

  RETURN jsonb_build_object(
    'success', true,
    'gallery_id', p_gallery_id,
    'user_id', v_g.user_id,
    'session_id', v_g.session_id,
    'charge_type', v_charge_type,
    'selected_count', v_selected,
    'included_count', v_included,
    'extras_necessarias', v_extras_necess,
    'extras_pagas', v_extras_pagas,
    'extras_a_cobrar', v_extras_a_cobrar,
    'valor_pago', v_valor_pago,
    'valor_unitario', v_unit,
    'valor_total_ideal', v_ideal_liq,
    'valor_total_ideal_bruto', v_ideal,
    'valor_a_cobrar', v_a_cobrar,
    'is_fully_paid', v_is_fully_paid,
    'rules_source', v_rules_source,
    'desconto_sessao_excedente', v_excedente,
    'pre_selecao', false
  );
END;
$function$;