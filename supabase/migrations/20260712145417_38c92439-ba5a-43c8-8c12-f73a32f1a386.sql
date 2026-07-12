
-- Fase 1: remove escrita em regras_congeladas de sync_gallery_extra_price_from_session
CREATE OR REPLACE FUNCTION public.sync_gallery_extra_price_from_session()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Propaga apenas a COLUNA valor_foto_extra da sessão para a galeria.
  -- NÃO mexe em regras_congeladas.pacote.valorFotoExtra — esse campo é
  -- imutável após dataCongelamento (guard_regras_congeladas_immutable) e
  -- reescrevê-lo aqui cria cascata circular sessão↔galeria que aborta
  -- o UPDATE original em confirm-selection após reabertura.
  IF NEW.galeria_id IS NOT NULL
     AND NEW.valor_foto_extra IS DISTINCT FROM OLD.valor_foto_extra
     AND COALESCE(NEW.valor_foto_extra, 0) > 0
     AND pg_trigger_depth() < 2 THEN
    UPDATE public.galerias
       SET valor_foto_extra = NEW.valor_foto_extra
     WHERE id = NEW.galeria_id
       AND COALESCE(valor_foto_extra, 0) IS DISTINCT FROM NEW.valor_foto_extra;
  END IF;
  RETURN NEW;
END;
$function$;

-- Fase 2: defesa em profundidade — sync_gallery_extras_to_session não reentra
CREATE OR REPLACE FUNCTION public.sync_gallery_extras_to_session()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_unit_frozen NUMERIC;
  v_unit_from_charges NUMERIC;
  v_unit_efetivo NUMERIC;
  v_extras_paid_sum NUMERIC;
  v_extras_paid_qtd INT;
  v_fotos_incluidas_mudou BOOLEAN;
  v_extras_mudou BOOLEAN;
  v_selecao_atualizou BOOLEAN;
  v_qtd_total INT;
BEGIN
  -- Guarda de reentrância: se já estamos dentro de outro trigger que
  -- disparou um UPDATE em galerias, não propagamos de novo.
  IF pg_trigger_depth() >= 2 THEN
    RETURN NEW;
  END IF;

  v_extras_mudou := (NEW.valor_foto_extra IS DISTINCT FROM OLD.valor_foto_extra)
                 OR (NEW.total_fotos_extras_vendidas IS DISTINCT FROM OLD.total_fotos_extras_vendidas)
                 OR (NEW.valor_total_vendido IS DISTINCT FROM OLD.valor_total_vendido);

  v_fotos_incluidas_mudou := (NEW.fotos_incluidas IS DISTINCT FROM OLD.fotos_incluidas);

  v_selecao_atualizou := (
    NEW.status = 'selecao_completa'
    AND (
      COALESCE(OLD.status, '') IS DISTINCT FROM 'selecao_completa'
      OR NEW.fotos_selecionadas IS DISTINCT FROM OLD.fotos_selecionadas
      OR NEW.fotos_incluidas IS DISTINCT FROM OLD.fotos_incluidas
    )
    AND COALESCE(NEW.fotos_selecionadas, 0) >= COALESCE(NEW.fotos_incluidas, 0)
  );

  IF v_extras_mudou OR v_selecao_atualizou THEN
    v_unit_frozen := NULLIF(
      (NEW.regras_congeladas->'pacote'->>'valorFotoExtraEfetivo')::numeric,
      0
    );

    SELECT
      COALESCE(SUM(COALESCE(valor_extras_componente, valor)), 0),
      COALESCE(SUM(qtd_fotos), 0)::int
      INTO v_extras_paid_sum, v_extras_paid_qtd
    FROM public.cobrancas
    WHERE galeria_id = NEW.id
      AND status IN ('pago','pago_manual')
      AND COALESCE(finalidade,'') IN ('fotos_extras','sessao_e_extras');

    v_unit_from_charges := CASE
      WHEN v_extras_paid_qtd > 0 AND v_extras_paid_sum > 0
      THEN ROUND((v_extras_paid_sum / v_extras_paid_qtd)::numeric, 2)
      ELSE NULL
    END;

    v_unit_efetivo := COALESCE(
      v_unit_frozen,
      v_unit_from_charges,
      ROUND(LEAST(GREATEST(COALESCE(NEW.valor_foto_extra, 0), 0), 999.99)::numeric, 2)
    );

    v_qtd_total := COALESCE(NEW.total_fotos_extras_vendidas, 0);
    IF NEW.status = 'selecao_completa' THEN
      v_qtd_total := GREATEST(
        v_qtd_total,
        COALESCE(NEW.fotos_selecionadas, 0) - COALESCE(NEW.fotos_incluidas, 0)
      );
    END IF;

    UPDATE public.clientes_sessoes s
    SET
      valor_foto_extra = v_unit_efetivo,
      qtd_fotos_extra = v_qtd_total,
      valor_total_foto_extra = ROUND((v_qtd_total * v_unit_efetivo)::numeric, 2),
      updated_at = now()
    WHERE s.galeria_id = NEW.id
      AND COALESCE(s.extras_overridden, false) = false
      AND (
        s.valor_foto_extra IS DISTINCT FROM v_unit_efetivo
        OR s.qtd_fotos_extra IS DISTINCT FROM v_qtd_total
        OR s.valor_total_foto_extra IS DISTINCT FROM ROUND((v_qtd_total * v_unit_efetivo)::numeric, 2)
      );
  END IF;

  IF v_fotos_incluidas_mudou THEN
    IF NEW.regras_congeladas IS NOT NULL
       AND jsonb_typeof(NEW.regras_congeladas->'pacote') = 'object'
       AND pg_trigger_depth() < 2 THEN
      UPDATE public.galerias g
      SET regras_congeladas = jsonb_set(
            NEW.regras_congeladas,
            '{pacote,fotosIncluidas}',
            to_jsonb(NEW.fotos_incluidas),
            true
          )
      WHERE g.id = NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Fase 3: backfill de valorFotoExtraEfetivo em galerias/sessões congeladas
