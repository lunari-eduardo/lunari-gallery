-- Phase 1: Add theme fields to gallery_settings (correct table)
ALTER TABLE public.gallery_settings
ADD COLUMN IF NOT EXISTS default_theme_id TEXT DEFAULT 'lunari',
ADD COLUMN IF NOT EXISTS theme_overrides JSONB DEFAULT '{}'::jsonb;

-- Phase 2: Migrate existing values from profiles to gallery_settings if needed
-- Only migrate if source has a value and destination doesn't
UPDATE public.gallery_settings gs
SET 
  default_theme_id = COALESCE(gs.default_theme_id, p.default_theme_id, 'lunari'),
  theme_overrides = CASE 
    WHEN gs.theme_overrides::text = '{}' AND p.theme_overrides::text != '{}' 
    THEN p.theme_overrides
    ELSE gs.theme_overrides
  END
FROM public.profiles p
WHERE gs.user_id = p.user_id;

-- Phase 3: Ensure RLS is enabled
ALTER TABLE public.gallery_settings ENABLE ROW LEVEL SECURITY;

-- Phase 4: Verify grants (should already exist but being explicit)
GRANT SELECT, UPDATE ON public.gallery_settings TO authenticated;
GRANT ALL ON public.gallery_settings TO service_role;