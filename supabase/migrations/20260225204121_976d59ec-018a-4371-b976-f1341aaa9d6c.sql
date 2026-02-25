-- Add column for original file size
ALTER TABLE public.galeria_fotos 
  ADD COLUMN IF NOT EXISTS original_file_size BIGINT;

-- Update RPC to use original_file_size when available (fallback to file_size)
CREATE OR REPLACE FUNCTION public.get_transfer_storage_bytes(_user_id UUID)
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(SUM(
    CASE 
      WHEN gf.original_file_size IS NOT NULL THEN gf.original_file_size
      ELSE gf.file_size
    END
  ), 0)::BIGINT
  FROM public.galeria_fotos gf
  INNER JOIN public.galerias g ON g.id = gf.galeria_id
  WHERE g.user_id = _user_id
    AND g.tipo = 'entrega'
    AND g.status NOT IN ('excluida');
$$;