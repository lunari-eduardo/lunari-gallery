ALTER TABLE public.galerias
  ADD COLUMN IF NOT EXISTS cover_id text;

ALTER TABLE public.gallery_settings
  ADD COLUMN IF NOT EXISTS default_cover_id text NOT NULL DEFAULT 'fullscreen';