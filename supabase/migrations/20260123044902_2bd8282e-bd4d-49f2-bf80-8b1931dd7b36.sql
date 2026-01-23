-- Add regras_congeladas column to galerias table
-- This stores frozen pricing rules from Gestão for progressive discounts
ALTER TABLE galerias ADD COLUMN IF NOT EXISTS regras_congeladas JSONB DEFAULT NULL;

-- Add comment explaining the column structure
COMMENT ON COLUMN galerias.regras_congeladas IS 'Frozen pricing rules from Gestão. Structure: { modelo, pacote: { fotosIncluidas, valorFotoExtra }, precificacaoFotoExtra: { modelo, tabelaGlobal?, tabelaCategoria? } }';