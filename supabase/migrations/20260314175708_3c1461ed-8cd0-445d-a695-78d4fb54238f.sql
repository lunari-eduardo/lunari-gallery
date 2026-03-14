
-- RPC: prepare_gallery_share
-- Atomically ensures a gallery is ready for sharing:
-- 1) Validates ownership (auth.uid())
-- 2) Generates public_token if missing
-- 3) Sets published_at if missing
-- 4) Updates status from 'rascunho' to 'enviado' with enviado_em
-- 5) Logs 'enviada' action idempotently
-- Returns JSON with token, status, ready

CREATE OR REPLACE FUNCTION public.prepare_gallery_share(p_gallery_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gallery record;
  v_token text;
  v_new_status text;
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('error', 'Não autenticado', 'ready', false);
  END IF;

  -- Lock the gallery row for update
  SELECT id, user_id, status, public_token, published_at, enviado_em, prazo_selecao, prazo_selecao_dias
  INTO v_gallery
  FROM galerias
  WHERE id = p_gallery_id
  FOR UPDATE;

  IF v_gallery IS NULL THEN
    RETURN json_build_object('error', 'Galeria não encontrada', 'ready', false);
  END IF;

  -- Validate ownership
  IF v_gallery.user_id != v_user_id THEN
    RETURN json_build_object('error', 'Sem permissão', 'ready', false);
  END IF;

  -- Generate token if missing
  v_token := COALESCE(v_gallery.public_token, generate_public_token());

  -- Determine new status
  v_new_status := v_gallery.status;
  IF v_gallery.status = 'rascunho' THEN
    v_new_status := 'enviado';
  END IF;

  -- Atomic update
  UPDATE galerias
  SET
    public_token = v_token,
    published_at = COALESCE(published_at, now()),
    status = v_new_status,
    enviado_em = CASE WHEN v_new_status = 'enviado' THEN COALESCE(enviado_em, now()) ELSE enviado_em END,
    prazo_selecao = COALESCE(prazo_selecao, now() + (COALESCE(prazo_selecao_dias, 7) || ' days')::interval),
    updated_at = now()
  WHERE id = p_gallery_id;

  -- Idempotent action log (only insert if no 'enviada' action exists)
  INSERT INTO galeria_acoes (galeria_id, user_id, tipo, descricao)
  SELECT p_gallery_id, v_user_id, 'enviada', 'Galeria enviada para o cliente'
  WHERE NOT EXISTS (
    SELECT 1 FROM galeria_acoes
    WHERE galeria_id = p_gallery_id AND tipo = 'enviada'
  );

  RETURN json_build_object(
    'token', v_token,
    'status', v_new_status,
    'ready', true
  );
END;
$$;
