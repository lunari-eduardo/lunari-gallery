-- Policy: Qualquer pessoa pode ver galerias publicadas (enviado, selecao_iniciada, selecao_completa)
CREATE POLICY "Anyone can view published galleries"
ON galerias
FOR SELECT
USING (
  status IN ('enviado', 'selecao_iniciada', 'selecao_completa')
);

-- Policy: Qualquer pessoa pode ver fotos de galerias publicadas
CREATE POLICY "Anyone can view published gallery photos"
ON galeria_fotos
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM galerias g
    WHERE g.id = galeria_fotos.galeria_id
    AND g.status IN ('enviado', 'selecao_iniciada', 'selecao_completa')
  )
);