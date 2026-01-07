-- Remove old boolean column and add new permission column
ALTER TABLE public.gallery_settings DROP COLUMN IF EXISTS public_gallery_enabled;

ALTER TABLE public.gallery_settings 
  ADD COLUMN IF NOT EXISTS default_gallery_permission TEXT 
  DEFAULT 'private' 
  CHECK (default_gallery_permission IN ('public', 'private'));