
-- 1. Create galeria_pastas table
CREATE TABLE public.galeria_pastas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  galeria_id uuid NOT NULL REFERENCES public.galerias(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  nome text NOT NULL,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE public.galeria_pastas ENABLE ROW LEVEL SECURITY;

-- 3. RLS: Photographer can manage own folders
CREATE POLICY "Photographers manage own folders"
  ON public.galeria_pastas
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. RLS: Public can view folders via gallery token (same logic as photos)
CREATE POLICY "Public view folders via gallery token"
  ON public.galeria_pastas
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.galerias g
      WHERE g.id = galeria_pastas.galeria_id
        AND g.public_token IS NOT NULL
        AND g.status IN ('enviado', 'selecao_iniciada', 'selecao_completa')
    )
  );

-- 5. Add pasta_id column to galeria_fotos
ALTER TABLE public.galeria_fotos
  ADD COLUMN pasta_id uuid REFERENCES public.galeria_pastas(id) ON DELETE SET NULL;

-- 6. Index for performance
CREATE INDEX idx_galeria_pastas_galeria_id ON public.galeria_pastas(galeria_id);
CREATE INDEX idx_galeria_fotos_pasta_id ON public.galeria_fotos(pasta_id);
