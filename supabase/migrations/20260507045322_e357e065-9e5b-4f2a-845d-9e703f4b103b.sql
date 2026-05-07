
UPDATE galerias
   SET status_pagamento = 'sem_vendas',
       updated_at = now()
 WHERE id = 'ab834051-0d47-43c3-8f81-11d0bf42c388'
   AND status = 'selecao_iniciada';
