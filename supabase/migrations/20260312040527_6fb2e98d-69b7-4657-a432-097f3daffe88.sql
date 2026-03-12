
-- Audit log for sensitive actions
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  action text NOT NULL,
  actor_type text NOT NULL DEFAULT 'system', -- 'user', 'client', 'system', 'webhook'
  actor_id uuid, -- user_id if authenticated
  ip_address text,
  resource_type text, -- 'gallery', 'photo', 'payment'
  resource_id uuid,
  gallery_id uuid REFERENCES public.galerias(id) ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  user_agent text
);

-- Index for quick lookups
CREATE INDEX idx_audit_log_gallery ON public.audit_log(gallery_id) WHERE gallery_id IS NOT NULL;
CREATE INDEX idx_audit_log_action ON public.audit_log(action, created_at DESC);
CREATE INDEX idx_audit_log_actor ON public.audit_log(actor_id) WHERE actor_id IS NOT NULL;

-- RLS: only admins and resource owners can view
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all audit logs"
  ON public.audit_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view audit logs for their galleries"
  ON public.audit_log FOR SELECT
  TO authenticated
  USING (
    gallery_id IN (SELECT id FROM public.galerias WHERE user_id = auth.uid())
    OR actor_id = auth.uid()
  );
