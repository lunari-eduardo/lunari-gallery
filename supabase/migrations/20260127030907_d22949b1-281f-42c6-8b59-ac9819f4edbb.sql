-- Enable RLS on webhook_logs and deny all public access
-- Only edge functions using service role can access this table
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

-- No policies needed - service role bypasses RLS
-- This ensures the table is not accessible via public API