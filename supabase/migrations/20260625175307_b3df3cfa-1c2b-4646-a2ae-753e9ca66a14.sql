
-- 1. Colunas de arquivamento em galerias
ALTER TABLE public.galerias
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS deleted_by UUID NULL,
  ADD COLUMN IF NOT EXISTS deleted_reason TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_galerias_active_user
  ON public.galerias(user_id)
  WHERE deleted_at IS NULL;

-- 2. Relaxar CHECK em cobrancas: só exige galeria_id quando finalidade='fotos_extras'
--    E status indica cobrança ativa (não cancelada/expirada)
ALTER TABLE public.cobrancas
  DROP CONSTRAINT IF EXISTS cobrancas_extras_requires_galeria_chk;

ALTER TABLE public.cobrancas
  ADD CONSTRAINT cobrancas_extras_requires_galeria_chk
  CHECK (
    finalidade <> 'fotos_extras'
    OR galeria_id IS NOT NULL
    OR status IN ('cancelado', 'expirado')
  );

-- 3. Trigger anti-órfão (suspensórios em cima do CHECK)
CREATE OR REPLACE FUNCTION public.tg_cobrancas_no_orphan_extra()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.finalidade = 'fotos_extras'
     AND NEW.galeria_id IS NULL
     AND COALESCE(NEW.status, 'pendente') NOT IN ('cancelado', 'expirado') THEN
    RAISE EXCEPTION 'COBRANCA_EXTRA_ORFA: cobrança de fotos_extras (id=%) requer galeria_id quando status=%',
      NEW.id, NEW.status
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_cobrancas_no_orphan_extra ON public.cobrancas;
CREATE TRIGGER tg_cobrancas_no_orphan_extra
  BEFORE INSERT OR UPDATE ON public.cobrancas
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_cobrancas_no_orphan_extra();

-- 4. RPC principal: archive_gallery
CREATE OR REPLACE FUNCTION public.archive_gallery(p_gallery_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- Bloqueia linha contra concorrência
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

  -- Idempotente
  IF v_gallery.deleted_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_archived', true,
      'gallery_id', p_gallery_id
    );
  END IF;

  -- Coleta paths únicos do R2 antes de apagar
  WITH all_paths AS (
    SELECT UNNEST(ARRAY[
      storage_key, original_path, preview_path, preview_wm_path, thumb_path
    ]) AS path,
    COALESCE(size_bytes, 0) AS size_bytes
    FROM public.galeria_fotos
    WHERE galeria_id = p_gallery_id
  )
  SELECT
    COALESCE(jsonb_agg(DISTINCT path) FILTER (WHERE path IS NOT NULL AND path <> ''), '[]'::jsonb)
    INTO v_paths
    FROM all_paths;

  SELECT COUNT(*)::INT, COALESCE(SUM(COALESCE(size_bytes,0)), 0)::BIGINT
    INTO v_photo_count, v_storage_bytes
    FROM public.galeria_fotos
   WHERE galeria_id = p_gallery_id;

  -- Conta cobranças preservadas (para auditoria)
  SELECT COUNT(*)::INT INTO v_cobrancas_count
    FROM public.cobrancas
   WHERE galeria_id = p_gallery_id;

  -- Apaga fotos do banco (R2 será purgado pela edge function)
  DELETE FROM public.galeria_fotos WHERE galeria_id = p_gallery_id;

  -- Apaga pastas
  DELETE FROM public.galeria_pastas WHERE galeria_id = p_gallery_id;

  -- Apaga visitantes / seleções de visitantes
  DELETE FROM public.visitante_selecoes
   WHERE visitante_id IN (
     SELECT id FROM public.galeria_visitantes WHERE galeria_id = p_gallery_id
   );
  DELETE FROM public.galeria_visitantes WHERE galeria_id = p_gallery_id;

  -- Revoga aliases públicos
  BEGIN
    UPDATE public.gallery_token_aliases
       SET revoked = true
     WHERE gallery_id = p_gallery_id;
  EXCEPTION WHEN undefined_column THEN
    -- Se a tabela não tiver coluna 'revoked', apaga os aliases
    DELETE FROM public.gallery_token_aliases WHERE gallery_id = p_gallery_id;
  END;

  -- Marca galeria como arquivada (preserva FK para cobranças)
  UPDATE public.galerias
     SET deleted_at = now(),
         deleted_by = v_user_id,
         public_token = NULL,
         updated_at = now()
   WHERE id = p_gallery_id;

  -- Log de auditoria
  INSERT INTO public.galeria_acoes (galeria_id, tipo, descricao, payload)
  VALUES (
    p_gallery_id,
    'gallery_archived',
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
    'success', true,
    'gallery_id', p_gallery_id,
    'paths_to_purge', v_paths,
    'photo_count', v_photo_count,
    'storage_bytes_freed', v_storage_bytes,
    'cobrancas_preservadas', v_cobrancas_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.archive_gallery(UUID) TO authenticated, service_role;

-- 5. Guards em RPCs existentes (bloqueia operação em galeria arquivada)
CREATE OR REPLACE FUNCTION public.assert_gallery_not_archived(p_gallery_id UUID)
RETURNS VOID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_at TIMESTAMPTZ;
BEGIN
  SELECT deleted_at INTO v_deleted_at
    FROM public.galerias
   WHERE id = p_gallery_id;
  IF v_deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'GALLERY_ARCHIVED: operação não permitida em galeria arquivada (id=%)', p_gallery_id
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.assert_gallery_not_archived(UUID) TO authenticated, service_role;
