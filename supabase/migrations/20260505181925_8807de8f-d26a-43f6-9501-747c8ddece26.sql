
-- ============================================================
-- 1. CURA RETROATIVA: inferir qtd_fotos para cobranças InfinitePay pagas com 0
-- ============================================================
DO $heal$
DECLARE
  v_row RECORD;
  v_inferred INT;
  v_match TEXT[];
  v_unit NUMERIC;
  v_count_curadas INT := 0;
  v_count_skipped INT := 0;
BEGIN
  FOR v_row IN
    SELECT c.id, c.descricao, c.valor, c.galeria_id, g.valor_foto_extra
    FROM public.cobrancas c
    LEFT JOIN public.galerias g ON g.id = c.galeria_id
    WHERE c.provedor IN ('infinitepay','manual','asaas','mercadopago')
      AND c.status IN ('pago','pago_manual')
      AND c.tipo_cobranca IN ('foto_extra','link','venda_galeria')
      AND COALESCE(c.qtd_fotos, 0) = 0
      AND c.galeria_id IS NOT NULL
      AND c.valor > 0
  LOOP
    v_inferred := NULL;

    -- Tentativa 1: regex na descricao
    IF v_row.descricao IS NOT NULL THEN
      v_match := regexp_match(v_row.descricao, '(\d+)\s*foto', 'i');
      IF v_match IS NOT NULL THEN
        v_inferred := (v_match[1])::INT;
      END IF;
    END IF;

    -- Tentativa 2: divisao valor / valor_foto_extra (somente se inteiro razoavel)
    IF (v_inferred IS NULL OR v_inferred = 0) AND v_row.valor_foto_extra IS NOT NULL AND v_row.valor_foto_extra > 0 THEN
      v_unit := v_row.valor_foto_extra;
      -- verifica se divisao da inteiro com tolerancia de 1 centavo
      IF ABS(v_row.valor - ROUND(v_row.valor / v_unit) * v_unit) < 0.02 THEN
        v_inferred := ROUND(v_row.valor / v_unit)::INT;
      END IF;
    END IF;

    IF v_inferred IS NOT NULL AND v_inferred > 0 AND v_inferred <= 999 THEN
      UPDATE public.cobrancas
      SET qtd_fotos = v_inferred, updated_at = now()
      WHERE id = v_row.id;
      v_count_curadas := v_count_curadas + 1;
      RAISE NOTICE 'CURADA cobranca % -> qtd_fotos=% (galeria=%)', v_row.id, v_inferred, v_row.galeria_id;
    ELSE
      v_count_skipped := v_count_skipped + 1;
      RAISE NOTICE 'SKIP cobranca % (galeria=%, valor=%, descricao=%): inferencia inconclusiva',
        v_row.id, v_row.galeria_id, v_row.valor, v_row.descricao;
    END IF;
  END LOOP;

  RAISE NOTICE 'HEAL CONCLUIDO: % curadas, % puladas', v_count_curadas, v_count_skipped;
END;
$heal$;

-- ============================================================
-- 2. RECOMPUTE: galerias e clientes_sessoes a partir de SUM(cobrancas)
-- ============================================================
WITH agg AS (
  SELECT galeria_id,
         COALESCE(SUM(qtd_fotos),0)::int AS sum_qtd,
         COALESCE(SUM(valor),0)::numeric AS sum_val,
         MAX(status) FILTER (WHERE status = 'pago_manual') AS has_manual,
         MAX(data_pagamento) AS max_paid_at
  FROM public.cobrancas
  WHERE galeria_id IS NOT NULL
    AND status IN ('pago','pago_manual')
    AND tipo_cobranca IN ('foto_extra','link','venda_galeria')
  GROUP BY galeria_id
)
UPDATE public.galerias g
SET total_fotos_extras_vendidas = a.sum_qtd,
    valor_total_vendido = a.sum_val,
    status_pagamento = CASE WHEN a.has_manual IS NOT NULL THEN 'pago_manual' ELSE 'pago' END,
    status_selecao = CASE WHEN a.sum_qtd > 0 OR a.sum_val > 0 THEN 'selecao_completa' ELSE g.status_selecao END,
    finalized_at = COALESCE(g.finalized_at, a.max_paid_at, now()),
    updated_at = now()
FROM agg a
WHERE g.id = a.galeria_id
  AND (
    COALESCE(g.total_fotos_extras_vendidas, 0) <> a.sum_qtd
    OR COALESCE(g.valor_total_vendido, 0) <> a.sum_val
  );

-- Propaga para clientes_sessoes
UPDATE public.clientes_sessoes s
SET qtd_fotos_extra = g.total_fotos_extras_vendidas,
    valor_total_foto_extra = g.valor_total_vendido,
    status_galeria = CASE WHEN g.total_fotos_extras_vendidas > 0 OR g.valor_total_vendido > 0
                          THEN 'selecao_completa' ELSE s.status_galeria END,
    status_pagamento_fotos_extra = g.status_pagamento,
    updated_at = now()
FROM public.galerias g
WHERE g.session_id = s.session_id
  AND g.session_id IS NOT NULL
  AND (
    COALESCE(s.qtd_fotos_extra, 0) <> COALESCE(g.total_fotos_extras_vendidas, 0)
    OR COALESCE(s.valor_total_foto_extra, 0) <> COALESCE(g.valor_total_vendido, 0)
  );

