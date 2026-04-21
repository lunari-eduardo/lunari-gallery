-- Parte 1: adicionar coluna idempotente em cobrancas
ALTER TABLE public.cobrancas
  ADD COLUMN IF NOT EXISTS extras_contabilizados boolean NOT NULL DEFAULT false;

-- Parte 2a: recompor galerias afetadas (recalcular contadores a partir das cobranças pagas)
WITH agregado AS (
  SELECT galeria_id,
         SUM(qtd_fotos) AS qtd,
         SUM(valor)     AS val
  FROM public.cobrancas
  WHERE status IN ('pago','pago_manual')
    AND galeria_id IS NOT NULL
    AND COALESCE(qtd_fotos,0) > 0
  GROUP BY galeria_id
)
UPDATE public.galerias g
   SET total_fotos_extras_vendidas = a.qtd,
       valor_total_vendido         = a.val
  FROM agregado a
 WHERE g.id = a.galeria_id;

-- Parte 2b: marcar cobranças já pagas como contabilizadas (todas, mesmo as sem qtd_fotos)
UPDATE public.cobrancas
   SET extras_contabilizados = true
 WHERE status IN ('pago','pago_manual');

-- Parte 3: deletar versão antiga de 1 argumento (não usada por nenhuma edge function)
DROP FUNCTION IF EXISTS public.finalize_gallery_payment(uuid);

