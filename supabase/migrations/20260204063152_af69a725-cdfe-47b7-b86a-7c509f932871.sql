-- Add watermark configuration columns to photographer_accounts
-- These allow each photographer to customize their watermark settings

ALTER TABLE public.photographer_accounts
ADD COLUMN IF NOT EXISTS watermark_mode text DEFAULT 'system' 
  CHECK (watermark_mode IN ('system', 'custom', 'none')),
ADD COLUMN IF NOT EXISTS watermark_path text,
ADD COLUMN IF NOT EXISTS watermark_opacity integer DEFAULT 40 
  CHECK (watermark_opacity >= 0 AND watermark_opacity <= 100),
ADD COLUMN IF NOT EXISTS watermark_scale integer DEFAULT 30 
  CHECK (watermark_scale >= 10 AND watermark_scale <= 50);

-- Add comment for documentation
COMMENT ON COLUMN public.photographer_accounts.watermark_mode IS 'Watermark mode: system (default), custom (user uploaded), or none';
COMMENT ON COLUMN public.photographer_accounts.watermark_path IS 'R2 path for custom watermark: user-assets/{user_id}/watermark.png';
COMMENT ON COLUMN public.photographer_accounts.watermark_opacity IS 'Watermark opacity 0-100%';
COMMENT ON COLUMN public.photographer_accounts.watermark_scale IS 'Watermark size as percentage of image smaller dimension 10-50%';