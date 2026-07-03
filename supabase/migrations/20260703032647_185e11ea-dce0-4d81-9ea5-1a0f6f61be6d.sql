CREATE OR REPLACE FUNCTION public.calculate_gallery_extra_payment(p_gallery_id uuid)
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
BEGIN
  SELECT id, user_id, fotos_incluidas, fotos_selecionadas,
         valor_foto_extra, regras_congeladas, session_id,
         total_fotos_extras_vendidas, valor_total_vendido,
         venda_tipo_cobranca, configuracoes
  INTO v_g FROM galerias WHERE id = p_gallery_id;
  IF v_g IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'GALLERY_NOT_FOUND');
  END IF;

  v_selected := COALESCE(v_g.fotos_selecionadas, 0);
  v_included := COALESCE(v_g.fotos_incluidas, 0);

  -- Charge type: coluna explicit > JSON saleSettings > default only_extras
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

  -- Soma cobranças pagas de extras desta galeria (fonte única)
  SELECT COALESCE(SUM(valor), 0)::numeric,
         COALESCE(SUM(COALESCE(NULLIF(qtd_fotos, 0), 0)), 0)::int
    INTO v_valor_pago, v_extras_pagas
   FROM cobrancas
   WHERE galeria_id = p_gallery_id
     AND finalidade = 'fotos_extras'
     AND status IN ('pago', 'pago_manual');

  v_extras_a_cobrar := GREATEST(0, v_extras_necess - v_extras_pagas);

  v_unit := public._extra_unit_price_for_quantity(v_regras, v_g.valor_foto_extra, v_extras_necess);
  v_ideal := ROUND((v_extras_necess * v_unit)::numeric, 2);
  v_a_cobrar := GREATEST(0, ROUND((v_ideal - v_valor_pago)::numeric, 2));

  -- Está totalmente quitado quando não há saldo E há pelo menos um extra necessário
  -- OU quando não há extras necessários (nada a cobrar por definição).
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
    'valor_total_ideal', v_ideal,
    'valor_a_cobrar', v_a_cobrar,
    'is_fully_paid', v_is_fully_paid,
    'rules_source', v_rules_source
  );
END;
$function$;