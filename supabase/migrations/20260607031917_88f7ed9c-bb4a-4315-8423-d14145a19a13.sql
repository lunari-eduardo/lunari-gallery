-- 1. Add visual weight to photos
ALTER TABLE public.galeria_fotos ADD COLUMN IF NOT EXISTS peso_visual SMALLINT DEFAULT 0;

-- 2. Ensure RLS allows access
GRANT SELECT, UPDATE ON public.galeria_fotos TO authenticated;
GRANT SELECT ON public.galeria_fotos TO anon;

-- 3. Comment explaining the weights for future developers
COMMENT ON COLUMN public.galeria_fotos.peso_visual IS 'Weight for visual hierarchy in editorial grids: 0=normal, 1=featured (2x2), 2=super-featured (wide/tall)';

-- 4. Preparation for themes table (if not exists)
CREATE TABLE IF NOT EXISTS public.gallery_theme_presets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    scope TEXT NOT NULL DEFAULT 'system', -- 'system' or 'user'
    owner_id UUID REFERENCES auth.users(id),
    theme_json JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Basic permissions for themes
GRANT SELECT ON public.gallery_theme_presets TO authenticated;
GRANT SELECT ON public.gallery_theme_presets TO anon;
ALTER TABLE public.gallery_theme_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view system themes" ON public.gallery_theme_presets
    FOR SELECT USING (scope = 'system');

CREATE POLICY "Users can manage their own themes" ON public.gallery_theme_presets
    FOR ALL USING (auth.uid() = owner_id);

-- Insert the default theme record
INSERT INTO public.gallery_theme_presets (name, scope, theme_json)
VALUES ('Clássico', 'system', '{
    "id": "default",
    "layout": {"engine": "editorial-grid", "columns": {"mobile": 2, "tablet": 3, "desktop": 4}, "gap": 6},
    "featured": {"enabled": true, "maxCount": 10},
    "header": {"variant": "floating-glass", "revealOnScroll": true}
}')
ON CONFLICT DO NOTHING;
