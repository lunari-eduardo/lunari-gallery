-- Allow galerias to be created without a client (for public galleries)
ALTER TABLE galerias ALTER COLUMN cliente_id DROP NOT NULL;

-- Drop the existing foreign key constraint
ALTER TABLE galerias DROP CONSTRAINT IF EXISTS galerias_cliente_id_fkey;

-- Re-add the foreign key constraint but allow NULL
ALTER TABLE galerias 
ADD CONSTRAINT galerias_cliente_id_fkey 
FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL;

-- Add policy for public gallery access
CREATE POLICY "Anyone can view public galleries"
ON galerias FOR SELECT
USING (permissao = 'public');

-- Add policy for public gallery photos access
CREATE POLICY "Anyone can view photos from public galleries"
ON galeria_fotos FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM galerias 
    WHERE galerias.id = galeria_fotos.galeria_id 
    AND galerias.permissao = 'public'
  )
);