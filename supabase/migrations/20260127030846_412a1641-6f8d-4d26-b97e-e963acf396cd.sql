-- Create webhook audit logs table for debugging InfinitePay/MercadoPago webhooks
CREATE TABLE IF NOT EXISTS public.webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provedor TEXT NOT NULL,
  payload JSONB,
  headers JSONB,
  status TEXT DEFAULT 'received',
  order_nsu TEXT,
  error_message TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookups by provider and order
CREATE INDEX IF NOT EXISTS idx_webhook_logs_provedor ON public.webhook_logs(provedor);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_order_nsu ON public.webhook_logs(order_nsu);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created_at ON public.webhook_logs(created_at DESC);

-- No RLS needed for webhook logs - only edge functions access this table