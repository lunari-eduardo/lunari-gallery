ALTER TABLE public.profiles 
DROP COLUMN IF EXISTS default_theme_id,
DROP COLUMN IF EXISTS theme_overrides;

COMMENT ON COLUMN public.galerias.theme_id IS 'ID do tema específico da galeria. Se NULL e use_custom_theme=false, herda de gallery_settings.';
COMMENT ON COLUMN public.galerias.theme_overrides IS 'Overrides de design específicos desta galeria.';
