-- Create system cache table for persistent B2 credentials
CREATE TABLE IF NOT EXISTS public.system_cache (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for expiration queries
CREATE INDEX idx_system_cache_expires ON public.system_cache(expires_at);

-- Enable RLS but allow service role access
ALTER TABLE public.system_cache ENABLE ROW LEVEL SECURITY;

-- Policy for service role only (Edge Functions use service role)
CREATE POLICY "Service role can manage cache"
ON public.system_cache
FOR ALL
USING (true)
WITH CHECK (true);

-- Auto-cleanup expired entries (optional trigger)
CREATE OR REPLACE FUNCTION public.cleanup_expired_cache()
RETURNS trigger AS $$
BEGIN
  DELETE FROM public.system_cache WHERE expires_at < now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Run cleanup on insert (keeps table clean)
CREATE TRIGGER trigger_cleanup_cache
AFTER INSERT ON public.system_cache
EXECUTE FUNCTION public.cleanup_expired_cache();