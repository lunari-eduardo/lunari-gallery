-- R11: Audit/histórico nunca depende da existência física da galeria.
-- Durante DELETE físico de galerias, qualquer INSERT em audit_log deve
-- usar gallery_id=NULL e preservar o UUID original em metadata.gallery_id_original.
-- Isso resolve definitivamente o erro:
--   "insert or update on table audit_log violates foreign key constraint
--    audit_log_gallery_id_fkey"
-- que ocorria porque triggers AFTER DELETE em galerias tentavam inserir
-- gallery_id apontando para uma linha que estava sendo removida na mesma transação.

CREATE OR REPLACE FUNCTION public.on_galeria_deleted_reset_session()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_qtd_final INT;
  v_unit NUMERIC;
  v_paid_qtd INT := 0;
  v_paid_sum NUMERIC := 0;
BEGIN
  IF OLD.session_id IS NULL THEN
    RETURN OLD;
  END IF;

  -- Base: quantidade já vendida (preserva integridade financeira)
  v_qtd_final := COALESCE(OLD.total_fotos_extras_vendidas, 0);

  -- Fallback: contar por cobranças pagas históricas (fotos_extras + componente combinado)
  SELECT COALESCE(SUM(qtd_fotos), 0)::int,
         COALESCE(SUM(COALESCE(valor_extras_componente, valor)), 0)
    INTO v_paid_qtd, v_paid_sum
  FROM public.cobrancas
  WHERE session_id = OLD.session_id
    AND status IN ('pago','pago_manual')
    AND COALESCE(finalidade,'') IN ('fotos_extras','sessao_e_extras');

  IF v_paid_qtd > v_qtd_final THEN
    v_qtd_final := v_paid_qtd;
  END IF;

  v_unit := CASE
    WHEN v_qtd_final > 0 AND v_paid_sum > 0
    THEN ROUND((v_paid_sum / GREATEST(v_paid_qtd, v_qtd_final))::numeric, 2)
    ELSE COALESCE(OLD.valor_foto_extra, 0)
  END;

  UPDATE public.clientes_sessoes s
  SET qtd_fotos_extra = v_qtd_final,
      valor_foto_extra = CASE WHEN v_qtd_final > 0 THEN v_unit ELSE 0 END,
      valor_total_foto_extra = ROUND((v_qtd_final * CASE WHEN v_qtd_final > 0 THEN v_unit ELSE 0 END)::numeric, 2),
      updated_at = now()
  WHERE s.user_id = OLD.user_id
    AND s.session_id = OLD.session_id
    AND COALESCE(s.extras_overridden, false) = false;

  -- R11: gallery_id=NULL durante delete físico; UUID vai para metadata.
  -- resource_id continua = OLD.id para permitir consulta por resource_id.
  INSERT INTO public.audit_log(action, resource_type, resource_id, gallery_id, user_id, metadata)
  VALUES(
    'on_galeria_deleted_reset',
    'galeria',
    OLD.id,
    NULL,
    OLD.user_id,
    jsonb_build_object(
      'gallery_id_original', OLD.id,
      'session_slug', OLD.session_id,
      'qtd_final', v_qtd_final,
      'unit', v_unit,
      'old_vendidas', OLD.total_fotos_extras_vendidas,
      'paid_qtd', v_paid_qtd
    )
  );

  RETURN OLD;
END;
$function$;

-- Varredura defensiva: cobranca_infer_qtd_fotos também insere audit_log com
-- gallery_id. Só roda em UPDATE de cobrancas (não DELETE), mas se por qualquer
-- motivo rodar durante uma sequência transacional que envolva delete físico da
-- galeria (ex.: cancelar cobrança pendente antes de deletar), pode gerar o
-- mesmo erro. Aplicamos o mesmo padrão preventivamente.

CREATE OR REPLACE FUNCTION public.cobranca_infer_qtd_fotos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_match TEXT[];
  v_unit NUMERIC;
  v_inferred INT;
  v_gallery_exists BOOLEAN;
BEGIN
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
    -- R11: só grava gallery_id quando a galeria ainda existe.
    -- Se não existir (delete físico em andamento), preserva o UUID no metadata.
    SELECT EXISTS(SELECT 1 FROM public.galerias WHERE id = NEW.galeria_id) INTO v_gallery_exists;
    BEGIN
      INSERT INTO public.audit_log (action, actor_type, resource_type, resource_id, gallery_id, metadata)
      VALUES (
        'cobranca_qtd_fotos_zero',
        'system',
        'cobranca',
        NEW.id,
        CASE WHEN v_gallery_exists THEN NEW.galeria_id ELSE NULL END,
        jsonb_build_object(
          'gallery_id_original', NEW.galeria_id,
          'valor', NEW.valor,
          'descricao', NEW.descricao,
          'provedor', NEW.provedor
        )
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'audit_log insert falhou (ignorado): %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$function$;

-- Backfill: normaliza registros históricos órfãos que ainda tenham gallery_id
-- apontando para galerias que não existem mais (defensivo — a FK atual já é
-- ON DELETE SET NULL, mas rodar isso garante estado consistente).
UPDATE public.audit_log a
SET
  gallery_id = NULL,
  metadata = COALESCE(a.metadata, '{}'::jsonb)
             || jsonb_build_object('gallery_id_original', a.gallery_id)
WHERE a.gallery_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.galerias g WHERE g.id = a.gallery_id);