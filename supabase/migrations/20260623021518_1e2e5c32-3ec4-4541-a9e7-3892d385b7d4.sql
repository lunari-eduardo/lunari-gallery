
-- 1) Trigger: copiar regras_congeladas da sessão quando a galeria é criada/vinculada
CREATE OR REPLACE FUNCTION public.sync_galeria_regras_from_session()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_regras jsonb;
BEGIN
  -- Só age quando há session_id e a galeria não tem regras próprias
  IF NEW.session_id IS NOT NULL AND NEW.regras_congeladas IS NULL THEN
    SELECT cs.regras_congeladas
      INTO v_session_regras
    FROM public.clientes_sessoes cs
    WHERE cs.session_id = NEW.session_id
    LIMIT 1;

    IF v_session_regras IS NOT NULL THEN
      NEW.regras_congeladas := v_session_regras;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_galeria_sync_regras_from_session ON public.galerias;
CREATE TRIGGER trg_galeria_sync_regras_from_session
BEFORE INSERT OR UPDATE OF session_id, regras_congeladas
ON public.galerias
FOR EACH ROW
EXECUTE FUNCTION public.sync_galeria_regras_from_session();

-- 2) Trigger: propagar mudanças de regras da sessão para galerias vinculadas
CREATE OR REPLACE FUNCTION public.propagate_session_regras_to_galerias()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.regras_congeladas IS DISTINCT FROM OLD.regras_congeladas
     AND NEW.regras_congeladas IS NOT NULL
     AND NEW.session_id IS NOT NULL THEN
    -- Só atualiza galerias que ainda não têm regras próprias
    -- (preserva galerias standalone que congelaram regras ao serem criadas)
    UPDATE public.galerias
       SET regras_congeladas = NEW.regras_congeladas
     WHERE session_id = NEW.session_id
       AND regras_congeladas IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_session_propagate_regras ON public.clientes_sessoes;
CREATE TRIGGER trg_session_propagate_regras
AFTER UPDATE OF regras_congeladas
ON public.clientes_sessoes
FOR EACH ROW
EXECUTE FUNCTION public.propagate_session_regras_to_galerias();

-- 3) Backfill único: corrige galerias Studio existentes sem regras_congeladas
UPDATE public.galerias g
SET regras_congeladas = cs.regras_congeladas
FROM public.clientes_sessoes cs
WHERE g.session_id = cs.session_id
  AND g.regras_congeladas IS NULL
  AND cs.regras_congeladas IS NOT NULL;
