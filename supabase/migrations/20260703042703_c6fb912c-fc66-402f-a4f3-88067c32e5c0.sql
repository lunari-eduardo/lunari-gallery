
ALTER TABLE public.galerias
  ADD COLUMN IF NOT EXISTS cover_storage_key text,
  ADD COLUMN IF NOT EXISTS first_photo_storage_key text;

CREATE OR REPLACE FUNCTION public.refresh_gallery_photo_keys(p_gallery_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cover_id text;
  v_first text;
  v_cover text;
BEGIN
  IF p_gallery_id IS NULL THEN
    RETURN;
  END IF;

  SELECT configuracoes->>'coverPhotoId' INTO v_cover_id
    FROM galerias WHERE id = p_gallery_id;

  SELECT storage_key INTO v_first
    FROM galeria_fotos
   WHERE galeria_id = p_gallery_id
   ORDER BY created_at ASC, id ASC
   LIMIT 1;

  IF v_cover_id IS NOT NULL AND v_cover_id <> '' THEN
    BEGIN
      SELECT storage_key INTO v_cover
        FROM galeria_fotos
       WHERE id = v_cover_id::uuid
         AND galeria_id = p_gallery_id
       LIMIT 1;
    EXCEPTION WHEN invalid_text_representation THEN
      v_cover := NULL;
    END;
  ELSE
    v_cover := NULL;
  END IF;

  UPDATE galerias
     SET first_photo_storage_key = v_first,
         cover_storage_key = v_cover
   WHERE id = p_gallery_id
     AND (first_photo_storage_key IS DISTINCT FROM v_first
       OR cover_storage_key IS DISTINCT FROM v_cover);
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_galeria_fotos_refresh_keys()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.refresh_gallery_photo_keys(OLD.galeria_id);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.refresh_gallery_photo_keys(NEW.galeria_id);
    IF OLD.galeria_id IS DISTINCT FROM NEW.galeria_id THEN
      PERFORM public.refresh_gallery_photo_keys(OLD.galeria_id);
    END IF;
    RETURN NEW;
  ELSE
    PERFORM public.refresh_gallery_photo_keys(NEW.galeria_id);
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_galeria_fotos_refresh_keys ON public.galeria_fotos;
CREATE TRIGGER trg_galeria_fotos_refresh_keys
  AFTER INSERT OR DELETE OR UPDATE OF storage_key, galeria_id ON public.galeria_fotos
  FOR EACH ROW EXECUTE FUNCTION public.tg_galeria_fotos_refresh_keys();

CREATE OR REPLACE FUNCTION public.tg_galerias_refresh_cover_key()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(OLD.configuracoes->>'coverPhotoId','') IS DISTINCT FROM COALESCE(NEW.configuracoes->>'coverPhotoId','') THEN
    PERFORM public.refresh_gallery_photo_keys(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_galerias_refresh_cover_key ON public.galerias;
CREATE TRIGGER trg_galerias_refresh_cover_key
  AFTER UPDATE OF configuracoes ON public.galerias
  FOR EACH ROW EXECUTE FUNCTION public.tg_galerias_refresh_cover_key();

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM galerias LOOP
    PERFORM public.refresh_gallery_photo_keys(r.id);
  END LOOP;
END $$;
