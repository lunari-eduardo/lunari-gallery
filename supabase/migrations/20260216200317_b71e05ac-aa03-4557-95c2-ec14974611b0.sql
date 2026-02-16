
-- 1. Dropar constraint ANTES de atualizar dados
ALTER TABLE galerias DROP CONSTRAINT IF EXISTS galerias_status_selecao_check;

-- 2. Atualizar dados existentes em galerias.status_selecao
UPDATE galerias SET status_selecao = 'selecao_completa' WHERE status_selecao = 'confirmado';

-- 3. Adicionar nova constraint
ALTER TABLE galerias ADD CONSTRAINT galerias_status_selecao_check 
  CHECK (status_selecao = ANY (ARRAY[
    'em_andamento', 'selecao_completa', 'bloqueado', 'aguardando_pagamento'
  ]));

-- 4. Atualizar dados existentes em clientes_sessoes.status_galeria
UPDATE clientes_sessoes SET status_galeria = 'em_selecao' WHERE status_galeria = 'selecao_iniciada';
UPDATE clientes_sessoes SET status_galeria = 'selecao_completa' WHERE status_galeria = 'concluida';
UPDATE clientes_sessoes SET status_galeria = 'enviada' WHERE status_galeria = 'criada';

-- 5. Adicionar constraint em clientes_sessoes
ALTER TABLE clientes_sessoes ADD CONSTRAINT sessoes_status_galeria_check 
  CHECK (status_galeria IS NULL OR status_galeria = ANY (ARRAY[
    'enviada', 'em_selecao', 'selecao_completa', 'expirada', 'excluida'
  ]));
