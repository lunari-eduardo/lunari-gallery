
-- Add manual payment fields to cobrancas
ALTER TABLE public.cobrancas
ADD COLUMN IF NOT EXISTS metodo_manual text,
ADD COLUMN IF NOT EXISTS obs_manual text;

-- Update RPC to accept manual payment fields
CREATE OR REPLACE FUNCTION public.finalize_gallery_payment(
  p_cobranca_id UUID,
  p_receipt_url TEXT DEFAULT NULL,
  p_paid_at TIMESTAMPTZ DEFAULT now(),
  p_manual_method TEXT DEFAULT NULL,
  p_manual_obs TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cobranca RECORD;
  v_galeria_id UUID;
  v_gallery_synced BOOLEAN := false;
  v_final_status TEXT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_cobranca_id::text));

  SELECT * INTO v_cobranca
  FROM public.cobrancas
  WHERE id = p_cobranca_id
  FOR UPDATE;

  IF v_cobranca IS NULL THEN
    RETURN jsonb_build_object('success', false, 'already_paid', false, 'error', 'Cobrança não encontrada');
  END IF;

  v_final_status := CASE WHEN p_manual_method IS NOT NULL THEN 'pago_manual' ELSE 'pago' END;

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

  IF v_cobranca.status IN ('pago', 'pago_manual') THEN
    IF v_galeria_id IS NOT NULL THEN
      PERFORM 1 FROM public.galerias
      WHERE id = v_galeria_id AND status_pagamento NOT IN ('pago', 'pago_manual');
      IF FOUND THEN
        UPDATE public.galerias
        SET status_pagamento = v_cobranca.status, status_selecao = 'selecao_completa',
            finalized_at = COALESCE(finalized_at, v_cobranca.data_pagamento, now()),
            updated_at = now()
        WHERE id = v_galeria_id;
        IF v_cobranca.session_id IS NOT NULL THEN
          UPDATE public.clientes_sessoes
          SET status_galeria = 'selecao_completa', status_pagamento_fotos_extra = v_cobranca.status, updated_at = now()
          WHERE session_id = v_cobranca.session_id;
        END IF;
        v_gallery_synced := true;
      END IF;
    END IF;
    RETURN jsonb_build_object('success', true, 'already_paid', true,
      'gallery_synced', v_gallery_synced, 'galeria_id', v_galeria_id);
  END IF;

  UPDATE public.cobrancas
  SET status = v_final_status, data_pagamento = p_paid_at,
      ip_receipt_url = COALESCE(p_receipt_url, ip_receipt_url),
      metodo_manual = COALESCE(p_manual_method, metodo_manual),
      obs_manual = COALESCE(p_manual_obs, obs_manual)
  WHERE id = p_cobranca_id AND status NOT IN ('pago', 'pago_manual');

  IF v_galeria_id IS NOT NULL THEN
    UPDATE public.galerias
    SET total_fotos_extras_vendidas = COALESCE(total_fotos_extras_vendidas, 0) + COALESCE(v_cobranca.qtd_fotos, 0),
        valor_total_vendido = COALESCE(valor_total_vendido, 0) + COALESCE(v_cobranca.valor, 0),
        status_pagamento = v_final_status, status_selecao = 'selecao_completa',
        finalized_at = p_paid_at
    WHERE id = v_galeria_id;
  END IF;

  IF v_cobranca.session_id IS NOT NULL THEN
    UPDATE public.clientes_sessoes
    SET status_galeria = 'selecao_completa', status_pagamento_fotos_extra = v_final_status, updated_at = now()
    WHERE session_id = v_cobranca.session_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'already_paid', false,
    'cobranca_id', p_cobranca_id, 'galeria_id', v_galeria_id,
    'session_id', v_cobranca.session_id, 'valor', v_cobranca.valor, 'qtd_fotos', v_cobranca.qtd_fotos);
END;
$$;
