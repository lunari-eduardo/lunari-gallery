CREATE OR REPLACE FUNCTION public.archive_gallery(p_gallery_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_gallery RECORD;
  v_paths JSONB := '[]'::jsonb;
  v_photo_count INT := 0;
  v_storage_bytes BIGINT := 0;
  v_cobrancas_count INT := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = '42501';
  END IF;

  SELECT id, user_id, deleted_at, nome_sessao, cliente_id, session_id,
         valor_total_vendido, total_fotos_extras_vendidas
    INTO v_gallery
    FROM public.galerias
   WHERE id = p_gallery_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'GALLERY_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_gallery.user_id <> v_user_id THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  IF v_gallery.deleted_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'already_archived', true, 'gallery_id', p_gallery_id);
  END IF;

  WITH all_paths AS (
    SELECT UNNEST(ARRAY[storage_key, original_path, preview_path, preview_wm_path, thumb_path]) AS path
    FROM public.galeria_fotos
    WHERE galeria_id = p_gallery_id
  )
  SELECT COALESCE(jsonb_agg(DISTINCT path) FILTER (WHERE path IS NOT NULL AND path <> ''), '[]'::jsonb)
    INTO v_paths FROM all_paths;

  SELECT COUNT(*)::INT, COALESCE(SUM(COALESCE(file_size,0)), 0)::BIGINT
    INTO v_photo_count, v_storage_bytes
    FROM public.galeria_fotos
   WHERE galeria_id = p_gallery_id;

  SELECT COUNT(*)::INT INTO v_cobrancas_count
    FROM public.cobrancas WHERE galeria_id = p_gallery_id;

  DELETE FROM public.galeria_fotos WHERE galeria_id = p_gallery_id;
  DELETE FROM public.galeria_pastas WHERE galeria_id = p_gallery_id;
  DELETE FROM public.visitante_selecoes
   WHERE visitante_id IN (SELECT id FROM public.galeria_visitantes WHERE galeria_id = p_gallery_id);
  DELETE FROM public.galeria_visitantes WHERE galeria_id = p_gallery_id;

  BEGIN
    UPDATE public.gallery_token_aliases SET revoked = true WHERE gallery_id = p_gallery_id;
  EXCEPTION WHEN undefined_column THEN
    DELETE FROM public.gallery_token_aliases WHERE gallery_id = p_gallery_id;
  END;

  UPDATE public.galerias
     SET deleted_at = now(), deleted_by = v_user_id, public_token = NULL, updated_at = now()
   WHERE id = p_gallery_id;

  INSERT INTO public.galeria_acoes (galeria_id, tipo, descricao, payload)
  VALUES (
    p_gallery_id, 'gallery_archived',
    'Galeria arquivada: ' || COALESCE(v_gallery.nome_sessao, '(sem nome)'),
    jsonb_build_object(
      'archived_by', v_user_id,
      'photo_count', v_photo_count,
      'storage_bytes_freed', v_storage_bytes,
      'cobrancas_preservadas', v_cobrancas_count,
      'paths_to_purge_count', jsonb_array_length(v_paths)
    )
  );

  RETURN jsonb_build_object(
    'success', true, 'gallery_id', p_gallery_id,
    'paths_to_purge', v_paths, 'photo_count', v_photo_count,
    'storage_bytes_freed', v_storage_bytes, 'cobrancas_preservadas', v_cobrancas_count
  );
END;
$function$;