
-- Corrigir FK da tabela cobrancas para permitir exclusão em cascata
-- Primeiro dropar a constraint existente, depois recriar com CASCADE

ALTER TABLE cobrancas 
DROP CONSTRAINT IF EXISTS cobrancas_galeria_id_fkey;

ALTER TABLE cobrancas 
ADD CONSTRAINT cobrancas_galeria_id_fkey 
FOREIGN KEY (galeria_id) 
REFERENCES galerias(id) 
ON DELETE CASCADE;

-- Comentário explicativo
COMMENT ON CONSTRAINT cobrancas_galeria_id_fkey ON cobrancas IS 'Quando galeria é excluída, cobranças associadas são removidas automaticamente';
