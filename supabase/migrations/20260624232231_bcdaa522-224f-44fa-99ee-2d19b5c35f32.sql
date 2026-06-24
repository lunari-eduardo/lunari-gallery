
-- ============================================================
-- A.1 — Trigger de classificação determinística
-- Regra única: se cobrança tem galeria_id, é 'fotos_extras'.
-- Não usa heurísticas frágeis (descrição, palavras-chave).
-- ============================================================
CREATE OR REPLACE FUNCTION public.tg_classify_cobranca_finalidade()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se galeria_id está presente, é sempre fotos_extras (independente do default DB)
  IF NEW.galeria_id IS NOT NULL THEN
    NEW.finalidade := 'fotos_extras';
  ELSIF NEW.finalidade IS NULL THEN
    -- Explicita default para emissores que não passam o campo
    NEW.finalidade := 'sessao';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_classify_cobranca_finalidade ON public.cobrancas;
CREATE TRIGGER trg_classify_cobranca_finalidade
  BEFORE INSERT ON public.cobrancas
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_classify_cobranca_finalidade();

-- ============================================================
-- A.2 — RPC de reconciliação manual de cobrança órfã
-- Vincula uma cobrança paga, sem galeria_id, a uma galeria
-- cuja session_id bate. Exige ato explícito (chamada da UI).
-- ============================================================
CREATE OR REPLACE FUNCTION public.claim_orphan_payment_for_gallery(
  p_cobranca_id uuid,
  p_galeria_id  uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cobranca  cobrancas%ROWTYPE;
  v_galeria   galerias%ROWTYPE;
  v_caller    uuid := auth.uid();
  v_qtd       integer;
  v_unit      numeric;
  v_rpc_res   jsonb;
BEGIN
  -- 1. Carrega registros
  SELECT * INTO v_cobranca FROM cobrancas WHERE id = p_cobranca_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'COBRANCA_NOT_FOUND');
  END IF;

  SELECT * INTO v_galeria FROM galerias WHERE id = p_galeria_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'GALERIA_NOT_FOUND');
  END IF;

  -- 2. Autorização: caller precisa ser dono da galeria
  IF v_caller IS NULL OR v_caller <> v_galeria.user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED');
  END IF;

  -- 3. Pré-condições
  IF v_cobranca.status NOT IN ('pago', 'pago_manual') THEN
    RETURN jsonb_build_object('success', false, 'error', 'COBRANCA_NAO_PAGA',
                              'status', v_cobranca.status);
  END IF;

  IF v_cobranca.galeria_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'COBRANCA_JA_VINCULADA',
                              'galeria_id', v_cobranca.galeria_id);
  END IF;

  -- Sessão da cobrança precisa bater com sessão da galeria
  IF v_cobranca.session_id IS NULL
     OR v_galeria.session_id IS NULL
     OR v_cobranca.session_id <> v_galeria.session_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'SESSION_MISMATCH',
                              'cobranca_session', v_cobranca.session_id,
                              'galeria_session',  v_galeria.session_id);
  END IF;

  -- 4. Calcula qtd_fotos se faltando
  v_qtd  := COALESCE(NULLIF(v_cobranca.qtd_fotos, 0), 0);
  v_unit := COALESCE(NULLIF(v_galeria.valor_foto_extra, 0), 0);

  IF v_qtd = 0 THEN
    IF v_unit > 0 THEN
      v_qtd := GREATEST(1, ROUND(v_cobranca.valor / v_unit)::int);
    ELSE
      v_qtd := 1; -- fallback mínimo
    END IF;
  END IF;

  -- 5. UPDATE atômico (passa pelas check constraints existentes)
  UPDATE cobrancas
     SET galeria_id = p_galeria_id,
         finalidade = 'fotos_extras',
         qtd_fotos  = v_qtd
   WHERE id = p_cobranca_id;

  -- 6. Finalize gallery payment (idempotente via extras_contabilizados)
  SELECT public.finalize_gallery_payment(
    p_cobranca_id => p_cobranca_id,
    p_receipt_url => COALESCE(v_cobranca.ip_receipt_url, NULL),
    p_paid_at     => COALESCE(v_cobranca.data_pagamento, now()),
    p_manual_method => NULL,
    p_manual_obs    => NULL
  ) INTO v_rpc_res;

  -- 7. Audit log
  INSERT INTO audit_log (user_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_caller,
    'claim_orphan_payment',
    'cobranca',
    p_cobranca_id,
    jsonb_build_object(
      'galeria_id', p_galeria_id,
      'valor', v_cobranca.valor,
      'qtd_fotos_atribuido', v_qtd,
      'session_id', v_cobranca.session_id,
      'finalize_result', v_rpc_res
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'cobranca_id', p_cobranca_id,
    'galeria_id', p_galeria_id,
    'qtd_fotos', v_qtd,
    'finalize_result', v_rpc_res
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_orphan_payment_for_gallery(uuid, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_orphan_payment_for_gallery(uuid, uuid) FROM anon;

-- ============================================================
-- A.5 — View de auditoria: cobranças pagas órfãs que casam
-- com session_id de alguma galeria
-- ============================================================
CREATE OR REPLACE VIEW public.vw_cobrancas_suspeitas AS
SELECT
  c.id                AS cobranca_id,
  c.user_id,
  c.created_at,
  c.valor,
  c.descricao,
  c.provedor,
  c.status,
  c.finalidade,
  c.session_id,
  g.id                AS galeria_id_candidata,
  g.nome_sessao,
  g.cliente_nome,
  g.status_selecao,
  g.valor_foto_extra
FROM cobrancas c
JOIN galerias  g
  ON g.session_id = c.session_id
 AND g.user_id   = c.user_id
WHERE c.status IN ('pago', 'pago_manual')
  AND c.galeria_id IS NULL
  AND c.finalidade <> 'fotos_extras';

GRANT SELECT ON public.vw_cobrancas_suspeitas TO authenticated;

-- ============================================================
-- A.4 — Cura imediata da cobrança travada (Joãozinho)
-- Roda via RPC para passar pelo mesmo fluxo da UI
-- ============================================================
DO $$
DECLARE
  v_result jsonb;
BEGIN
  -- UPDATE direto (não temos auth.uid() em migration, então não usa a RPC)
  UPDATE cobrancas
     SET galeria_id = '7148ed92-82e1-40ba-a3f1-7b83d413cf65',
         finalidade = 'fotos_extras',
         qtd_fotos  = 1
   WHERE id = '343b65f5-b1b3-43b7-88a5-029d84bc9b04'
     AND galeria_id IS NULL;

  IF FOUND THEN
    SELECT public.finalize_gallery_payment(
      p_cobranca_id => '343b65f5-b1b3-43b7-88a5-029d84bc9b04',
      p_receipt_url => 'https://recibo.infinitepay.io/4f235dd7-0804-4a59-a884-01a98d283d65',
      p_paid_at     => '2026-06-24 19:07:54.831+00'::timestamptz,
      p_manual_method => NULL,
      p_manual_obs    => NULL
    ) INTO v_result;

    RAISE NOTICE 'Healing Joãozinho result: %', v_result;
  ELSE
    RAISE NOTICE 'Cobrança 343b65f5 já estava vinculada — skip';
  END IF;
END $$;
