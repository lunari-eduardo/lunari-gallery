-- 1. Link orphaned cobrancas to galleries via session_id
UPDATE public.cobrancas c
SET galeria_id = g.id
FROM public.galerias g
WHERE c.galeria_id IS NULL
  AND c.session_id IS NOT NULL
  AND g.session_id = c.session_id;

-- 2. Sync galleries that have paid cobrancas but still show pendente
UPDATE public.galerias g
SET status_pagamento = 'pago',
    status_selecao = 'selecao_completa',
    finalized_at = COALESCE(g.finalized_at, c.data_pagamento, now()),
    updated_at = now()
FROM public.cobrancas c
WHERE c.galeria_id = g.id
  AND c.status = 'pago'
  AND g.status_pagamento != 'pago';

-- 3. Sync clientes_sessoes for affected galleries  
UPDATE public.clientes_sessoes cs
SET status_galeria = 'selecao_completa',
    status_pagamento_fotos_extra = 'pago',
    updated_at = now()
FROM public.cobrancas c
WHERE c.session_id = cs.session_id
  AND c.status = 'pago'
  AND (cs.status_pagamento_fotos_extra IS NULL OR cs.status_pagamento_fotos_extra != 'pago');