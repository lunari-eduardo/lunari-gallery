-- Add is_favorite column to galeria_fotos table
ALTER TABLE galeria_fotos 
ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT FALSE;