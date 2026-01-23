-- Add status_galeria column to track gallery lifecycle in session
ALTER TABLE clientes_sessoes 
ADD COLUMN IF NOT EXISTS status_galeria TEXT DEFAULT NULL;

-- Add galeria_id to link session directly to gallery
ALTER TABLE clientes_sessoes 
ADD COLUMN IF NOT EXISTS galeria_id UUID REFERENCES galerias(id) ON DELETE SET NULL;

-- Create index for galeria lookups
CREATE INDEX IF NOT EXISTS idx_clientes_sessoes_galeria_id ON clientes_sessoes(galeria_id);
CREATE INDEX IF NOT EXISTS idx_clientes_sessoes_status_galeria ON clientes_sessoes(status_galeria);

-- Add comment documenting valid values
COMMENT ON COLUMN clientes_sessoes.status_galeria IS 
  'Status da galeria vinculada: criada, enviada, em_selecao, concluida, expirada';

COMMENT ON COLUMN clientes_sessoes.galeria_id IS 
  'ID da galeria vinculada à sessão';