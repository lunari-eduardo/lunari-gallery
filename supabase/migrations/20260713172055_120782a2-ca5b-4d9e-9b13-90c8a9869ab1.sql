-- 1. Relaxa validate_combined_charge_breakdown para permitir desanexação (FK ON DELETE SET NULL)
CREATE OR REPLACE FUNCTION public.validate_combined_charge_breakdown()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_soma numeric;
BEGIN
  IF NEW.finalidade IS DISTINCT FROM 'sessao_e_extras' THEN
    RETURN NEW;
  END IF;

  -- Exceção: UPDATE originado pela FK ON DELETE SET NULL da galeria.
  -- Cobrança vira órfã legítima; histórico financeiro é preservado
  -- (mesmo padrão adotado em audit_log R11).
  IF TG_OP = 'UPDATE'
     AND OLD.galeria_id IS NOT NULL
     AND NEW.galeria_id IS NULL
     AND OLD.finalidade IS NOT DISTINCT FROM NEW.finalidade
     AND OLD.valor IS NOT DISTINCT FROM NEW.valor
     AND OLD.valor_sessao_componente IS NOT DISTINCT FROM NEW.valor_sessao_componente
     AND OLD.valor_extras_componente IS NOT DISTINCT FROM NEW.valor_extras_componente
     AND OLD.qtd_fotos IS NOT DISTINCT FROM NEW.qtd_fotos THEN
    RETURN NEW;
  END IF;

  IF NEW.session_id IS NULL THEN
    RAISE EXCEPTION 'Cobrança combinada exige session_id.' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.galeria_id IS NULL THEN
    RAISE EXCEPTION 'Cobrança combinada exige galeria_id.' USING ERRCODE = 'check_violation';
  END IF;
  IF COALESCE(NEW.qtd_fotos, 0) <= 0 THEN
    RAISE EXCEPTION 'Cobrança combinada exige qtd_fotos > 0.' USING ERRCODE = 'check_violation';
  END IF;
  IF COALESCE(NEW.valor, 0) <= 0 THEN
    RAISE EXCEPTION 'Cobrança combinada exige valor > 0.' USING ERRCODE = 'check_violation';
  END IF;
  IF COALESCE(NEW.valor_sessao_componente, 0) <= 0 THEN
    RAISE EXCEPTION 'Cobrança combinada exige valor_sessao_componente > 0.' USING ERRCODE = 'check_violation';
  END IF;
  IF COALESCE(NEW.valor_extras_componente, 0) <= 0 THEN
    RAISE EXCEPTION 'Cobrança combinada exige valor_extras_componente > 0.' USING ERRCODE = 'check_violation';
  END IF;

  v_soma := ROUND((COALESCE(NEW.valor_sessao_componente,0) + COALESCE(NEW.valor_extras_componente,0))::numeric, 2);
  IF ABS(v_soma - ROUND(NEW.valor::numeric, 2)) > 0.01 THEN
    RAISE EXCEPTION 'Soma dos componentes (R$%) não bate com valor total (R$%).', v_soma, NEW.valor
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

-- 2. Trigger que preserva gallery_id_original em dados_extras ao desanexar
CREATE OR REPLACE FUNCTION public.cobranca_preserve_gallery_ref()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.galeria_id IS NOT NULL
     AND NEW.galeria_id IS NULL THEN
    NEW.dados_extras := COALESCE(NEW.dados_extras, '{}'::jsonb)
      || jsonb_build_object(
        'gallery_id_original', OLD.galeria_id,
        'detached_at', to_jsonb(now()),
        'detached_reason', 'gallery_deleted'
      );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cobranca_preserve_gallery_ref ON public.cobrancas;
-- Executa depois do validate (nomes ordenam alfabeticamente: preserve > validate? não).
-- Como o validate agora libera cedo no caso de desanexação, a ordem não importa.
CREATE TRIGGER trg_cobranca_preserve_gallery_ref
BEFORE UPDATE ON public.cobrancas
FOR EACH ROW
EXECUTE FUNCTION public.cobranca_preserve_gallery_ref();

-- 3. Backfill defensivo: cobranças que já apontam para galerias inexistentes
UPDATE public.cobrancas c
SET dados_extras = COALESCE(c.dados_extras, '{}'::jsonb)
                 || jsonb_build_object(
                      'gallery_id_original', c.galeria_id,
                      'detached_reason', 'backfill_orphan'
                    ),
    galeria_id = NULL
WHERE c.galeria_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.galerias g WHERE g.id = c.galeria_id);