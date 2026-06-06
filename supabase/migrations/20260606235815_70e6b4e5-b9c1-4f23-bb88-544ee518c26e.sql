-- Adiciona coluna de espaçamento padrão na tabela de configurações do estúdio
ALTER TABLE public.gallery_settings ADD COLUMN IF NOT EXISTS default_photo_spacing INTEGER DEFAULT 6;

-- Comentário para documentar o campo
COMMENT ON COLUMN public.gallery_settings.default_photo_spacing IS 'Espaçamento padrão em pixels entre fotos no grid da galeria (borda).';

-- Garantir que as permissões continuam corretas
GRANT ALL ON public.gallery_settings TO service_role;
GRANT SELECT, UPDATE ON public.gallery_settings TO authenticated;
