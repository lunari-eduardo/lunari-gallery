
-- 1. Add upload_key column for idempotency
ALTER TABLE public.galeria_fotos ADD COLUMN IF NOT EXISTS upload_key text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_galeria_fotos_upload_key 
  ON public.galeria_fotos (galeria_id, upload_key) 
  WHERE upload_key IS NOT NULL;

-- 2. Create check_photo_credits RPC (verify without consuming)
CREATE OR REPLACE FUNCTION public.check_photo_credits(_user_id uuid, _photo_count integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_balance INTEGER;
BEGIN
  SELECT photo_credits INTO current_balance
  FROM photographer_accounts
  WHERE user_id = _user_id;
  
  IF current_balance IS NULL OR current_balance < _photo_count THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$;
