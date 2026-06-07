-- Add theme support to profiles (Global Settings)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS default_theme_id TEXT DEFAULT 'lunari',
ADD COLUMN IF NOT EXISTS theme_overrides JSONB DEFAULT '{}'::jsonb;

-- Add theme support to individual galleries
ALTER TABLE public.galerias 
ADD COLUMN IF NOT EXISTS theme_id TEXT, -- NULL means inherit from profile
ADD COLUMN IF NOT EXISTS theme_overrides JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS use_custom_theme BOOLEAN DEFAULT false;

-- Add density to galleries (future proofing)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gallery_density') THEN
        CREATE TYPE gallery_density AS ENUM ('compact', 'comfortable', 'airy');
    END IF;
END $$;

ALTER TABLE public.galerias 
ADD COLUMN IF NOT EXISTS density gallery_density DEFAULT 'comfortable';

-- Ensure RLS is active (should already be, but safe practice)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.galerias ENABLE ROW LEVEL SECURITY;

-- No extra grants needed if standard roles already have access, 
-- but ensuring authenticated users can update their own data.
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.galerias TO authenticated;
GRANT ALL ON public.profiles TO service_role;
GRANT ALL ON public.galerias TO service_role;
