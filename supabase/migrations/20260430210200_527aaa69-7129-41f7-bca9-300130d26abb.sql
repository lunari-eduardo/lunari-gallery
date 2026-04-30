-- Estende o trigger sync_gallery_extras_to_session para também propagar
-- mudanças em fotos_incluidas para regras_congeladas.pacote.fotosIncluidas
-- na sessão vinculada (clientes_sessoes), permitindo overrides locais sem
-- quebrar contadores de pagamentos já realizados.

CREATE OR REPLACE FUNCTION public.sync_gallery_extras_to_session()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_unit_efetivo NUMERIC;
  v_unit_base NUMERIC;
  v_fotos_incluidas_mudou BOOLEAN;
  v_extras_mudou BOOLEAN;
BEGIN
  v_extras_mudou := (NEW.valor_foto_extra IS DISTINCT FROM OLD.valor_foto_extra)
                 OR (NEW.total_fotos_extras_vendidas IS DISTINCT FROM OLD.total_fotos_extras_vendidas)
                 OR (NEW.valor_total_vendido IS DISTINCT FROM OLD.valor_total_vendido);

  v_fotos_incluidas_mudou := (NEW.fotos_incluidas IS DISTINCT FROM OLD.fotos_incluidas);

  IF v_extras_mudou THEN
    -- Sanitiza valor base
    v_unit_base := ROUND(LEAST(GREATEST(COALESCE(NEW.valor_foto_extra, 0), 0), 999.99)::numeric, 2);

    -- Calcula preço unitário EFETIVO (com desconto progressivo)
    v_unit_efetivo := CASE
      WHEN COALESCE(NEW.total_fotos_extras_vendidas, 0) > 0
           AND COALESCE(NEW.valor_total_vendido, 0) > 0
      THEN ROUND((NEW.valor_total_vendido / NEW.total_fotos_extras_vendidas)::numeric, 2)
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

    -- Patch JSONB da própria galeria com preço base (preserva auditoria)
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

  -- Sincroniza fotos_incluidas (override local na galeria → sessão)
  -- Não toca em contadores de pagamento. Patcheia regras_congeladas.pacote.fotosIncluidas
  -- tanto na galeria quanto na sessão vinculada.
  IF v_fotos_incluidas_mudou THEN
    -- Patch JSONB da galeria
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

    -- Patch JSONB da sessão vinculada
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