-- ============================================================
-- 3. TRIGGER de defesa em profundidade: infere qtd_fotos antes de gravar pago
-- ============================================================
CREATE OR REPLACE FUNCTION public.cobranca_infer_qtd_fotos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match TEXT[];
  v_unit NUMERIC;
  v_inferred INT;
BEGIN
  -- Atua apenas quando entra em estado pago e cobranca afeta extras
  IF NEW.status NOT IN ('pago','pago_manual') THEN
    RETURN NEW;
  END IF;
  IF COALESCE(NEW.tipo_cobranca,'') NOT IN ('foto_extra','link','venda_galeria') THEN
    RETURN NEW;
  END IF;
  IF NEW.galeria_id IS NULL OR COALESCE(NEW.valor,0) <= 0 THEN
    RETURN NEW;
  END IF;
  IF COALESCE(NEW.qtd_fotos, 0) > 0 THEN
    RETURN NEW;
  END IF;

  v_inferred := NULL;
  IF NEW.descricao IS NOT NULL THEN
    v_match := regexp_match(NEW.descricao, '(\d+)\s*foto', 'i');
    IF v_match IS NOT NULL THEN
      v_inferred := (v_match[1])::INT;
    END IF;
  END IF;

  IF v_inferred IS NULL OR v_inferred = 0 THEN
    SELECT NULLIF(valor_foto_extra, 0) INTO v_unit FROM public.galerias WHERE id = NEW.galeria_id;
    IF v_unit IS NOT NULL AND v_unit > 0 AND ABS(NEW.valor - ROUND(NEW.valor / v_unit) * v_unit) < 0.02 THEN
      v_inferred := ROUND(NEW.valor / v_unit)::INT;
    END IF;
  END IF;

  IF v_inferred IS NOT NULL AND v_inferred > 0 AND v_inferred <= 999 THEN
    NEW.qtd_fotos := v_inferred;
    RAISE NOTICE 'cobranca_infer_qtd_fotos: inferiu qtd_fotos=% para cobranca %', v_inferred, NEW.id;
  ELSE
    -- nao bloqueia o pagamento; apenas audita
    BEGIN
      INSERT INTO public.audit_log (action, actor_type, resource_type, resource_id, gallery_id, metadata)
      VALUES ('cobranca_qtd_fotos_zero', 'system', 'cobranca', NEW.id, NEW.galeria_id,
              jsonb_build_object('valor', NEW.valor, 'descricao', NEW.descricao, 'provedor', NEW.provedor));
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'audit_log insert falhou (ignorado): %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cobranca_infer_qtd_fotos ON public.cobrancas;
CREATE TRIGGER trg_cobranca_infer_qtd_fotos
BEFORE INSERT OR UPDATE OF status, valor, qtd_fotos, descricao
ON public.cobrancas
FOR EACH ROW
EXECUTE FUNCTION public.cobranca_infer_qtd_fotos();

-- ============================================================
-- 4. RPC de reconciliacao on-demand
-- ============================================================
CREATE OR REPLACE FUNCTION public.reconcile_gallery_extras_counters()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_galerias_corrigidas INT := 0;
  v_sessoes_corrigidas INT := 0;
BEGIN
  WITH agg AS (
    SELECT galeria_id,
           COALESCE(SUM(qtd_fotos),0)::int AS sum_qtd,
           COALESCE(SUM(valor),0)::numeric AS sum_val
    FROM public.cobrancas
    WHERE galeria_id IS NOT NULL
      AND status IN ('pago','pago_manual')
      AND tipo_cobranca IN ('foto_extra','link','venda_galeria')
    GROUP BY galeria_id
  ),
  upd AS (
    UPDATE public.galerias g
    SET total_fotos_extras_vendidas = a.sum_qtd,
        valor_total_vendido = a.sum_val,
        updated_at = now()
    FROM agg a
    WHERE g.id = a.galeria_id
      AND (
        COALESCE(g.total_fotos_extras_vendidas,0) <> a.sum_qtd
        OR COALESCE(g.valor_total_vendido,0) <> a.sum_val
      )
    RETURNING g.id
  )
  SELECT count(*) INTO v_galerias_corrigidas FROM upd;

  WITH upd AS (
    UPDATE public.clientes_sessoes s
    SET qtd_fotos_extra = g.total_fotos_extras_vendidas,
        valor_total_foto_extra = g.valor_total_vendido,
        updated_at = now()
    FROM public.galerias g
    WHERE g.session_id = s.session_id
      AND g.session_id IS NOT NULL
      AND (
        COALESCE(s.qtd_fotos_extra,0) <> COALESCE(g.total_fotos_extras_vendidas,0)
        OR COALESCE(s.valor_total_foto_extra,0) <> COALESCE(g.valor_total_vendido,0)
      )
    RETURNING s.id
  )
  SELECT count(*) INTO v_sessoes_corrigidas FROM upd;

  RETURN jsonb_build_object(
    'success', true,
    'galerias_corrigidas', v_galerias_corrigidas,
    'sessoes_corrigidas', v_sessoes_corrigidas
  );
END;
$$;
