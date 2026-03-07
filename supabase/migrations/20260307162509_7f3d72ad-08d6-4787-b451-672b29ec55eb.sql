
CREATE OR REPLACE FUNCTION public.ensure_transaction_on_cobranca_paid()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_session_text TEXT;
  v_cliente_id UUID;
  v_existing_tx UUID;
BEGIN
  -- Only act when status changes to 'pago'
  IF NEW.status = 'pago' AND (OLD.status IS NULL OR OLD.status != 'pago') THEN
    
    -- Need session_id and cliente_id
    IF NEW.session_id IS NULL THEN
      RETURN NEW;
    END IF;
    
    -- Resolve session_id text
    SELECT session_id, cliente_id INTO v_session_text, v_cliente_id
    FROM public.clientes_sessoes
    WHERE session_id = NEW.session_id OR id::text = NEW.session_id
    LIMIT 1;
    
    IF v_session_text IS NULL THEN
      -- Fallback: use cobranca's own session_id and cliente_id
      v_session_text := NEW.session_id;
      v_cliente_id := NEW.cliente_id;
    END IF;
    
    IF v_cliente_id IS NULL THEN
      v_cliente_id := NEW.cliente_id;
    END IF;
    
    -- Check if transaction already exists for this cobranca
    -- Match by session_id + valor + approximate timing
    SELECT id INTO v_existing_tx
    FROM public.clientes_transacoes
    WHERE session_id = v_session_text
      AND tipo = 'pagamento'
      AND valor = NEW.valor
      AND created_at >= NEW.created_at - INTERVAL '1 hour'
    LIMIT 1;
    
    IF v_existing_tx IS NULL THEN
      -- Create the missing transaction
      -- FIX: data_transacao is type DATE, so cast properly without ::text
      INSERT INTO public.clientes_transacoes (
        user_id, cliente_id, session_id, valor, tipo, data_transacao, descricao
      ) VALUES (
        NEW.user_id,
        v_cliente_id,
        v_session_text,
        NEW.valor,
        'pagamento',
        COALESCE(NEW.data_pagamento::date, CURRENT_DATE),
        FORMAT('Pagamento %s - cobranca %s%s [auto-reconciled]',
          CASE WHEN NEW.provedor = 'infinitepay' THEN 'InfinitePay' 
               WHEN NEW.provedor = 'mercadopago' THEN 'Mercado Pago'
               ELSE COALESCE(NEW.provedor, 'manual') END,
          NEW.id,
          CASE WHEN NEW.descricao IS NOT NULL THEN ' - ' || NEW.descricao ELSE '' END
        )
      );
      
      RAISE NOTICE 'Auto-created transaction for cobranca % (session: %, valor: %)', NEW.id, v_session_text, NEW.valor;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;
