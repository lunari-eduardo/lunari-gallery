
-- 1. Ampliar constraint galeria_acoes_tipo_check
ALTER TABLE galeria_acoes DROP CONSTRAINT IF EXISTS galeria_acoes_tipo_check;
ALTER TABLE galeria_acoes ADD CONSTRAINT galeria_acoes_tipo_check 
  CHECK (tipo = ANY (ARRAY[
    'criada', 'enviada', 'cliente_acessou', 'cliente_confirmou', 
    'selecao_reaberta', 'expirada',
    'pagamento_informado', 'pagamento_confirmado',
    'foto_selecionada', 'foto_desmarcada', 'foto_favoritada',
    'galeria_excluida'
  ]));

-- 2. Corrigir galeria travada
UPDATE galerias 
SET status_pagamento = 'pago', 
    status_selecao = 'selecao_completa', 
    finalized_at = NOW()
WHERE id = 'bf563230-1473-413a-be10-85c8d65ce955' 
  AND status_pagamento = 'pendente';
