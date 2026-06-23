
-- Recria sync BEFORE: junção correta por session_id (text) em ambos os lados,
-- preservando gate de regras_override.
CREATE OR REPLACE FUNCTION public.sync_galeria_regras_from_session()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_regras jsonb;
BEGIN
  IF NEW.session_id IS NOT NULL
     AND COALESCE(NEW.regras_override, false) = false
     AND NEW.regras_congeladas IS NULL
  THEN
    SELECT cs.regras_congeladas
      INTO v_session_regras
      FROM public.clientes_sessoes cs
     WHERE cs.session_id = NEW.session_id   -- text = text
     LIMIT 1;

    IF v_session_regras IS NOT NULL THEN
      NEW.regras_congeladas := v_session_regras;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Recria propagate AFTER: junção por session_id (text), preservando gate de override.
CREATE OR REPLACE FUNCTION public.propagate_session_regras_to_galerias()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.regras_congeladas IS DISTINCT FROM OLD.regras_congeladas THEN
    UPDATE public.galerias
       SET regras_congeladas = NEW.regras_congeladas
     WHERE session_id = NEW.session_id     -- text = text
       AND COALESCE(regras_override, false) = false;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sync_galeria_regras_from_session() IS
  'JOIN obrigatório por clientes_sessoes.session_id (text) = galerias.session_id (text). NUNCA usar clientes_sessoes.id (uuid) — quebra INSERT com erro 42883 (uuid = text). Respeita galerias.regras_override.';

COMMENT ON FUNCTION public.propagate_session_regras_to_galerias() IS
  'JOIN obrigatório por galerias.session_id (text) = clientes_sessoes.session_id (text). NUNCA usar clientes_sessoes.id (uuid). Não propaga para galerias com regras_override = true.';
