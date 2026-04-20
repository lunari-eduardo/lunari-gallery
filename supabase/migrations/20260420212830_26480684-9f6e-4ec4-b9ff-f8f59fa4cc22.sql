ALTER TABLE public.gallery_settings
  ADD COLUMN IF NOT EXISTS email_sending_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_on_gallery_sent boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_on_payment_confirmed boolean NOT NULL DEFAULT true;

UPDATE public.gallery_settings
SET
  email_sending_enabled = COALESCE(email_sending_enabled, true),
  email_on_gallery_sent = COALESCE(email_on_gallery_sent, true),
  email_on_payment_confirmed = COALESCE(email_on_payment_confirmed, true);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'email_delivery_event_type') THEN
    CREATE TYPE public.email_delivery_event_type AS ENUM ('gallery_sent', 'payment_confirmed');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'email_delivery_status') THEN
    CREATE TYPE public.email_delivery_status AS ENUM ('enviado', 'erro', 'ignorado');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.email_delivery_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  cliente_id uuid NULL,
  cliente_nome text NULL,
  cliente_email text NULL,
  event_type public.email_delivery_event_type NOT NULL,
  status public.email_delivery_status NOT NULL,
  gallery_id uuid NULL REFERENCES public.galerias(id) ON DELETE SET NULL,
  payment_id uuid NULL REFERENCES public.cobrancas(id) ON DELETE SET NULL,
  idempotency_key text NOT NULL,
  resend_message_id text NULL,
  subject text NULL,
  friendly_message text NULL,
  error_message text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS email_delivery_logs_idempotency_key_unique
  ON public.email_delivery_logs (idempotency_key);

CREATE INDEX IF NOT EXISTS email_delivery_logs_user_created_idx
  ON public.email_delivery_logs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS email_delivery_logs_gallery_idx
  ON public.email_delivery_logs (gallery_id) WHERE gallery_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS email_delivery_logs_payment_idx
  ON public.email_delivery_logs (payment_id) WHERE payment_id IS NOT NULL;

ALTER TABLE public.email_delivery_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own email logs" ON public.email_delivery_logs;
CREATE POLICY "Users can view their own email logs"
ON public.email_delivery_logs
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_email_delivery_logs_updated_at ON public.email_delivery_logs;
CREATE TRIGGER update_email_delivery_logs_updated_at
BEFORE UPDATE ON public.email_delivery_logs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();