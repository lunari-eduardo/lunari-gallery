-- =========================================================================
-- 1) Reescreve a função do trigger para também patchear o JSONB regras_congeladas
--    (na sessão E na própria galeria), aplicando clamp 0..999.99
-- =========================================================================
CREATE OR REPLACE FUNCTION public.sync_gallery_extras_to_session()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_clamped numeric;
BEGIN
  IF (NEW.valor_foto_extra IS DISTINCT FROM OLD.valor_foto_extra)
     OR (NEW.total_fotos_extras_vendidas IS DISTINCT FROM OLD.total_fotos_extras_vendidas)
     OR (NEW.valor_total_vendido IS DISTINCT FROM OLD.valor_total_vendido) THEN

    -- Sanitiza valor (espelho de sanitizeExtraPrice no front: clamp 0..999.99 com 2 casas)
    v_clamped := ROUND(LEAST(GREATEST(COALESCE(NEW.valor_foto_extra, 0), 0), 999.99)::numeric, 2);

    -- 1.a Atualiza a sessão vinculada (campo escalar + JSONB de regras)
    UPDATE public.clientes_sessoes s
    SET
      valor_foto_extra = v_clamped,
      qtd_fotos_extra = COALESCE(NEW.total_fotos_extras_vendidas, 0),
      valor_total_foto_extra = COALESCE(NEW.valor_total_vendido, 0),
      regras_congeladas = CASE
        WHEN s.regras_congeladas IS NOT NULL
             AND jsonb_typeof(s.regras_congeladas->'pacote') = 'object'
        THEN jsonb_set(
               s.regras_congeladas,
               '{pacote,valorFotoExtra}',
               to_jsonb(v_clamped),
               true
             )
        ELSE s.regras_congeladas
      END,
      updated_at = now()
    WHERE s.galeria_id = NEW.id
      AND (
        s.valor_foto_extra IS DISTINCT FROM v_clamped
        OR s.qtd_fotos_extra IS DISTINCT FROM COALESCE(NEW.total_fotos_extras_vendidas, 0)
        OR s.valor_total_foto_extra IS DISTINCT FROM COALESCE(NEW.valor_total_vendido, 0)
        OR (
          s.regras_congeladas IS NOT NULL
          AND jsonb_typeof(s.regras_congeladas->'pacote') = 'object'
          AND COALESCE((s.regras_congeladas->'pacote'->>'valorFotoExtra')::numeric, -1) IS DISTINCT FROM v_clamped
        )
      );

    -- 1.b Patcha o JSONB da própria galeria (se existir o caminho pacote)
    --     Evita recursão usando pg_trigger_depth() < 2 e só atualizando o JSONB,
    --     não o campo valor_foto_extra (que dispara este trigger).
    IF NEW.regras_congeladas IS NOT NULL
       AND jsonb_typeof(NEW.regras_congeladas->'pacote') = 'object'
       AND COALESCE((NEW.regras_congeladas->'pacote'->>'valorFotoExtra')::numeric, -1) IS DISTINCT FROM v_clamped
       AND pg_trigger_depth() < 2 THEN
      UPDATE public.galerias g
      SET regras_congeladas = jsonb_set(
            NEW.regras_congeladas,
            '{pacote,valorFotoExtra}',
            to_jsonb(v_clamped),
            true
          )
      WHERE g.id = NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- =========================================================================
-- 2) Backfill (one-shot) — corrige divergências históricas
-- =========================================================================

-- 2.a Primeiro, sanitiza o JSONB da própria galeria quando estiver divergente
--     do valor escalar `galerias.valor_foto_extra` (caso "Huimi Loreto" = 2550).
--     A galeria é a fonte de verdade do valor escalar; o JSONB é alinhado a ela.
UPDATE public.galerias g
SET regras_congeladas = jsonb_set(
      g.regras_congeladas,
      '{pacote,valorFotoExtra}',
      to_jsonb(ROUND(LEAST(GREATEST(COALESCE(g.valor_foto_extra, 0), 0), 999.99)::numeric, 2)),
      true
    )
WHERE g.regras_congeladas IS NOT NULL
  AND jsonb_typeof(g.regras_congeladas->'pacote') = 'object'
  AND COALESCE((g.regras_congeladas->'pacote'->>'valorFotoExtra')::numeric, -1)
      IS DISTINCT FROM ROUND(LEAST(GREATEST(COALESCE(g.valor_foto_extra, 0), 0), 999.99)::numeric, 2);

-- 2.b Sincroniza `clientes_sessoes` com o valor saneado da galeria:
--     - clientes_sessoes.valor_foto_extra
--     - clientes_sessoes.regras_congeladas.pacote.valorFotoExtra
--     Faz match preferencialmente por session_id (string do workflow), com
--     fallback por galeria_id (caso a sessão tenha sido vinculada por id).
UPDATE public.clientes_sessoes s
SET
  valor_foto_extra = ROUND(LEAST(GREATEST(COALESCE(g.valor_foto_extra, 0), 0), 999.99)::numeric, 2),
  regras_congeladas = CASE
    WHEN s.regras_congeladas IS NOT NULL
         AND jsonb_typeof(s.regras_congeladas->'pacote') = 'object'
    THEN jsonb_set(
           s.regras_congeladas,
           '{pacote,valorFotoExtra}',
           to_jsonb(ROUND(LEAST(GREATEST(COALESCE(g.valor_foto_extra, 0), 0), 999.99)::numeric, 2)),
           true
         )
    ELSE s.regras_congeladas
  END,
  updated_at = now()
FROM public.galerias g
WHERE (s.galeria_id = g.id OR (s.session_id IS NOT NULL AND s.session_id = g.session_id))
  AND g.valor_foto_extra IS NOT NULL
  AND (
    s.valor_foto_extra IS DISTINCT FROM ROUND(LEAST(GREATEST(g.valor_foto_extra, 0), 999.99)::numeric, 2)
    OR (
      s.regras_congeladas IS NOT NULL
      AND jsonb_typeof(s.regras_congeladas->'pacote') = 'object'
      AND COALESCE((s.regras_congeladas->'pacote'->>'valorFotoExtra')::numeric, -1)
          IS DISTINCT FROM ROUND(LEAST(GREATEST(g.valor_foto_extra, 0), 999.99)::numeric, 2)
    )
  );