ALTER TABLE public.gallery_settings
ADD COLUMN IF NOT EXISTS email_on_gallery_reactivated boolean DEFAULT true;