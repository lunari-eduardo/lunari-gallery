
CREATE OR REPLACE FUNCTION public.try_lock_gallery_selection(p_gallery_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_gallery RECORD;
  v_stale_lock BOOLEAN := FALSE;
  v_expired_payment BOOLEAN := FALSE;
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

  IF v_gallery.finalized_at IS NOT NULL THEN
    RETURN jsonb_build_object('locked', false, 'reason', 'already_finalized');
  END IF;

  -- Already complete = blocked
  IF v_gallery.status_selecao = 'selecao_completa' THEN
    RETURN jsonb_build_object('locked', false, 'reason', 'already_processing', 'current_status', v_gallery.status_selecao);
  END IF;

  -- TTL: Allow retry if processando_selecao is older than 5 minutes (stale lock)
  IF v_gallery.status_selecao = 'processando_selecao' THEN
    IF v_gallery.updated_at < now() - INTERVAL '5 minutes' THEN
      v_stale_lock := TRUE;
      RAISE NOTICE 'Stale lock detected for gallery %, updated_at=%, allowing retry', p_gallery_id, v_gallery.updated_at;
    ELSE
      RETURN jsonb_build_object('locked', false, 'reason', 'already_processing', 'current_status', v_gallery.status_selecao);
    END IF;
  END IF;

  -- Allow retry for aguardando_pagamento if latest cobrança is expired (>24h pending)
  IF v_gallery.status_selecao = 'aguardando_pagamento' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.cobrancas
      WHERE galeria_id = p_gallery_id
        AND status = 'pendente'
        AND created_at > now() - INTERVAL '24 hours'
    ) INTO v_expired_payment;
    
    -- v_expired_payment = TRUE means there's a RECENT pending charge, so block
    IF v_expired_payment THEN
      RETURN jsonb_build_object('locked', false, 'reason', 'already_processing', 'current_status', v_gallery.status_selecao);
    ELSE
      RAISE NOTICE 'Expired payment detected for gallery %, allowing retry', p_gallery_id;
    END IF;
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
$function$;

-- Reset stuck galleries
UPDATE public.galerias 
SET status_selecao = 'selecao_iniciada', updated_at = now()
WHERE status_selecao = 'processando_selecao' 
  AND updated_at < now() - INTERVAL '5 minutes';
