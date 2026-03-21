-- Add cover_path column to galeria_fotos for watermark-free cover images
ALTER TABLE public.galeria_fotos ADD COLUMN IF NOT EXISTS cover_path TEXT;