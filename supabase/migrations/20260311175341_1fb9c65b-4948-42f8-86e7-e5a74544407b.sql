
CREATE OR REPLACE FUNCTION public.atomic_update_session_extras(
  p_session_id TEXT,
  p_extras_increment INTEGER,
  p_valor_unitario NUMERIC,
  p_valor_increment NUMERIC,
  p_status_galeria TEXT DEFAULT 'em_selecao'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE public.clientes_sessoes
  SET 
    qtd_fotos_extra = COALESCE(qtd_fotos_extra, 0) + p_extras_increment,
    valor_foto_extra = p_valor_unitario,
    valor_total_foto_extra = COALESCE(valor_total_foto_extra, 0) + p_valor_increment,
    status_galeria = p_status_galeria,
    updated_at = now()
  WHERE session_id = p_session_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', v_updated > 0,
    'rows_updated', v_updated
  );
END;
$$;
