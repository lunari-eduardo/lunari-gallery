
-- 1. Nova coluna de sinalização
ALTER TABLE public.galerias
  ADD COLUMN IF NOT EXISTS payment_needs_regeneration BOOLEAN NOT NULL DEFAULT false;

-- 2. Trigger de preservação do lock
CREATE OR REPLACE FUNCTION public.tg_preserve_lock_on_charge_death()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gallery_id UUID;
  v_finalized_at TIMESTAMPTZ;
  v_has_alive BOOLEAN;
BEGIN
  -- Só reagimos a cobranças de fotos_extras
  IF TG_OP = 'DELETE' THEN
    v_gallery_id := OLD.galeria_id;
    IF OLD.finalidade IS DISTINCT FROM 'fotos_extras' OR v_gallery_id IS NULL THEN
      RETURN OLD;
    END IF;
  ELSE
    v_gallery_id := NEW.galeria_id;
    IF NEW.finalidade IS DISTINCT FROM 'fotos_extras' OR v_gallery_id IS NULL THEN
      RETURN NEW;
    END IF;
    -- Só nos importa se o novo status for "morte" da cobrança
    IF NEW.status NOT IN ('cancelada','expirada','estornada','falhou') THEN
      RETURN NEW;
    END IF;
  END IF;

  SELECT finalized_at INTO v_finalized_at
    FROM public.galerias WHERE id = v_gallery_id;

  IF v_finalized_at IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Verifica se ainda existe alguma cobrança viva (pendente/paga/aguardando)
  SELECT EXISTS(
    SELECT 1 FROM public.cobrancas
    WHERE galeria_id = v_gallery_id
      AND finalidade = 'fotos_extras'
      AND status IN ('pendente','aguardando_confirmacao','pago','pago_manual')
      AND id <> COALESCE(NEW.id, OLD.id)
  ) INTO v_has_alive;

  IF NOT v_has_alive THEN
    UPDATE public.galerias
       SET payment_needs_regeneration = true,
           updated_at = now()
     WHERE id = v_gallery_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS tg_preserve_lock_on_charge_death ON public.cobrancas;
CREATE TRIGGER tg_preserve_lock_on_charge_death
AFTER UPDATE OR DELETE ON public.cobrancas
FOR EACH ROW EXECUTE FUNCTION public.tg_preserve_lock_on_charge_death();

-- 3. RPC de reemissão (marca flag e devolve dados canônicos; a criação
--    real da cobrança é feita pela edge function chamadora, que possui
--    integração com o provedor).
CREATE OR REPLACE FUNCTION public.regenerate_pending_charge(p_gallery_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gallery public.galerias%ROWTYPE;
  v_calc JSONB;
  v_alive_id UUID;
BEGIN
  SELECT * INTO v_gallery FROM public.galerias WHERE id = p_gallery_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'GALLERY_NOT_FOUND';
  END IF;

  IF v_gallery.finalized_at IS NULL THEN
    RAISE EXCEPTION 'GALLERY_NOT_FINALIZED';
  END IF;

  -- Se já existe cobrança viva, retorna ela em vez de duplicar
  SELECT id INTO v_alive_id
    FROM public.cobrancas
   WHERE galeria_id = p_gallery_id
     AND finalidade = 'fotos_extras'
     AND status IN ('pendente','aguardando_confirmacao')
   ORDER BY created_at DESC
   LIMIT 1;

  IF v_alive_id IS NOT NULL THEN
    UPDATE public.galerias SET payment_needs_regeneration = false WHERE id = p_gallery_id;
    RETURN jsonb_build_object(
      'reused', true,
      'cobranca_id', v_alive_id,
      'provedor', v_gallery.venda_pagamento_provedor
    );
  END IF;

  -- Cálculo canônico (usa RPC existente)
  BEGIN
    v_calc := public.calculate_gallery_extra_payment(p_gallery_id);
  EXCEPTION WHEN OTHERS THEN
    v_calc := jsonb_build_object('valor_a_cobrar', 0, 'error', SQLERRM);
  END;

  RETURN jsonb_build_object(
    'reused', false,
    'gallery_id', p_gallery_id,
    'session_id', v_gallery.session_id,
    'user_id', v_gallery.user_id,
    'provedor', v_gallery.venda_pagamento_provedor,
    'calc', v_calc,
    'needs_edge_creation', true
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.regenerate_pending_charge(UUID) TO authenticated, anon, service_role;

-- 4. Backfill: normalizar galerias com finalized_at + status_selecao inconsistente
UPDATE public.galerias
   SET status_selecao = 'aguardando_pagamento',
       updated_at = now()
 WHERE finalized_at IS NOT NULL
   AND status_selecao NOT IN ('aguardando_pagamento','selecao_completa','processando_selecao');

-- 5. Backfill: marcar galerias finalizadas sem cobrança viva como precisa reemitir
UPDATE public.galerias g
   SET payment_needs_regeneration = true,
       updated_at = now()
 WHERE g.finalized_at IS NOT NULL
   AND g.status_selecao = 'aguardando_pagamento'
   AND NOT EXISTS (
     SELECT 1 FROM public.cobrancas c
      WHERE c.galeria_id = g.id
        AND c.finalidade = 'fotos_extras'
        AND c.status IN ('pendente','aguardando_confirmacao','pago','pago_manual')
   );
