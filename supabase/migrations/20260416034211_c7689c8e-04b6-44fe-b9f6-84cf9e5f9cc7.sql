
-- 1. Drop old constraint and add new one with 'processando_selecao'
ALTER TABLE public.galeria_visitantes
DROP CONSTRAINT IF EXISTS galeria_visitantes_status_selecao_check;

ALTER TABLE public.galeria_visitantes
ADD CONSTRAINT galeria_visitantes_status_selecao_check
CHECK (status_selecao IN ('selecao_iniciada', 'processando_selecao', 'selecao_completa', 'aguardando_pagamento'));

-- 2. Auto-heal any visitors stuck in bad state from previous failed attempts
UPDATE public.galeria_visitantes
SET status_selecao = 'selecao_iniciada', updated_at = NOW()
WHERE status_selecao = 'processando_selecao'
  AND updated_at < NOW() - INTERVAL '10 minutes';

-- 3. Recreate the RPC with hashtext-based lock (safe for UUIDs)
CREATE OR REPLACE FUNCTION public.try_lock_visitor_selection(p_visitor_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_visitor galeria_visitantes%ROWTYPE;
  v_gallery galerias%ROWTYPE;
  v_lock_acquired BOOLEAN;
BEGIN
  -- 1. Fetch visitor with row lock
  SELECT * INTO v_visitor
  FROM galeria_visitantes
  WHERE id = p_visitor_id
  FOR UPDATE NOWAIT;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('locked', false, 'reason', 'visitor_not_found');
  END IF;

  -- 2. Check visitor status
  IF v_visitor.status = 'finalizado' THEN
    PERFORM 1 FROM cobrancas
    WHERE visitor_id = p_visitor_id
      AND status = 'pendente'
      AND created_at < NOW() - INTERVAL '24 hours';
    IF NOT FOUND THEN
      RETURN jsonb_build_object('locked', false, 'reason', 'already_finalized');
    END IF;
  END IF;

  IF v_visitor.status_selecao = 'processando_selecao' THEN
    IF v_visitor.updated_at > NOW() - INTERVAL '5 minutes' THEN
      RETURN jsonb_build_object('locked', false, 'reason', 'already_processing');
    END IF;
  END IF;

  -- 3. Acquire advisory lock using hashtext (safe for UUIDs with hyphens)
  v_lock_acquired := pg_try_advisory_xact_lock(hashtext('visitor_selection_' || p_visitor_id::text));
  IF NOT v_lock_acquired THEN
    RETURN jsonb_build_object('locked', false, 'reason', 'concurrent_lock');
  END IF;

  -- 4. Mark visitor as processing
  UPDATE galeria_visitantes
  SET status_selecao = 'processando_selecao',
      updated_at = NOW()
  WHERE id = p_visitor_id;

  -- 5. Fetch gallery data for pricing
  SELECT * INTO v_gallery
  FROM galerias
  WHERE id = v_visitor.galeria_id;

  RETURN jsonb_build_object(
    'locked', true,
    'gallery', jsonb_build_object(
      'id', v_gallery.id,
      'status', v_gallery.status,
      'status_selecao', v_gallery.status_selecao,
      'finalized_at', v_gallery.finalized_at,
      'user_id', v_gallery.user_id,
      'session_id', v_gallery.session_id,
      'cliente_id', v_gallery.cliente_id,
      'fotos_incluidas', v_gallery.fotos_incluidas,
      'valor_foto_extra', v_gallery.valor_foto_extra,
      'nome_sessao', v_gallery.nome_sessao,
      'configuracoes', v_gallery.configuracoes,
      'public_token', v_gallery.public_token,
      'total_fotos_extras_vendidas', v_gallery.total_fotos_extras_vendidas,
      'valor_total_vendido', v_gallery.valor_total_vendido,
      'regras_congeladas', v_gallery.regras_congeladas,
      'permissao', v_gallery.permissao
    ),
    'visitor', jsonb_build_object(
      'id', v_visitor.id,
      'nome', v_visitor.nome,
      'contato', v_visitor.contato
    )
  );
END;
$$;
