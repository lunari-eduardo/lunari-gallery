-- Compatibiliza audit_log com o contrato do Gestão (2026-07-11).
-- Três funções do Gestão inserem user_id em public.audit_log, mas o schema do Gallery
-- só tem actor_id. Isso quebra o UPDATE de galerias no confirm-selection (500).

ALTER TABLE public.audit_log
  ADD COLUMN IF NOT EXISTS user_id uuid;

UPDATE public.audit_log
   SET user_id = actor_id
 WHERE user_id IS NULL AND actor_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.audit_log_mirror_actor_user()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NULL AND NEW.actor_id IS NOT NULL THEN
    NEW.user_id := NEW.actor_id;
  ELSIF NEW.actor_id IS NULL AND NEW.user_id IS NOT NULL THEN
    NEW.actor_id := NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_audit_log_mirror_actor_user ON public.audit_log;
CREATE TRIGGER tg_audit_log_mirror_actor_user
  BEFORE INSERT OR UPDATE ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_mirror_actor_user();

CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON public.audit_log(user_id);