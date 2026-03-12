-- Clean up duplicate 'cliente_acessou' entries, keeping only the earliest one per gallery
DELETE FROM public.galeria_acoes a
USING public.galeria_acoes b
WHERE a.tipo = 'cliente_acessou'
  AND b.tipo = 'cliente_acessou'
  AND a.galeria_id = b.galeria_id
  AND a.created_at > b.created_at;

-- Now create the unique partial index
CREATE UNIQUE INDEX IF NOT EXISTS idx_galeria_acoes_cliente_acessou 
ON public.galeria_acoes (galeria_id, tipo) 
WHERE tipo = 'cliente_acessou';