
CREATE OR REPLACE FUNCTION public.tg_classify_cobranca_finalidade()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_gallery_id UUID;
BEGIN
  IF NEW.galeria_id IS NOT NULL THEN
    NEW.finalidade := 'fotos_extras';
    RETURN NEW;
  END IF;

  IF NEW.session_id IS NOT NULL AND NEW.user_id IS NOT NULL
     AND COALESCE(NEW.tipo_cobranca,'') NOT IN ('pacote','plano','assinatura')
  THEN
    SELECT id INTO v_gallery_id
      FROM public.galerias
     WHERE session_id = NEW.session_id
       AND user_id = NEW.user_id
     ORDER BY (finalized_at IS NOT NULL) DESC, updated_at DESC
     LIMIT 1;

    IF v_gallery_id IS NOT NULL THEN
      NEW.galeria_id := v_gallery_id;
      NEW.finalidade := 'fotos_extras';
      RETURN NEW;
    END IF;
  END IF;

  IF NEW.finalidade IS NULL THEN
    NEW.finalidade := 'sessao';
  END IF;
  RETURN NEW;
END;
$function$;


CREATE OR REPLACE FUNCTION public.sync_gallery_on_cobranca_paid()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_galeria_id uuid;
BEGIN
  IF NEW.status NOT IN ('pago','pago_manual') THEN RETURN NEW; END IF;
  IF OLD.status IN ('pago','pago_manual') THEN RETURN NEW; END IF;

  IF COALESCE(NEW.tipo_cobranca,'') IN ('pacote','plano','assinatura') THEN
    RETURN NEW;
  END IF;

  IF NEW.galeria_id IS NULL AND NEW.session_id IS NOT NULL AND NEW.user_id IS NOT NULL THEN
    SELECT id INTO v_galeria_id
      FROM public.galerias
     WHERE session_id = NEW.session_id
       AND user_id = NEW.user_id
     ORDER BY (finalized_at IS NOT NULL) DESC, updated_at DESC
     LIMIT 1;
    IF v_galeria_id IS NOT NULL THEN
      NEW.galeria_id := v_galeria_id;
      NEW.finalidade := 'fotos_extras';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;


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
  v_sum_qtd INT;
  v_sum_val NUMERIC;
  v_inferred_qtd INT;
  v_unit NUMERIC;
  v_match TEXT[];
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_cobranca_id::text));

  SELECT * INTO v_cobranca FROM public.cobrancas WHERE id = p_cobranca_id FOR UPDATE;
  IF v_cobranca IS NULL THEN
    RETURN jsonb_build_object('success', false, 'already_paid', false, 'error', 'Cobranca nao encontrada');
  END IF;

  v_final_status := CASE WHEN p_manual_method IS NOT NULL THEN 'pago_manual' ELSE 'pago' END;

  IF v_cobranca.finalidade = 'fotos_extras' AND v_cobranca.galeria_id IS NOT NULL THEN
    v_galeria_id := v_cobranca.galeria_id;
  ELSIF v_cobranca.session_id IS NOT NULL AND v_cobranca.user_id IS NOT NULL
        AND COALESCE(v_cobranca.tipo_cobranca,'') NOT IN ('pacote','plano','assinatura')
  THEN
    SELECT id INTO v_galeria_id
      FROM public.galerias
     WHERE session_id = v_cobranca.session_id
       AND user_id = v_cobranca.user_id
     ORDER BY (finalized_at IS NOT NULL) DESC, updated_at DESC
     LIMIT 1;

    IF v_galeria_id IS NOT NULL THEN
      IF COALESCE(v_cobranca.qtd_fotos, 0) <= 0 AND COALESCE(v_cobranca.valor,0) > 0 THEN
        v_match := regexp_match(COALESCE(v_cobranca.descricao,''), '(\d+)\s*foto', 'i');
        IF v_match IS NOT NULL THEN
          v_inferred_qtd := (v_match[1])::INT;
        END IF;
        IF v_inferred_qtd IS NULL OR v_inferred_qtd = 0 THEN
          SELECT NULLIF(valor_foto_extra, 0) INTO v_unit FROM public.galerias WHERE id = v_galeria_id;
          IF v_unit IS NOT NULL AND v_unit > 0
             AND ABS(v_cobranca.valor - ROUND(v_cobranca.valor / v_unit) * v_unit) < 0.02 THEN
            v_inferred_qtd := ROUND(v_cobranca.valor / v_unit)::INT;
          END IF;
        END IF;
      END IF;

      UPDATE public.cobrancas
         SET galeria_id = v_galeria_id,
             finalidade = 'fotos_extras',
             qtd_fotos = COALESCE(NULLIF(qtd_fotos, 0), v_inferred_qtd, qtd_fotos),
             updated_at = now()
       WHERE id = p_cobranca_id;
      SELECT * INTO v_cobranca FROM public.cobrancas WHERE id = p_cobranca_id;
    ELSE
      v_galeria_id := NULL;
    END IF;
  ELSE
    v_galeria_id := NULL;
  END IF;

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
$function$;


DO $heal$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.id
      FROM public.cobrancas c
     WHERE c.status IN ('pago','pago_manual')
       AND c.session_id IS NOT NULL
       AND c.user_id IS NOT NULL
       AND COALESCE(c.tipo_cobranca,'') NOT IN ('pacote','plano','assinatura')
       AND EXISTS (
         SELECT 1 FROM public.galerias g
          WHERE g.session_id = c.session_id
            AND g.user_id = c.user_id
            AND (
              g.status_pagamento NOT IN ('pago','pago_manual')
              OR COALESCE(g.total_fotos_extras_vendidas,0) = 0
              OR c.galeria_id IS NULL
              OR c.extras_contabilizados IS NOT TRUE
            )
       )
  LOOP
    BEGIN
      PERFORM public.finalize_gallery_payment(r.id, NULL, NULL);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'heal falhou para cobranca %: %', r.id, SQLERRM;
    END;
  END LOOP;
END;
$heal$;
