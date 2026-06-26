
ALTER TABLE public.cobrancas DROP CONSTRAINT IF EXISTS cobrancas_extras_requires_galeria_chk;

-- Substitui o trigger para permitir SET NULL quando a galeria é excluída (DELETE).
-- Continua bloqueando inserts/updates "manuais" sem galeria.
CREATE OR REPLACE FUNCTION public.tg_cobrancas_no_orphan_extra()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Permite a transição galeria_id -> NULL durante a exclusão da galeria (cascata da FK).
  IF TG_OP = 'UPDATE' AND OLD.galeria_id IS NOT NULL AND NEW.galeria_id IS NULL THEN
    RETURN NEW;
  END IF;

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

CREATE TABLE IF NOT EXISTS public.galerias_sessao_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  session_id TEXT NOT NULL,
  gallery_id UUID NOT NULL,
  nome_sessao TEXT,
  tipo TEXT,
  cliente_id UUID,
  photo_count INT DEFAULT 0,
  cobrancas_preservadas INT DEFAULT 0,
  storage_bytes_freed BIGINT DEFAULT 0,
  motivo TEXT NOT NULL DEFAULT 'manual',
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_galerias_sessao_hist_session ON public.galerias_sessao_historico (session_id);
CREATE INDEX IF NOT EXISTS idx_galerias_sessao_hist_user ON public.galerias_sessao_historico (user_id);

GRANT SELECT, INSERT ON public.galerias_sessao_historico TO authenticated;
GRANT ALL ON public.galerias_sessao_historico TO service_role;
ALTER TABLE public.galerias_sessao_historico ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owners read history" ON public.galerias_sessao_historico;
CREATE POLICY "owners read history" ON public.galerias_sessao_historico
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "service role full history" ON public.galerias_sessao_historico;
CREATE POLICY "service role full history" ON public.galerias_sessao_historico
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.galerias ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
UPDATE public.galerias SET expires_at = created_at + INTERVAL '12 months' WHERE expires_at IS NULL;
ALTER TABLE public.galerias ALTER COLUMN expires_at SET DEFAULT (now() + INTERVAL '12 months');

CREATE OR REPLACE FUNCTION public.tg_galerias_set_expires_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.expires_at IS NULL THEN
    NEW.expires_at := COALESCE(NEW.created_at, now()) + INTERVAL '12 months';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_galerias_set_expires_at ON public.galerias;
CREATE TRIGGER trg_galerias_set_expires_at
  BEFORE INSERT ON public.galerias
  FOR EACH ROW EXECUTE FUNCTION public.tg_galerias_set_expires_at();

CREATE OR REPLACE FUNCTION public.delete_gallery_complete(
  p_gallery_id UUID,
  p_motivo TEXT DEFAULT 'manual'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
    'gallery_deleted', CASE WHEN v_user_id IS NULL THEN 'system' ELSE 'user' END,
    v_user_id, 'gallery', p_gallery_id,
    jsonb_build_object(
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
$$;
GRANT EXECUTE ON FUNCTION public.delete_gallery_complete(UUID, TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.archive_gallery(p_gallery_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN public.delete_gallery_complete(p_gallery_id, 'manual');
END $$;
GRANT EXECUTE ON FUNCTION public.archive_gallery(UUID) TO authenticated, service_role;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.galerias WHERE deleted_at IS NOT NULL LOOP
    PERFORM public.delete_gallery_complete(r.id, 'system_cleanup');
  END LOOP;
END $$;
