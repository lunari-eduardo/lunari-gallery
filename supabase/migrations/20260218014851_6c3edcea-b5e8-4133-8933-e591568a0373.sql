-- Adicionar 'expirado' ao constraint de status da galeria
ALTER TABLE galerias DROP CONSTRAINT IF EXISTS galerias_status_check;
ALTER TABLE galerias ADD CONSTRAINT galerias_status_check 
  CHECK (status = ANY (ARRAY[
    'rascunho', 'enviado', 'selecao_iniciada', 'selecao_completa', 'expirado'
  ]));