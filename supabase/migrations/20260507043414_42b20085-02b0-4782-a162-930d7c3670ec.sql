-- 1) RPC atômica de reabertura de seleção (preserva crédito, zera valor_extras)
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
BEGIN
  SELECT * INTO v_g FROM galerias WHERE id = p_gallery_id FOR UPDATE;
  IF v_g IS NULL THEN
    RAISE EXCEPTION 'Galeria não encontrada';
  END IF;
  IF v_g.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  v_prazo := now() + (p_days || ' days')::interval;

  UPDATE galerias SET
    status = 'selecao_iniciada',
    status_selecao = 'em_andamento',
    status_pagamento = 'sem_vendas',
    prazo_selecao = v_prazo,
    prazo_selecao_dias = p_days,
    finalized_at = NULL,
    valor_extras = 0,           -- zera fallback contaminado; histórico fica em valor_total_vendido
    updated_at = now()
  WHERE id = p_gallery_id;

  -- Cancela cobranças do ciclo anterior que não foram pagas
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
      'Seleção reaberta (%s dias). Crédito preservado: %s extras / R$ %s',
      p_days,
      COALESCE(v_g.total_fotos_extras_vendidas, 0),
      COALESCE(v_g.valor_total_vendido, 0)
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'creditos_extras', COALESCE(v_g.total_fotos_extras_vendidas, 0),
    'creditos_valor', COALESCE(v_g.valor_total_vendido, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reopen_gallery_selection(uuid, int) TO authenticated;

-- 2) Trigger anti-overcharge: bloqueia INSERT de cobrança que exceda o saldo devido
CREATE OR REPLACE FUNCTION public.tg_protect_no_overcharge()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_g RECORD;
  v_pago numeric;
  v_max numeric;
  v_extras_necess int;
BEGIN
  -- Só valida cobranças de fotos extras com valor > 0
  IF NEW.galeria_id IS NULL OR COALESCE(NEW.valor, 0) <= 0 THEN
    RETURN NEW;
  END IF;
  IF NEW.tipo_cobranca IS DISTINCT FROM 'foto_extra' THEN
    RETURN NEW;
  END IF;

  SELECT fotos_selecionadas, fotos_incluidas, valor_foto_extra
    INTO v_g
    FROM galerias
   WHERE id = NEW.galeria_id;

  IF v_g IS NULL THEN
    RETURN NEW;
  END IF;

  v_extras_necess := GREATEST(
    0,
    COALESCE(v_g.fotos_selecionadas, 0) - COALESCE(v_g.fotos_incluidas, 0)
  );
  v_max := v_extras_necess * COALESCE(v_g.valor_foto_extra, 0);

  SELECT COALESCE(SUM(valor), 0) INTO v_pago
    FROM cobrancas
   WHERE galeria_id = NEW.galeria_id
     AND status IN ('pago', 'pago_manual')
     AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  IF v_max > 0 AND (v_pago + NEW.valor) > v_max + 0.01 THEN
    RAISE EXCEPTION
      'Cobrança excederia o saldo devido. Pago=R$% + Nova=R$% > Máx=R$%',
      v_pago, NEW.valor, v_max;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_no_overcharge ON cobrancas;
CREATE TRIGGER trg_protect_no_overcharge
BEFORE INSERT ON cobrancas
FOR EACH ROW
EXECUTE FUNCTION public.tg_protect_no_overcharge();