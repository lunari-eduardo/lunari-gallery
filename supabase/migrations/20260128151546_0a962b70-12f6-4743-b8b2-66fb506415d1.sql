-- 1. Migrar dados de gallery_clientes para clientes
INSERT INTO public.clientes (
  id, user_id, nome, email, telefone, 
  gallery_password, gallery_status, total_galerias,
  created_at, updated_at
)
SELECT 
  id, user_id, nome, email, telefone,
  gallery_password, status, total_galerias,
  created_at, updated_at
FROM public.gallery_clientes
ON CONFLICT (id) DO NOTHING;

-- 2. Corrigir política RLS em galerias (remover authenticated)
DROP POLICY IF EXISTS "Public access via token" ON public.galerias;

CREATE POLICY "Public access via token for clients"
ON public.galerias
FOR SELECT
TO anon
USING (
  (public_token IS NOT NULL) 
  AND (status = ANY (ARRAY['enviado'::text, 'selecao_iniciada'::text, 'selecao_completa'::text]))
);

-- 3. Remover tabela gallery_clientes
DROP TABLE IF EXISTS public.gallery_clientes;