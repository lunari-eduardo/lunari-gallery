
-- Atualiza reopen_gallery_selection para fazer auto-heal de cobranças
-- pagas órfãs ANTES de zerar valor_extras, garantindo que o crédito
-- (total_fotos_extras_vendidas / valor_total_vendido) seja preservado.

CREATE OR REPLACE FUNCTION public.reopen_gallery_selection(
  p_gallery_id uuid,
  p_days int
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_g RECORD;
  v_prazo timestamptz;
  v_c RECORD;
  v_healed int := 0;
BEGIN
  SELECT * INTO v_g FROM galerias WHERE id = p_gallery_id FOR UPDATE;
  IF v_g IS NULL THEN
    RAISE EXCEPTION 'Galeria não encontrada';
  END IF;
  IF v_g.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  -- 🛡️ AUTO-HEAL: cobranças pagas não contabilizadas (provedor-agnóstico)
  -- antes de zerar valor_extras. finalize_gallery_payment é idempotente
  -- (usa advisory lock + extras_contabilizados).
  FOR v_c IN
    SELECT id FROM cobrancas
     WHERE galeria_id = p_gallery_id
       AND status IN ('pago','pago_manual')
       AND extras_contabilizados IS NOT TRUE
  LOOP
    BEGIN
      PERFORM public.finalize_gallery_payment(v_c.id, NULL, NULL, NULL, NULL);
      v_healed := v_healed + 1;
    EXCEPTION WHEN OTHERS THEN
      -- não bloqueia reabertura por falha de heal individual
      NULL;
    END;
  END LOOP;

  -- Reler galeria após heal para capturar contadores reais
  SELECT * INTO v_g FROM galerias WHERE id = p_gallery_id FOR UPDATE;

  v_prazo := now() + (p_days || ' days')::interval;

  UPDATE galerias SET
    status = 'selecao_iniciada',
    status_selecao = 'em_andamento',
    status_pagamento = 'sem_vendas',
    prazo_selecao = v_prazo,
    prazo_selecao_dias = p_days,
    finalized_at = NULL,
    valor_extras = 0,           -- zera saldo do ciclo; histórico fica em valor_total_vendido
    updated_at = now()
  WHERE id = p_gallery_id;

  -- Cancela cobranças pendentes do ciclo anterior
  UPDATE cobrancas
     SET status = 'cancelado', updated_at = now()
   WHERE galeria_id = p_gallery_id
     AND status IN ('pendente', 'aguardando_confirmacao');

  -- Sincroniza sessão (Gestão)
  IF v_g.session_id IS NOT NULL THEN
    UPDATE clientes_sessoes
       SET status_galeria = 'em_selecao',
           status_pagamento_fotos_extra = 'sem_vendas',
           updated_at = now()
     WHERE session_id = v_g.session_id;
  END IF;

  -- Audit
  INSERT INTO galeria_acoes(galeria_id, user_id, tipo, descricao)
  VALUES (
    p_gallery_id, auth.uid(), 'selecao_reaberta',
    FORMAT(
      'Seleção reaberta (%s dias). Crédito preservado: %s extras / R$ %s. Heals=%s',
      p_days,
      COALESCE(v_g.total_fotos_extras_vendidas, 0),
      COALESCE(v_g.valor_total_vendido, 0),
      v_healed
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'creditos_extras', COALESCE(v_g.total_fotos_extras_vendidas, 0),
    'creditos_valor', COALESCE(v_g.valor_total_vendido, 0),
    'healed', v_healed
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reopen_gallery_selection(uuid, int) TO authenticated;

-- 🩹 Backfill global: heal de TODAS as cobranças pagas órfãs já existentes
-- (corrige a galeria do teste e quaisquer outras na mesma situação).
DO $$
DECLARE
  v_id uuid;
BEGIN
  FOR v_id IN
    SELECT c.id FROM cobrancas c
    WHERE c.status IN ('pago','pago_manual')
      AND c.extras_contabilizados IS NOT TRUE
      AND c.galeria_id IS NOT NULL
  LOOP
    BEGIN
      PERFORM public.finalize_gallery_payment(v_id, NULL, NULL, NULL, NULL);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;
END $$;
