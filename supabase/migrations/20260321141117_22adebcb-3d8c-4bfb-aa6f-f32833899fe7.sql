
-- Drop old 3-param overload to avoid ambiguity
DROP FUNCTION IF EXISTS public.finalize_gallery_payment(uuid, text, timestamptz);

-- Recreate the canonical 5-param RPC
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
    RETURN jsonb_build_object('success', false, 'already_paid', false, 'error', 'Cobranca nao encontrada');
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
      obs_manual = COALESCE(p_manual_obs, obs_manual),
      updated_at = now()
  WHERE id = p_cobranca_id AND status NOT IN ('pago', 'pago_manual');

  IF v_galeria_id IS NOT NULL THEN
    UPDATE public.galerias
    SET total_fotos_extras_vendidas = COALESCE(total_fotos_extras_vendidas, 0) + COALESCE(v_cobranca.qtd_fotos, 0),
        valor_total_vendido = COALESCE(valor_total_vendido, 0) + COALESCE(v_cobranca.valor, 0),
        status_pagamento = v_final_status, status_selecao = 'selecao_completa',
        finalized_at = p_paid_at, updated_at = now()
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

-- Update trigger to accept pago_manual
CREATE OR REPLACE FUNCTION public.ensure_transaction_on_cobranca_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_text TEXT;
  v_cliente_id UUID;
  v_existing_tx UUID;
  v_valor_transacao NUMERIC;
  v_valor_liquido NUMERIC;
  v_taxa_gateway NUMERIC;
  v_taxa_antecipacao NUMERIC;
  v_session_exists BOOLEAN;
  v_provedor_label TEXT;
BEGIN
  IF NEW.status IN ('pago', 'pago_manual') AND (OLD.status IS NULL OR OLD.status NOT IN ('pago', 'pago_manual')) THEN
    IF NEW.session_id IS NULL THEN
      RETURN NEW;
    END IF;
    
    v_valor_transacao := NEW.valor;
    v_valor_liquido := NEW.valor_liquido;
    
    IF v_valor_liquido IS NOT NULL AND v_valor_liquido > 0 THEN
      v_taxa_gateway := ROUND(v_valor_transacao - v_valor_liquido, 2);
    ELSE
      v_taxa_gateway := 0;
    END IF;
    
    v_taxa_antecipacao := 0;
    IF NEW.dados_extras IS NOT NULL AND (NEW.dados_extras->>'taxa_antecipacao') IS NOT NULL THEN
      v_taxa_antecipacao := (NEW.dados_extras->>'taxa_antecipacao')::NUMERIC;
      IF v_taxa_antecipacao > 0 AND v_taxa_gateway >= v_taxa_antecipacao THEN
        v_taxa_gateway := v_taxa_gateway - v_taxa_antecipacao;
      END IF;
    END IF;
    
    SELECT session_id, cliente_id INTO v_session_text, v_cliente_id
    FROM public.clientes_sessoes
    WHERE session_id = NEW.session_id OR id::text = NEW.session_id
    LIMIT 1;
    
    v_session_exists := (v_session_text IS NOT NULL);
    
    IF NOT v_session_exists THEN
      v_session_text := NULL;
      v_cliente_id := NEW.cliente_id;
    END IF;
    
    IF v_cliente_id IS NULL THEN
      v_cliente_id := NEW.cliente_id;
    END IF;
    
    IF v_cliente_id IS NULL THEN
      RETURN NEW;
    END IF;
    
    SELECT id INTO v_existing_tx
    FROM public.clientes_transacoes
    WHERE tipo = 'pagamento'
      AND descricao ILIKE '%cobranca ' || NEW.id::text || '%'
    LIMIT 1;
    
    v_provedor_label := CASE
      WHEN NEW.provedor = 'infinitepay' THEN 'InfinitePay'
      WHEN NEW.provedor = 'mercadopago' THEN 'Mercado Pago'
      WHEN NEW.provedor = 'asaas' THEN 'Asaas'
      WHEN NEW.provedor = 'manual' THEN COALESCE(NEW.metodo_manual, 'Manual')
      ELSE COALESCE(NEW.provedor, 'manual')
    END;
    
    IF v_existing_tx IS NULL THEN
      INSERT INTO public.clientes_transacoes (
        user_id, cliente_id, session_id, valor, valor_liquido, taxa_gateway, taxa_antecipacao, tipo, data_transacao, descricao
      ) VALUES (
        NEW.user_id,
        v_cliente_id,
        v_session_text,
        v_valor_transacao,
        v_valor_liquido,
        v_taxa_gateway,
        v_taxa_antecipacao,
        'pagamento',
        COALESCE(NEW.data_pagamento::date, CURRENT_DATE),
        FORMAT('Pagamento %s - cobranca %s%s [auto-reconciled]',
          v_provedor_label,
          NEW.id,
          CASE WHEN NEW.descricao IS NOT NULL THEN ' - ' || NEW.descricao ELSE '' END
        )
      );
    ELSE
      UPDATE public.clientes_transacoes
      SET valor_liquido = v_valor_liquido,
          taxa_gateway = v_taxa_gateway,
          taxa_antecipacao = v_taxa_antecipacao
      WHERE id = v_existing_tx
        AND (valor_liquido IS NULL OR valor_liquido = 0);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;
