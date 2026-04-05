
-- 1. Create set_session_extras RPC (absolute values, replaces incremental logic)
CREATE OR REPLACE FUNCTION public.set_session_extras(
  p_session_id TEXT,
  p_total_extras INTEGER,
  p_valor_unitario NUMERIC,
  p_total_valor NUMERIC,
  p_status_galeria TEXT DEFAULT 'em_selecao'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE clientes_sessoes
  SET
    qtd_fotos_extra = p_total_extras,
    valor_foto_extra = p_valor_unitario,
    valor_total_foto_extra = p_total_valor,
    status_galeria = p_status_galeria,
    updated_at = now()
  WHERE session_id = p_session_id;
END;
$$;

-- 2. Update finalize_gallery_payment to sync session with gallery after payment
CREATE OR REPLACE FUNCTION public.finalize_gallery_payment(p_cobranca_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cobranca RECORD;
  v_galeria_id UUID;
  v_extras_vendidas INTEGER;
  v_valor_vendido NUMERIC;
BEGIN
  -- Get cobranca data
  SELECT * INTO v_cobranca FROM cobrancas WHERE id = p_cobranca_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cobrança % não encontrada', p_cobranca_id;
  END IF;

  v_galeria_id := v_cobranca.galeria_id;

  -- Update cobranca status to paid
  UPDATE cobrancas
  SET status = 'pago',
      data_pagamento = COALESCE(data_pagamento, now()),
      updated_at = now()
  WHERE id = p_cobranca_id
    AND status != 'pago';

  -- Update gallery: increment sold extras and mark as paid
  UPDATE galerias
  SET total_fotos_extras_vendidas = COALESCE(total_fotos_extras_vendidas, 0) + COALESCE(v_cobranca.qtd_fotos, 0),
      valor_total_vendido = COALESCE(valor_total_vendido, 0) + v_cobranca.valor,
      status_selecao = 'selecao_completa',
      status_pagamento = 'pago',
      finalized_at = COALESCE(finalized_at, now()),
      updated_at = now()
  WHERE id = v_galeria_id;

  -- Get updated gallery values (source of truth)
  SELECT total_fotos_extras_vendidas, valor_total_vendido
  INTO v_extras_vendidas, v_valor_vendido
  FROM galerias WHERE id = v_galeria_id;

  -- Sync session with gallery values (absolute, not incremental)
  IF v_cobranca.session_id IS NOT NULL THEN
    UPDATE clientes_sessoes
    SET qtd_fotos_extra = COALESCE(v_extras_vendidas, 0),
        valor_total_foto_extra = COALESCE(v_valor_vendido, 0),
        status_galeria = 'selecao_completa',
        status_pagamento_fotos_extra = 'pago',
        updated_at = now()
    WHERE session_id = v_cobranca.session_id;
  END IF;
END;
$$;

-- 3. Backfill: fix Ayla session
UPDATE clientes_sessoes
SET qtd_fotos_extra = 4,
    valor_total_foto_extra = 92,
    updated_at = now()
WHERE session_id = (
  SELECT session_id FROM galerias WHERE id = 'f9e617b4-8968-4f1b-a5fc-8b8301ff94bb'
)
AND session_id IS NOT NULL;
