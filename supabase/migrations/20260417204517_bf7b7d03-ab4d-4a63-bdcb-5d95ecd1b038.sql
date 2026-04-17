-- Add default sale mode and default image resize to gallery_settings
ALTER TABLE public.gallery_settings
  ADD COLUMN IF NOT EXISTS default_sale_mode text NOT NULL DEFAULT 'sale_without_payment',
  ADD COLUMN IF NOT EXISTS default_image_resize integer NOT NULL DEFAULT 1920;

-- Add check constraints for valid values
ALTER TABLE public.gallery_settings
  DROP CONSTRAINT IF EXISTS gallery_settings_default_sale_mode_check;

ALTER TABLE public.gallery_settings
  ADD CONSTRAINT gallery_settings_default_sale_mode_check
  CHECK (default_sale_mode IN ('no_sale', 'sale_with_payment', 'sale_without_payment'));

ALTER TABLE public.gallery_settings
  DROP CONSTRAINT IF EXISTS gallery_settings_default_image_resize_check;

ALTER TABLE public.gallery_settings
  ADD CONSTRAINT gallery_settings_default_image_resize_check
  CHECK (default_image_resize IN (1024, 1920, 2560));