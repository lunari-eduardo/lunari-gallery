-- 1. Tabela principal de configurações (1 registro por usuário)
CREATE TABLE public.gallery_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  studio_name TEXT DEFAULT 'Meu Estúdio',
  studio_logo_url TEXT,
  favicon_url TEXT,
  public_gallery_enabled BOOLEAN DEFAULT true,
  client_theme TEXT DEFAULT 'system' CHECK (client_theme IN ('light', 'dark', 'system')),
  default_expiration_days INTEGER DEFAULT 10 CHECK (default_expiration_days > 0 AND default_expiration_days <= 90),
  active_theme_id UUID,
  default_watermark JSONB DEFAULT '{"type": "none", "opacity": 30, "position": "bottom-right"}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Tabela de temas personalizados
CREATE TABLE public.gallery_themes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  primary_color TEXT NOT NULL DEFAULT '#B87333',
  background_color TEXT NOT NULL DEFAULT '#FAFAF8',
  text_color TEXT NOT NULL DEFAULT '#2D2A26',
  accent_color TEXT NOT NULL DEFAULT '#8B9A7D',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Tabela de templates de email
CREATE TABLE public.gallery_email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('gallery_sent', 'selection_reminder', 'selection_confirmed')),
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Tabela de presets de desconto
CREATE TABLE public.gallery_discount_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  packages JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_gallery_themes_user ON public.gallery_themes(user_id);
CREATE INDEX idx_gallery_email_templates_user ON public.gallery_email_templates(user_id);
CREATE INDEX idx_gallery_discount_presets_user ON public.gallery_discount_presets(user_id);

-- Adicionar FK do active_theme_id após criar gallery_themes
ALTER TABLE public.gallery_settings 
  ADD CONSTRAINT fk_active_theme 
  FOREIGN KEY (active_theme_id) 
  REFERENCES public.gallery_themes(id) 
  ON DELETE SET NULL;

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.gallery_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gallery_themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gallery_email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gallery_discount_presets ENABLE ROW LEVEL SECURITY;

-- Políticas para gallery_settings
CREATE POLICY "Users can view own gallery settings"
ON public.gallery_settings FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own gallery settings"
ON public.gallery_settings FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own gallery settings"
ON public.gallery_settings FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own gallery settings"
ON public.gallery_settings FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Políticas para gallery_themes
CREATE POLICY "Users can view own gallery themes"
ON public.gallery_themes FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own gallery themes"
ON public.gallery_themes FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own gallery themes"
ON public.gallery_themes FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own gallery themes"
ON public.gallery_themes FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Políticas para gallery_email_templates
CREATE POLICY "Users can view own email templates"
ON public.gallery_email_templates FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own email templates"
ON public.gallery_email_templates FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own email templates"
ON public.gallery_email_templates FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own email templates"
ON public.gallery_email_templates FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Políticas para gallery_discount_presets
CREATE POLICY "Users can view own discount presets"
ON public.gallery_discount_presets FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own discount presets"
ON public.gallery_discount_presets FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own discount presets"
ON public.gallery_discount_presets FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own discount presets"
ON public.gallery_discount_presets FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Triggers para updated_at
CREATE TRIGGER update_gallery_settings_updated_at
  BEFORE UPDATE ON public.gallery_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_gallery_themes_updated_at
  BEFORE UPDATE ON public.gallery_themes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_gallery_email_templates_updated_at
  BEFORE UPDATE ON public.gallery_email_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_gallery_discount_presets_updated_at
  BEFORE UPDATE ON public.gallery_discount_presets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();