-- sem esse campo. Autoriza override pontual porque o guard rejeita
-- adicionar campo quando dataCongelamento existe.
DO $$
DECLARE
  r RECORD;
  v_unit numeric;
BEGIN
  PERFORM set_config('app.allow_frozen_rules_override', 'true', true);

  -- Galerias
  FOR r IN
    SELECT id,
           COALESCE((regras_congeladas->'pacote'->>'valorFotoExtra')::numeric, valor_foto_extra, 0) AS unit
      FROM public.galerias
     WHERE regras_congeladas IS NOT NULL
       AND jsonb_typeof(regras_congeladas->'pacote') = 'object'
       AND (regras_congeladas->'pacote'->>'valorFotoExtraEfetivo') IS NULL
       AND (regras_congeladas->>'dataCongelamento') IS NOT NULL
  LOOP
    v_unit := ROUND(GREATEST(COALESCE(r.unit, 0), 0)::numeric, 2);
    UPDATE public.galerias
       SET regras_congeladas = jsonb_set(
             regras_congeladas,
             '{pacote,valorFotoExtraEfetivo}',
             to_jsonb(v_unit),
             true
           )
     WHERE id = r.id;
  END LOOP;

  -- Sessões
  FOR r IN
    SELECT id,
           COALESCE((regras_congeladas->'pacote'->>'valorFotoExtra')::numeric, valor_foto_extra, 0) AS unit
      FROM public.clientes_sessoes
     WHERE regras_congeladas IS NOT NULL
       AND jsonb_typeof(regras_congeladas->'pacote') = 'object'
       AND (regras_congeladas->'pacote'->>'valorFotoExtraEfetivo') IS NULL
       AND (regras_congeladas->>'dataCongelamento') IS NOT NULL
  LOOP
    v_unit := ROUND(GREATEST(COALESCE(r.unit, 0), 0)::numeric, 2);
    UPDATE public.clientes_sessoes
       SET regras_congeladas = jsonb_set(
             regras_congeladas,
             '{pacote,valorFotoExtraEfetivo}',
             to_jsonb(v_unit),
             true
           )
     WHERE id = r.id;
  END LOOP;

  PERFORM set_config('app.allow_frozen_rules_override', 'false', true);
END $$;
