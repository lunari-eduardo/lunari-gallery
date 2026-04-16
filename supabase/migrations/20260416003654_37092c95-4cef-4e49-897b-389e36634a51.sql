
-- Table to keep old tokens as aliases
CREATE TABLE public.gallery_token_aliases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  gallery_id UUID NOT NULL REFERENCES public.galerias(id) ON DELETE CASCADE,
  old_token TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_gallery_token_aliases_token ON public.gallery_token_aliases(old_token);
CREATE INDEX idx_gallery_token_aliases_gallery ON public.gallery_token_aliases(gallery_id);

ALTER TABLE public.gallery_token_aliases ENABLE ROW LEVEL SECURITY;

-- No public access - only service role uses this table
-- (gallery-access edge function uses service role)

-- Trigger: when public_token changes, save the old one as alias
CREATE OR REPLACE FUNCTION public.save_token_alias()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.public_token IS NOT NULL 
     AND OLD.public_token IS DISTINCT FROM NEW.public_token 
     AND NEW.public_token IS NOT NULL THEN
    INSERT INTO public.gallery_token_aliases (gallery_id, old_token)
    VALUES (NEW.id, OLD.public_token)
    ON CONFLICT (old_token) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_save_token_alias
  BEFORE UPDATE ON public.galerias
  FOR EACH ROW
  EXECUTE FUNCTION public.save_token_alias();