-- Parte 4: redefinir a RPC de 5 argumentos com guard idempotente por cobrança
CREATE OR REPLACE FUNCTION public.finalize_gallery_payment(
  p_cobranca_id uuid,
  p_receipt_url text DEFAULT NULL::text,
  p_paid_at timestamp with time zone DEFAULT now(),
  p_manual_method text DEFAULT NULL::text,
  p_manual_obs text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cobranca RECORD;
  v_galeria_id UUID;
  v_gallery_synced BOOLEAN := false;
  v_final_status TEXT;
  v_has_parcelas BOOLEAN;
  v_current_status TEXT;
  v_should_count BOOLEAN;
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

  -- Helper: deveriamos contabilizar extras desta cobrança?
  v_should_count := (
    v_cobranca.extras_contabilizados IS NOT TRUE
    AND COALESCE(v_cobranca.qtd_fotos, 0) > 0
    AND v_galeria_id IS NOT NULL
  );

  -- BRANCH 1: Already paid - sync gallery if needed (idempotente por cobrança)
  IF v_cobranca.status IN ('pago', 'pago_manual') THEN
    IF v_should_count THEN
      UPDATE public.galerias
      SET total_fotos_extras_vendidas = COALESCE(total_fotos_extras_vendidas, 0) + v_cobranca.qtd_fotos,
          valor_total_vendido = COALESCE(valor_total_vendido, 0) + v_cobranca.valor,
          status_pagamento = v_cobranca.status,
          status_selecao = 'selecao_completa',
          finalized_at = COALESCE(finalized_at, v_cobranca.data_pagamento, now()),
          updated_at = now()
      WHERE id = v_galeria_id;

      UPDATE public.cobrancas SET extras_contabilizados = true WHERE id = p_cobranca_id;

      IF v_cobranca.session_id IS NOT NULL THEN
        UPDATE public.clientes_sessoes
        SET qtd_fotos_extra = COALESCE(
              (SELECT total_fotos_extras_vendidas FROM public.galerias WHERE id = v_galeria_id), 0),
            valor_total_foto_extra = COALESCE(
              (SELECT valor_total_vendido FROM public.galerias WHERE id = v_galeria_id), 0),
            status_galeria = 'selecao_completa',
            status_pagamento_fotos_extra = v_cobranca.status,
            updated_at = now()
        WHERE session_id = v_cobranca.session_id;
      END IF;
      v_gallery_synced := true;
    END IF;

    -- VISITOR FINALIZATION (already paid path)
    IF v_cobranca.visitor_id IS NOT NULL THEN
      UPDATE public.galeria_visitantes
      SET status = 'finalizado',
          status_selecao = 'selecao_completa',
          finalized_at = COALESCE(v_cobranca.data_pagamento, now()),
          updated_at = now()
      WHERE id = v_cobranca.visitor_id
        AND status != 'finalizado';
    END IF;

    RETURN jsonb_build_object('success', true, 'already_paid', true,
      'gallery_synced', v_gallery_synced, 'galeria_id', v_galeria_id);
  END IF;

  -- BRANCH 2: Asaas com parcelas - delegar / contabilizar idempotente
  IF v_cobranca.provedor = 'asaas' AND v_cobranca.mp_payment_id IS NOT NULL AND p_manual_method IS NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM public.cobranca_parcelas WHERE cobranca_id = p_cobranca_id
    ) INTO v_has_parcelas;

    IF v_has_parcelas THEN
      SELECT status INTO v_current_status FROM public.cobrancas WHERE id = p_cobranca_id;

      IF v_current_status IN ('pago', 'pago_manual') THEN
        -- Recalcular guard com status atualizado pelo trigger
        v_should_count := (
          (SELECT extras_contabilizados FROM public.cobrancas WHERE id = p_cobranca_id) IS NOT TRUE
          AND COALESCE(v_cobranca.qtd_fotos, 0) > 0
          AND v_galeria_id IS NOT NULL
        );

        IF v_should_count THEN
          UPDATE public.galerias
          SET total_fotos_extras_vendidas = COALESCE(total_fotos_extras_vendidas, 0) + v_cobranca.qtd_fotos,
              valor_total_vendido = COALESCE(valor_total_vendido, 0) + v_cobranca.valor,
              status_pagamento = v_current_status,
              status_selecao = 'selecao_completa',
              finalized_at = COALESCE(finalized_at, now()),
              updated_at = now()
          WHERE id = v_galeria_id;

          UPDATE public.cobrancas SET extras_contabilizados = true WHERE id = p_cobranca_id;

          IF v_cobranca.session_id IS NOT NULL THEN
            UPDATE public.clientes_sessoes
            SET qtd_fotos_extra = COALESCE(
                  (SELECT total_fotos_extras_vendidas FROM public.galerias WHERE id = v_galeria_id), 0),
                valor_total_foto_extra = COALESCE(
                  (SELECT valor_total_vendido FROM public.galerias WHERE id = v_galeria_id), 0),
                status_galeria = 'selecao_completa',
                status_pagamento_fotos_extra = v_current_status,
                updated_at = now()
            WHERE session_id = v_cobranca.session_id;
          END IF;
        END IF;

        IF v_cobranca.visitor_id IS NOT NULL THEN
          UPDATE public.galeria_visitantes
          SET status = 'finalizado',
              status_selecao = 'selecao_completa',
              finalized_at = COALESCE(p_paid_at, now()),
              updated_at = now()
          WHERE id = v_cobranca.visitor_id
            AND status != 'finalizado';
        END IF;

        RETURN jsonb_build_object('success', true, 'already_paid', false,
          'delegated_to_parcelas', true, 'parcelas_resolved', true,
          'cobranca_id', p_cobranca_id, 'galeria_id', v_galeria_id);
      END IF;

      RETURN jsonb_build_object('success', true, 'already_paid', false,
        'delegated_to_parcelas', true, 'parcelas_resolved', false,
        'cobranca_id', p_cobranca_id, 'galeria_id', v_galeria_id);
    END IF;
  END IF;

  -- BRANCH 3: Mark as paid (novo pagamento)
  UPDATE public.cobrancas
  SET status = v_final_status, data_pagamento = p_paid_at,
      ip_receipt_url = COALESCE(p_receipt_url, ip_receipt_url),
      metodo_manual = COALESCE(p_manual_method, metodo_manual),
      obs_manual = COALESCE(p_manual_obs, obs_manual),
      updated_at = now()
  WHERE id = p_cobranca_id AND status NOT IN ('pago', 'pago_manual');

  IF v_should_count THEN
    UPDATE public.galerias
    SET total_fotos_extras_vendidas = COALESCE(total_fotos_extras_vendidas, 0) + v_cobranca.qtd_fotos,
        valor_total_vendido = COALESCE(valor_total_vendido, 0) + v_cobranca.valor,
        status_pagamento = v_final_status,
        status_selecao = 'selecao_completa',
        finalized_at = p_paid_at,
        updated_at = now()
    WHERE id = v_galeria_id;

    UPDATE public.cobrancas SET extras_contabilizados = true WHERE id = p_cobranca_id;
  ELSIF v_galeria_id IS NOT NULL THEN
    -- Cobrança sem qtd_fotos ou já contabilizada: ainda assim sincronizar status
    UPDATE public.galerias
    SET status_pagamento = v_final_status,
        status_selecao = 'selecao_completa',
        finalized_at = COALESCE(finalized_at, p_paid_at),
        updated_at = now()
    WHERE id = v_galeria_id;
  END IF;

  IF v_cobranca.session_id IS NOT NULL THEN
    UPDATE public.clientes_sessoes
    SET qtd_fotos_extra = COALESCE(
          (SELECT total_fotos_extras_vendidas FROM public.galerias WHERE id = v_galeria_id), 0),
        valor_total_foto_extra = COALESCE(
          (SELECT valor_total_vendido FROM public.galerias WHERE id = v_galeria_id), 0),
        status_galeria = 'selecao_completa',
        status_pagamento_fotos_extra = v_final_status,
        updated_at = now()
    WHERE session_id = v_cobranca.session_id;
  END IF;

  IF v_cobranca.visitor_id IS NOT NULL THEN
    UPDATE public.galeria_visitantes
    SET status = 'finalizado',
        status_selecao = 'selecao_completa',
        finalized_at = p_paid_at,
        updated_at = now()
    WHERE id = v_cobranca.visitor_id
      AND status != 'finalizado';
  END IF;

  RETURN jsonb_build_object('success', true, 'already_paid', false,
    'cobranca_id', p_cobranca_id, 'galeria_id', v_galeria_id,
    'session_id', v_cobranca.session_id, 'valor', v_cobranca.valor, 'qtd_fotos', v_cobranca.qtd_fotos,
    'needs_fee_reconciliation', (v_cobranca.provedor = 'asaas' AND v_cobranca.mp_payment_id IS NOT NULL AND p_manual_method IS NULL));
END;
$function$;