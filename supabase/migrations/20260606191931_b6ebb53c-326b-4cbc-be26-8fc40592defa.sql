CREATE OR REPLACE VIEW public.v_infinitepay_latency AS
SELECT
  c.id, 
  c.ip_order_nsu, 
  c.status, 
  c.created_at AS cobranca_created,
  wl.created_at AS webhook_received,
  wl.processed_at AS webhook_processed,
  c.data_pagamento,
  EXTRACT(EPOCH FROM (wl.processed_at - wl.created_at)) AS webhook_proc_seconds,
  EXTRACT(EPOCH FROM (c.data_pagamento - wl.created_at)) AS db_update_seconds,
  wl.status AS webhook_status
FROM public.cobrancas c
LEFT JOIN public.webhook_logs wl ON wl.order_nsu = c.ip_order_nsu
WHERE c.provedor = 'infinitepay'
ORDER BY c.created_at DESC;

GRANT SELECT ON public.v_infinitepay_latency TO authenticated;
GRANT SELECT ON public.v_infinitepay_latency TO service_role;