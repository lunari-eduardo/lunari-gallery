
-- 1) FK audit_log.gallery_id → ON DELETE SET NULL, DEFERRABLE
ALTER TABLE public.audit_log
  DROP CONSTRAINT IF EXISTS audit_log_gallery_id_fkey;

ALTER TABLE public.audit_log
  ADD CONSTRAINT audit_log_gallery_id_fkey
  FOREIGN KEY (gallery_id) REFERENCES public.galerias(id)
  ON DELETE SET NULL
  DEFERRABLE INITIALLY DEFERRED;

-- 2) delete_gallery_complete: audit com gallery_id=NULL + metadata.gallery_id
CREATE OR REPLACE FUNCTION public.delete_gallery_complete(p_gallery_id uuid, p_motivo text DEFAULT 'manual'::text)
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
  IF v_user_id IS NULL AND p_motivo NOT IN ('expirada_12m','system_cleanup') THEN
    RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = '42501';
  END IF;

  SELECT id, user_id, nome_sessao, cliente_id, session_id, tipo
    INTO v_gallery
    FROM public.galerias
   WHERE id = p_gallery_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', true, 'already_deleted', true, 'gallery_id', p_gallery_id);
  END IF;

  IF v_user_id IS NOT NULL AND v_gallery.user_id <> v_user_id THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  WITH all_paths AS (
    SELECT UNNEST(ARRAY[storage_key, original_path, preview_path, preview_wm_path, thumb_path]) AS path
    FROM public.galeria_fotos WHERE galeria_id = p_gallery_id
  )
  SELECT COALESCE(jsonb_agg(DISTINCT path) FILTER (WHERE path IS NOT NULL AND path <> ''), '[]'::jsonb)
    INTO v_paths FROM all_paths;

  SELECT COUNT(*)::INT, COALESCE(SUM(COALESCE(file_size,0)), 0)::BIGINT
    INTO v_photo_count, v_storage_bytes
    FROM public.galeria_fotos WHERE galeria_id = p_gallery_id;

  SELECT COUNT(*)::INT INTO v_cobrancas_count
    FROM public.cobrancas WHERE galeria_id = p_gallery_id;

  IF v_gallery.session_id IS NOT NULL THEN
    INSERT INTO public.galerias_sessao_historico (
      user_id, session_id, gallery_id, nome_sessao, tipo, cliente_id,
      photo_count, cobrancas_preservadas, storage_bytes_freed, motivo, deleted_by
    ) VALUES (
      v_gallery.user_id, v_gallery.session_id, v_gallery.id, v_gallery.nome_sessao,
      v_gallery.tipo, v_gallery.cliente_id,
      v_photo_count, v_cobrancas_count, v_storage_bytes, p_motivo, v_user_id
    );
  END IF;

  INSERT INTO public.audit_log (action, actor_type, actor_id, resource_type, gallery_id, metadata)
  VALUES (
    'gallery_deleted',
    CASE WHEN v_user_id IS NULL THEN 'system' ELSE 'user' END,
    v_user_id,
    'gallery',
    NULL,
    jsonb_build_object(
      'gallery_id', p_gallery_id,
      'session_id', v_gallery.session_id,
      'nome_sessao', v_gallery.nome_sessao,
      'photo_count', v_photo_count,
      'cobrancas_preservadas', v_cobrancas_count,
      'storage_bytes_freed', v_storage_bytes,
      'motivo', p_motivo
    )
  );

  DELETE FROM public.galeria_fotos WHERE galeria_id = p_gallery_id;
  DELETE FROM public.galeria_pastas WHERE galeria_id = p_gallery_id;
  DELETE FROM public.visitante_selecoes
   WHERE visitante_id IN (SELECT id FROM public.galeria_visitantes WHERE galeria_id = p_gallery_id);
  DELETE FROM public.galeria_visitantes WHERE galeria_id = p_gallery_id;

  DELETE FROM public.galerias WHERE id = p_gallery_id;

  RETURN jsonb_build_object(
    'success', true,
    'gallery_id', p_gallery_id,
    'session_id', v_gallery.session_id,
    'paths_to_purge', v_paths,
    'photo_count', v_photo_count,
    'storage_bytes_freed', v_storage_bytes,
    'cobrancas_preservadas', v_cobrancas_count
  );
END;
$function$;

-- 3) Backfill de órfãos: audits que apontam para galerias inexistentes
UPDATE public.audit_log a
   SET metadata = COALESCE(a.metadata,'{}'::jsonb)
                 || jsonb_build_object('gallery_id_original', a.gallery_id),
       gallery_id = NULL
 WHERE a.gallery_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.galerias g WHERE g.id = a.gallery_id);
