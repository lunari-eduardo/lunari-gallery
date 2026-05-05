-- Trigger defensivo: impede alteração do campo `valor` em cobranças quitadas/canceladas.
-- Permite alterar status, recibo, observação, etc., mas trava o valor monetário.

CREATE OR REPLACE FUNCTION public.tg_block_value_change_on_settled_cobranca()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Apenas se status anterior já era finalizado E valor mudou
  IF OLD.status IN ('pago', 'pago_manual', 'cancelado')
     AND COALESCE(NEW.valor, 0) <> COALESCE(OLD.valor, 0) THEN
    RAISE EXCEPTION 'Não é permitido alterar o valor de uma cobrança com status %', OLD.status
      USING ERRCODE = 'check_violation',
            HINT = 'Crie uma nova cobrança para registrar valores adicionais.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_value_change_on_settled_cobranca ON public.cobrancas;

CREATE TRIGGER trg_block_value_change_on_settled_cobranca
BEFORE UPDATE ON public.cobrancas
FOR EACH ROW
EXECUTE FUNCTION public.tg_block_value_change_on_settled_cobranca();

COMMENT ON FUNCTION public.tg_block_value_change_on_settled_cobranca() IS
'Defesa em profundidade: impede sobrescrever cobrancas.valor após status final (pago/pago_manual/cancelado). Bug histórico em galerias reativadas tentava sobrescrever valor de cobrança paga anterior, corrompendo histórico e contadores.';