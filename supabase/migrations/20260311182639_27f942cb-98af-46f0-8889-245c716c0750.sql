ALTER TABLE public.galerias DROP CONSTRAINT IF EXISTS galerias_status_selecao_check;

ALTER TABLE public.galerias ADD CONSTRAINT galerias_status_selecao_check 
  CHECK (status_selecao IS NULL OR status_selecao = ANY (ARRAY[
    'em_andamento', 
    'selecao_iniciada',
    'processando_selecao',
    'selecao_completa', 
    'bloqueado', 
    'aguardando_pagamento'
  ]));