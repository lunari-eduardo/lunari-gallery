-- 1. Fix orphaned cobrancas: link to galleries via session_id
UPDATE public.cobrancas c
SET galeria_id = g.id
FROM public.galerias g
WHERE c.galeria_id IS NULL
  AND c.session_id IS NOT NULL
  AND g.session_id = c.session_id;

-- 2. Sync galleries that have paid cobrancas but still show pendente
UPDATE public.galerias g
SET status_pagamento = 'pago',
    status_selecao = 'selecao_completa',
    finalized_at = COALESCE(g.finalized_at, c.data_pagamento, now()),
    updated_at = now()
FROM public.cobrancas c
WHERE c.galeria_id = g.id
  AND c.status = 'pago'
  AND g.status_pagamento != 'pago';

-- 3. Sync clientes_sessoes for affected galleries
UPDATE public.clientes_sessoes cs
SET status_galeria = 'selecao_completa',
    status_pagamento_fotos_extra = 'pago',
    updated_at = now()
FROM public.cobrancas c
WHERE c.session_id = cs.session_id
  AND c.status = 'pago'
  AND cs.status_pagamento_fotos_extra != 'pago';

-- 4. Recreate RPC with idempotency trap fix
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
  v_gallery_synced BOOLEAN := false;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_cobranca_id::text));

  SELECT * INTO v_cobranca
  FROM public.cobrancas
  WHERE id = p_cobranca_id
  FOR UPDATE;

  IF v_cobranca IS NULL THEN
    RETURN jsonb_build_object('success', false, 'already_paid', false, 'error', 'Cobrança não encontrada');
  END IF;

  -- Resolve galeria_id (needed for both already-paid and new-payment paths)
  v_galeria_id := v_cobranca.galeria_id;
  IF v_galeria_id IS NULL AND v_cobranca.session_id IS NOT NULL THEN
    SELECT id INTO v_galeria_id
    FROM public.galerias
    WHERE session_id = v_cobranca.session_id
    LIMIT 1;
    IF v_galeria_id IS NOT NULL THEN
      UPDATE public.cobrancas SET galeria_id = v_galeria_id WHERE id = p_cobranca_id;
    END IF;
  END IF;

  -- Already paid — but check if gallery is out of sync
  IF v_cobranca.status = 'pago' THEN
    IF v_galeria_id IS NOT NULL THEN
      PERFORM 1 FROM public.galerias
      WHERE id = v_galeria_id AND status_pagamento != 'pago';
      IF FOUND THEN
        UPDATE public.galerias
        SET status_pagamento = 'pago', status_selecao = 'selecao_completa',
            finalized_at = COALESCE(finalized_at, v_cobranca.data_pagamento, now()),
            updated_at = now()
        WHERE id = v_galeria_id;
        IF v_cobranca.session_id IS NOT NULL THEN
          UPDATE public.clientes_sessoes
          SET status_galeria = 'selecao_completa', status_pagamento_fotos_extra = 'pago', updated_at = now()
          WHERE session_id = v_cobranca.session_id;
        END IF;
        v_gallery_synced := true;
      END IF;
    END IF;
    RETURN jsonb_build_object('success', true, 'already_paid', true,
      'gallery_synced', v_gallery_synced, 'galeria_id', v_galeria_id);
  END IF;

  -- Mark cobrança as paid (any non-pago status accepted — chave mestra)
  UPDATE public.cobrancas
  SET status = 'pago', data_pagamento = p_paid_at,
      ip_receipt_url = COALESCE(p_receipt_url, ip_receipt_url)
  WHERE id = p_cobranca_id AND status != 'pago';

  -- Update gallery
  IF v_galeria_id IS NOT NULL THEN
    UPDATE public.galerias
    SET total_fotos_extras_vendidas = COALESCE(total_fotos_extras_vendidas, 0) + COALESCE(v_cobranca.qtd_fotos, 0),
        valor_total_vendido = COALESCE(valor_total_vendido, 0) + COALESCE(v_cobranca.valor, 0),
        status_pagamento = 'pago', status_selecao = 'selecao_completa',
        finalized_at = p_paid_at
    WHERE id = v_galeria_id;
  END IF;

  -- Update session
  IF v_cobranca.session_id IS NOT NULL THEN
    UPDATE public.clientes_sessoes
    SET status_galeria = 'selecao_completa', status_pagamento_fotos_extra = 'pago', updated_at = now()
    WHERE session_id = v_cobranca.session_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'already_paid', false,
    'cobranca_id', p_cobranca_id, 'galeria_id', v_galeria_id,
    'session_id', v_cobranca.session_id, 'valor', v_cobranca.valor, 'qtd_fotos', v_cobranca.qtd_fotos);
END;
$$;