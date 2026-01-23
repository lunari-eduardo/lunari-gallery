-- Add origin column to track if gallery was created manually or from Gestão
ALTER TABLE galerias 
ADD COLUMN IF NOT EXISTS origin TEXT DEFAULT 'manual';

-- Add constraint for valid values
ALTER TABLE galerias 
ADD CONSTRAINT galerias_origin_check CHECK (origin IN ('manual', 'gestao'));

-- Add comment for documentation
COMMENT ON COLUMN galerias.origin IS 'Tracks whether gallery was created manually or via Gestão integration';