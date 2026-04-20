-- Update prepare_gallery_share to optionally skip marking as 'enviado'
-- When p_mark_as_sent=false (used during initial publish), the gallery
-- gets a public_token but stays as 'rascunho' (badge "Criada"), and no
-- 'enviada' action is logged. Default true preserves existing callers.

CREATE OR REPLACE FUNCTION public.prepare_gallery_share(
  p_gallery_id uuid,
  p_mark_as_sent boolean DEFAULT true
)
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

  -- Only promote status to 'enviado' when explicitly marking as sent
  v_new_status := v_gallery.status;
  IF p_mark_as_sent AND v_gallery.status = 'rascunho' THEN
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

  -- Idempotent action log (only when marking as sent)
  IF p_mark_as_sent THEN
    INSERT INTO galeria_acoes (galeria_id, user_id, tipo, descricao)
    SELECT p_gallery_id, v_user_id, 'enviada', 'Galeria enviada para o cliente'
    WHERE NOT EXISTS (
      SELECT 1 FROM galeria_acoes
      WHERE galeria_id = p_gallery_id AND tipo = 'enviada'
    );
  END IF;

  RETURN json_build_object(
    'token', v_token,
    'status', v_new_status,
    'ready', true
  );
END;
$$;