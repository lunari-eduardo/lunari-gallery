
-- Blindagem final do vínculo cobrança↔galeria (Raiz A do bug do JFkdA0svNBN4)
-- 1. Trigger reescrita: NUNCA rebaixar 'fotos_extras', auto-vincular quando session_id apontar para galeria finalizada com valor compatível.

CREATE OR REPLACE FUNCTION public.tg_classify_cobranca_finalidade()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_gallery RECORD;
BEGIN
  -- Regra 1: galeria_id explícito => sempre fotos_extras (proteção absoluta).
  IF NEW.galeria_id IS NOT NULL THEN
    NEW.finalidade := 'fotos_extras';
    RETURN NEW;
  END IF;

  -- Regra 2: emissor já declarou fotos_extras mas esqueceu galeria_id.
  -- Tenta auto-vincular pelo session_id (única fonte confiável do Gestão).
  IF NEW.finalidade = 'fotos_extras' AND NEW.session_id IS NOT NULL THEN
    SELECT id, valor_extras, valor_foto_extra, user_id
      INTO v_gallery
      FROM galerias
      WHERE session_id = NEW.session_id
        AND user_id = NEW.user_id
        AND finalized_at IS NOT NULL
      ORDER BY finalized_at DESC
      LIMIT 1;
    IF v_gallery.id IS NOT NULL THEN
      NEW.galeria_id := v_gallery.id;
      RETURN NEW;
    END IF;
  END IF;

  -- Regra 3: sem galeria_id, sem finalidade explícita => default histórico.
  IF NEW.finalidade IS NULL THEN
    NEW.finalidade := 'sessao';
  END IF;
  RETURN NEW;
END;
$function$;

-- 2. Backfill defensivo: cobranças pendentes recentes órfãs cujo session_id
-- mapeia para galeria finalizada com valor compatível => auto-vincular.
UPDATE public.cobrancas c
   SET galeria_id = g.id,
       finalidade = 'fotos_extras'
  FROM public.galerias g
 WHERE c.galeria_id IS NULL
   AND c.session_id = g.session_id
   AND c.user_id = g.user_id
   AND g.finalized_at IS NOT NULL
   AND c.status IN ('pendente','aguardando_confirmacao')
   AND ROUND(c.valor::numeric, 2) = ROUND(COALESCE(g.valor_extras,0)::numeric, 2)
   AND c.created_at > now() - interval '30 days';
