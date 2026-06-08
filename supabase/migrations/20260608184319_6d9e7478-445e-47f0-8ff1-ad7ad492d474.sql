-- 1. MELHORIA DA RPC DE LOCK PARA PERMITIR RETENTATIVAS
CREATE OR REPLACE FUNCTION public.try_lock_gallery_selection(p_gallery_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_gallery RECORD;
  v_stale_lock BOOLEAN := FALSE;
  v_pending_cobranca RECORD;
BEGIN
  -- Lock preventivo
  PERFORM pg_advisory_xact_lock(hashtext('gallery_selection_' || p_gallery_id::text));

  SELECT * INTO v_gallery FROM public.galerias WHERE id = p_gallery_id FOR UPDATE;

  IF v_gallery IS NULL THEN
    RETURN jsonb_build_object('locked', false, 'reason', 'gallery_not_found');
  END IF;

  -- Se já está finalizada (entrega liberada), bloqueia
  IF v_gallery.finalized_at IS NOT NULL THEN
    RETURN jsonb_build_object('locked', false, 'reason', 'already_finalized');
  END IF;

  -- Se já está confirmada (fluxo completo), bloqueia
  IF v_gallery.status_selecao = 'selecao_completa' THEN
    RETURN jsonb_build_object('locked', false, 'reason', 'already_confirmed');
  END IF;

  -- TTL: Destrava se 'processando_selecao' estiver parado há mais de 5 min
  IF v_gallery.status_selecao = 'processando_selecao' THEN
    IF v_gallery.updated_at < now() - INTERVAL '5 minutes' THEN
      v_stale_lock := TRUE;
    ELSE
      RETURN jsonb_build_object('locked', false, 'reason', 'already_processing');
    END IF;
  END IF;

  -- LOGICA DE RETRY PARA AGUARDANDO PAGAMENTO (PULAR CHECKOUT)
  IF v_gallery.status_selecao = 'aguardando_pagamento' THEN
    -- Busca última cobrança pendente
    SELECT * INTO v_pending_cobranca 
    FROM public.cobrancas 
    WHERE galeria_id = p_gallery_id 
      AND status IN ('pendente', 'aguardando_confirmacao')
    ORDER BY created_at DESC LIMIT 1;

    -- Se existe uma cobrança pendente recente, decidimos o que fazer
    IF v_pending_cobranca.id IS NOT NULL THEN
       -- Se o valor/quantidade mudou (cliente voltou e alterou seleção), cancelamos a antiga para liberar nova
       -- Nota: No confirm-selection a gente compara se a seleção é igual.
       -- Aqui no lock a gente libera, e o confirm-selection decide se reaproveita ou cancela.
       -- Por segurança, permitimos o lock se não houver um processo ativo no momento.
       NULL;
    END IF;
  END IF;

  -- Adquire o lock transiente
  UPDATE public.galerias
  SET status_selecao = 'processando_selecao',
      updated_at = now()
  WHERE id = p_gallery_id;

  RETURN jsonb_build_object(
    'locked', true,
    'gallery', row_to_json(v_gallery)
  );
END;
$function$;

-- 2. TRIGGER PARA AUTO-FINALIZE (BLINDAGEM CONTRA WEBHOOKS INCOMPLETOS)
CREATE OR REPLACE FUNCTION public.trigger_finalize_payment_on_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Se mudou para pago ou pago_manual e ainda não foi contabilizado
  IF (NEW.status IN ('pago', 'pago_manual')) AND (OLD.status NOT IN ('pago', 'pago_manual')) THEN
    IF NEW.galeria_id IS NOT NULL AND (NEW.extras_contabilizados IS NOT TRUE) THEN
      -- Chama a RPC de finalização de forma segura
      BEGIN
        PERFORM public.finalize_gallery_payment(NEW.id, NEW.ip_receipt_url, NEW.data_pagamento, NEW.metodo_manual, NEW.observacoes);
      EXCEPTION WHEN OTHERS THEN
        -- Nunca falha o update original por erro no processamento secundário
        RAISE WARNING 'Erro ao finalizar pagamento via trigger para cobranca %: %', NEW.id, SQLERRM;
      END;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_cobrancas_auto_finalize ON public.cobrancas;
CREATE TRIGGER trg_cobrancas_auto_finalize
AFTER UPDATE OF status ON public.cobrancas
FOR EACH ROW
EXECUTE FUNCTION public.trigger_finalize_payment_on_status_change();

-- 3. AUTO-HEAL DAS GALERIAS PRESAS (THIAGO, ANDRESSA, TESTE)
-- Resolve cobranças que estão pagas mas não foram processadas
DO $$
DECLARE
  v_rec RECORD;
BEGIN
  FOR v_rec IN 
    SELECT id FROM public.cobrancas 
    WHERE status IN ('pago', 'pago_manual') 
      AND extras_contabilizados IS NOT TRUE
      AND galeria_id IS NOT NULL
  LOOP
    BEGIN
      PERFORM public.finalize_gallery_payment(v_rec.id);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Falha no heal da cobranca %: %', v_rec.id, SQLERRM;
    END;
  END LOOP;
END $$;

-- 4. BACKFILL DE GALERIA_ID PARA COBRANCAS ORFÃS (BASEADO EM SESSION_ID)
-- Só faz o vínculo se houver exatamente UMA galeria para aquela sessão (evita ambiguidade)
UPDATE public.cobrancas c
SET galeria_id = g.id
FROM public.galerias g
WHERE c.galeria_id IS NULL 
  AND c.session_id = g.session_id
  AND (
    SELECT count(*) FROM public.galerias g2 WHERE g2.session_id = c.session_id
  ) = 1;

-- 5. ÍNDICES PARA PERFORMANCE E ISOLAMENTO
CREATE INDEX IF NOT EXISTS idx_cobrancas_galeria_id_status ON public.cobrancas(galeria_id, status);
CREATE INDEX IF NOT EXISTS idx_cobrancas_session_id_status ON public.cobrancas(session_id, status);

GRANT ALL ON public.galeria_acoes TO authenticated, service_role;
GRANT ALL ON public.cobrancas TO authenticated, service_role;
GRANT ALL ON public.galerias TO authenticated, service_role;
