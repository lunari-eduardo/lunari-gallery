CREATE OR REPLACE FUNCTION public.get_transfer_storage_bytes(_user_id UUID)
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(SUM(gf.file_size), 0)::BIGINT
  FROM public.galeria_fotos gf
  INNER JOIN public.galerias g ON g.id = gf.galeria_id
  WHERE g.user_id = _user_id
    AND g.tipo = 'entrega'
    AND g.status NOT IN ('excluida');
$$;