-- Adiciona coluna regras_override em galerias para permitir override por galeria
-- mesmo quando vinculada a uma sessão do Lunari Studio.
ALTER TABLE public.galerias
  ADD COLUMN IF NOT EXISTS regras_override boolean NOT NULL DEFAULT false;

-- Atualiza trigger BEFORE INSERT/UPDATE: só copia regras da sessão quando NÃO há override.
CREATE OR REPLACE FUNCTION public.sync_galeria_regras_from_session()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_regras jsonb;
BEGIN
  -- Só age quando há sessão vinculada, override não está ativo e galeria ainda não tem regras próprias.
  IF NEW.session_id IS NOT NULL
     AND COALESCE(NEW.regras_override, false) = false
     AND NEW.regras_congeladas IS NULL
  THEN
    SELECT regras_congeladas
      INTO v_session_regras
      FROM public.clientes_sessoes
     WHERE id = NEW.session_id;

    IF v_session_regras IS NOT NULL THEN
      NEW.regras_congeladas := v_session_regras;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Atualiza trigger AFTER UPDATE em clientes_sessoes: NÃO sobrescreve galerias com override.
CREATE OR REPLACE FUNCTION public.propagate_session_regras_to_galerias()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.regras_congeladas IS DISTINCT FROM OLD.regras_congeladas THEN
    UPDATE public.galerias
       SET regras_congeladas = NEW.regras_congeladas
     WHERE session_id = NEW.id
       AND COALESCE(regras_override, false) = false;
  END IF;
  RETURN NEW;
END;
$$;