-- Adicionar public_token e gallery_password à tabela galerias
ALTER TABLE galerias 
ADD COLUMN IF NOT EXISTS public_token TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS gallery_password TEXT;

-- Criar índice para busca rápida por token
CREATE UNIQUE INDEX IF NOT EXISTS idx_galerias_public_token 
ON galerias(public_token) WHERE public_token IS NOT NULL;

-- Função para gerar token único (12 caracteres alfanuméricos)
CREATE OR REPLACE FUNCTION public.generate_public_token()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  chars TEXT := 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..12 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- Policy para acesso público via token (SELECT apenas)
-- Permite que qualquer pessoa acesse galerias enviadas via public_token
DROP POLICY IF EXISTS "Public galleries accessible via token" ON galerias;
CREATE POLICY "Public galleries accessible via token"
ON galerias FOR SELECT
USING (
  public_token IS NOT NULL 
  AND status IN ('enviado', 'selecao_iniciada', 'selecao_completa')
);

-- Policy para fotos de galerias públicas (via token)
DROP POLICY IF EXISTS "Photos accessible for public galleries" ON galeria_fotos;
CREATE POLICY "Photos accessible for public galleries"
ON galeria_fotos FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM galerias g
    WHERE g.id = galeria_fotos.galeria_id
    AND g.public_token IS NOT NULL
    AND g.status IN ('enviado', 'selecao_iniciada', 'selecao_completa')
  )
);

-- Policy para permitir UPDATE em fotos de galerias públicas (seleção do cliente)
DROP POLICY IF EXISTS "Clients can update photo selection" ON galeria_fotos;
CREATE POLICY "Clients can update photo selection"
ON galeria_fotos FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM galerias g
    WHERE g.id = galeria_fotos.galeria_id
    AND g.public_token IS NOT NULL
    AND g.status IN ('enviado', 'selecao_iniciada')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM galerias g
    WHERE g.id = galeria_fotos.galeria_id
    AND g.public_token IS NOT NULL
    AND g.status IN ('enviado', 'selecao_iniciada')
  )
);