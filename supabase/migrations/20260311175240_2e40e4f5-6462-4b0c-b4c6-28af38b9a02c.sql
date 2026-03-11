
CREATE OR REPLACE FUNCTION public.try_lock_gallery_selection(p_gallery_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_gallery RECORD;
BEGIN
  -- Advisory lock to prevent concurrent execution for the same gallery
  PERFORM pg_advisory_xact_lock(hashtext('gallery_selection_' || p_gallery_id::text));

  -- Select gallery FOR UPDATE (row-level lock)
  SELECT * INTO v_gallery
  FROM public.galerias
  WHERE id = p_gallery_id
  FOR UPDATE;

  IF v_gallery IS NULL THEN
    RETURN jsonb_build_object('locked', false, 'reason', 'gallery_not_found');
  END IF;

  -- Check if already in a terminal or processing state
  IF v_gallery.status_selecao IN ('selecao_completa', 'processando_selecao', 'aguardando_pagamento') THEN
    RETURN jsonb_build_object('locked', false, 'reason', 'already_processing', 'current_status', v_gallery.status_selecao);
  END IF;

  IF v_gallery.finalized_at IS NOT NULL THEN
    RETURN jsonb_build_object('locked', false, 'reason', 'already_finalized');
  END IF;

  -- Mark as processing (transient state)
  UPDATE public.galerias
  SET status_selecao = 'processando_selecao',
      updated_at = now()
  WHERE id = p_gallery_id;

  -- Return lock acquired + gallery data
  RETURN jsonb_build_object(
    'locked', true,
    'gallery', row_to_json(v_gallery)
  );
END;
$$;
