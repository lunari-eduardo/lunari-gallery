ALTER TABLE galerias DROP CONSTRAINT galerias_status_selecao_check;
ALTER TABLE galerias ADD CONSTRAINT galerias_status_selecao_check 
  CHECK (status_selecao = ANY (ARRAY['em_andamento', 'confirmado', 'bloqueado', 'aguardando_pagamento']));