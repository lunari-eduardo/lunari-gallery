
-- 1. Fix orphaned cobrancas: link to galleries via session_id
UPDATE public.cobrancas c
SET galeria_id = g.id
FROM public.galerias g
WHERE c.galeria_id IS NULL
  AND c.session_id IS NOT NULL
  AND g.session_id = c.session_id;

-- 2. Recreate RPC with fixes:
--    a) Accept any non-pago status (chave mestra)
--    b) Fallback: resolve galeria_id from session_id when NULL
CREATE OR REPLACE FUNCTION public.finalize_gallery_payment(
  p_cobranca_id UUID,
  p_receipt_url TEXT DEFAULT NULL,
  p_paid_at TIMESTAMPTZ DEFAULT now()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cobranca RECORD;
  v_galeria_id UUID;
  v_result JSONB;
BEGIN
  -- Advisory lock to prevent race conditions on the same cobrança
  PERFORM pg_advisory_xact_lock(hashtext(p_cobranca_id::text));

  -- Select cobrança FOR UPDATE
  SELECT * INTO v_cobranca
  FROM public.cobrancas
  WHERE id = p_cobranca_id
  FOR UPDATE;

  IF v_cobranca IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'already_paid', false,
      'error', 'Cobrança não encontrada'
    );
  END IF;

  -- Idempotent: already paid
  IF v_cobranca.status = 'pago' THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_paid', true,
      'cobranca_id', p_cobranca_id
    );
  END IF;

  -- 1. Update cobrança to pago — accept ANY non-pago status (chave mestra)
  UPDATE public.cobrancas
  SET status = 'pago',
      data_pagamento = p_paid_at,
      ip_receipt_url = COALESCE(p_receipt_url, ip_receipt_url)
  WHERE id = p_cobranca_id
    AND status != 'pago';

  -- Resolve galeria_id: use cobranca field, fallback to session_id lookup
  v_galeria_id := v_cobranca.galeria_id;
  IF v_galeria_id IS NULL AND v_cobranca.session_id IS NOT NULL THEN
    SELECT id INTO v_galeria_id
    FROM public.galerias
    WHERE session_id = v_cobranca.session_id
    LIMIT 1;

    -- Also fix the cobranca record for future reference
    IF v_galeria_id IS NOT NULL THEN
      UPDATE public.cobrancas
      SET galeria_id = v_galeria_id
      WHERE id = p_cobranca_id;
    END IF;
  END IF;

  -- 2. Update gallery with atomic increments
  IF v_galeria_id IS NOT NULL THEN
    UPDATE public.galerias
    SET total_fotos_extras_vendidas = COALESCE(total_fotos_extras_vendidas, 0) + COALESCE(v_cobranca.qtd_fotos, 0),
        valor_total_vendido = COALESCE(valor_total_vendido, 0) + COALESCE(v_cobranca.valor, 0),
        status_pagamento = 'pago',
        status_selecao = 'selecao_completa',
        finalized_at = p_paid_at
    WHERE id = v_galeria_id;
  END IF;

  -- 3. Update session status
  IF v_cobranca.session_id IS NOT NULL THEN
    UPDATE public.clientes_sessoes
    SET status_galeria = 'selecao_completa',
        status_pagamento_fotos_extra = 'pago',
        updated_at = now()
    WHERE session_id = v_cobranca.session_id;
  END IF;

  -- Note: trigger ensure_transaction_on_cobranca_paid auto-creates clientes_transacoes
  -- Note: trigger trigger_recompute_session_paid auto-recalculates valor_pago

  RETURN jsonb_build_object(
    'success', true,
    'already_paid', false,
    'cobranca_id', p_cobranca_id,
    'galeria_id', v_galeria_id,
    'session_id', v_cobranca.session_id,
    'valor', v_cobranca.valor,
    'qtd_fotos', v_cobranca.qtd_fotos
  );
END;
$$;
