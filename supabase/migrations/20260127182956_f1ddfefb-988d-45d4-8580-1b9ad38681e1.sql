-- Adicionar campo para rastrear quantidade de fotos por cobrança
ALTER TABLE cobrancas 
ADD COLUMN IF NOT EXISTS qtd_fotos integer DEFAULT 0;

-- Adicionar campo para vincular cobrança à galeria
ALTER TABLE cobrancas 
ADD COLUMN IF NOT EXISTS galeria_id uuid REFERENCES galerias(id);

-- Comentários para documentação
COMMENT ON COLUMN cobrancas.qtd_fotos IS 'Quantidade de fotos extras cobradas nesta transação';
COMMENT ON COLUMN cobrancas.galeria_id IS 'Galeria associada a esta cobrança (se aplicável)';