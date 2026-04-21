ALTER TABLE public.gallery_settings
  ADD COLUMN IF NOT EXISTS default_charge_type text DEFAULT 'only_extras',
  ADD COLUMN IF NOT EXISTS default_pricing_model text DEFAULT 'fixed',
  ADD COLUMN IF NOT EXISTS default_payment_method text,
  ADD COLUMN IF NOT EXISTS default_allow_comments boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS default_allow_download boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS default_allow_extra_photos boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS default_watermark_display text DEFAULT 'all';

ALTER TABLE public.gallery_settings
  DROP CONSTRAINT IF EXISTS gallery_settings_default_charge_type_check;
ALTER TABLE public.gallery_settings
  ADD CONSTRAINT gallery_settings_default_charge_type_check
  CHECK (default_charge_type IS NULL OR default_charge_type IN ('only_extras','all_selected'));

ALTER TABLE public.gallery_settings
  DROP CONSTRAINT IF EXISTS gallery_settings_default_pricing_model_check;
ALTER TABLE public.gallery_settings
  ADD CONSTRAINT gallery_settings_default_pricing_model_check
  CHECK (default_pricing_model IS NULL OR default_pricing_model IN ('fixed','packages'));

ALTER TABLE public.gallery_settings
  DROP CONSTRAINT IF EXISTS gallery_settings_default_payment_method_check;
ALTER TABLE public.gallery_settings
  ADD CONSTRAINT gallery_settings_default_payment_method_check
  CHECK (default_payment_method IS NULL OR default_payment_method IN ('pix_manual','infinitepay','mercadopago','asaas'));

ALTER TABLE public.gallery_settings
  DROP CONSTRAINT IF EXISTS gallery_settings_default_watermark_display_check;
ALTER TABLE public.gallery_settings
  ADD CONSTRAINT gallery_settings_default_watermark_display_check
  CHECK (default_watermark_display IS NULL OR default_watermark_display IN ('all','fullscreen','none'));