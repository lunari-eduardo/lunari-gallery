-- Add processing status column to galeria_fotos
ALTER TABLE galeria_fotos 
ADD COLUMN IF NOT EXISTS processing_status TEXT DEFAULT 'uploaded';

-- Create index for efficient pending photos query
CREATE INDEX IF NOT EXISTS idx_galeria_fotos_processing_status 
ON galeria_fotos(processing_status) 
WHERE processing_status = 'uploaded';

-- Add comment for documentation
COMMENT ON COLUMN galeria_fotos.processing_status IS 
'Status do processamento de imagem: uploaded (aguardando), processing (em andamento), ready (pronto), error (falhou)';