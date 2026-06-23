
-- 1) Coluna finalidade
ALTER TABLE public.cobrancas ADD COLUMN IF NOT EXISTS finalidade text;

UPDATE public.cobrancas SET finalidade =
  CASE
    WHEN tipo_cobranca IN ('foto_extra','venda_galeria') THEN 'fotos_extras'
    WHEN qtd_fotos > 0 THEN 'fotos_extras'
    WHEN descricao ~* '\m\d+\s*foto' THEN 'fotos_extras'
    WHEN galeria_id IS NOT NULL AND tipo_cobranca = 'link' AND descricao !~* 'pagamento via' THEN 'fotos_extras'
    WHEN galeria_id IS NOT NULL AND tipo_cobranca = 'link' AND descricao ~* 'pagamento via' THEN 'sessao'
    ELSE 'sessao'
  END
WHERE finalidade IS NULL;

ALTER TABLE public.cobrancas
  ALTER COLUMN finalidade SET DEFAULT 'sessao',
  ALTER COLUMN finalidade SET NOT NULL;

ALTER TABLE public.cobrancas DROP CONSTRAINT IF EXISTS cobrancas_finalidade_chk;
ALTER TABLE public.cobrancas ADD CONSTRAINT cobrancas_finalidade_chk
  CHECK (finalidade IN ('fotos_extras','sessao','avulso'));

COMMENT ON COLUMN public.cobrancas.finalidade IS
  'Fonte única do escopo. fotos_extras=galeria, sessao=Studio (entrada/balanço), avulso=fora dos dois fluxos.';

-- 2) CURA
ALTER TABLE public.galerias DISABLE TRIGGER USER;

-- 2.a) Auditoria detach sessão
INSERT INTO public.audit_log (action, actor_type, resource_type, resource_id, gallery_id, metadata)
SELECT 'cleanup_studio_booking_detach','system','cobranca', c.id, c.galeria_id,
  jsonb_build_object('valor', c.valor, 'descricao', c.descricao, 'session_id', c.session_id,
    'qtd_fotos', c.qtd_fotos, 'tipo_cobranca', c.tipo_cobranca)
FROM public.cobrancas c WHERE c.finalidade = 'sessao' AND c.galeria_id IS NOT NULL;

-- 2.b) Detach galeria de cobranças de sessão
UPDATE public.cobrancas SET galeria_id = NULL, extras_contabilizados = false
 WHERE finalidade = 'sessao' AND galeria_id IS NOT NULL;

-- 2.c) Reanexa cobranças de fotos_extras órfãs via session_id (galeria ainda existe)
UPDATE public.cobrancas c
   SET galeria_id = g.id
  FROM public.galerias g
 WHERE c.finalidade = 'fotos_extras'
   AND c.galeria_id IS NULL
   AND c.session_id IS NOT NULL
   AND g.session_id = c.session_id;

-- 2.d) Restantes (galeria deletada / sem session) viram 'avulso' para respeitar a constraint
INSERT INTO public.audit_log (action, actor_type, resource_type, resource_id, metadata)
SELECT 'reclassify_orphan_extras_to_avulso','system','cobranca', c.id,
  jsonb_build_object('valor', c.valor, 'descricao', c.descricao, 'session_id', c.session_id,
    'qtd_fotos', c.qtd_fotos, 'tipo_cobranca', c.tipo_cobranca, 'status', c.status)
FROM public.cobrancas c
WHERE c.finalidade = 'fotos_extras' AND c.galeria_id IS NULL;

UPDATE public.cobrancas SET finalidade = 'avulso'
 WHERE finalidade = 'fotos_extras' AND galeria_id IS NULL;

-- 2.e) Recalcula totais das galerias
WITH recompute AS (
  SELECT galeria_id,
         COALESCE(SUM(valor), 0)     AS valor_extras,
         COALESCE(SUM(qtd_fotos), 0) AS qtd_extras
    FROM public.cobrancas
   WHERE finalidade = 'fotos_extras'
     AND status IN ('pago','pago_manual')
     AND galeria_id IS NOT NULL
   GROUP BY galeria_id
)
UPDATE public.galerias g
   SET valor_total_vendido = r.valor_extras,
       total_fotos_extras_vendidas = r.qtd_extras
  FROM recompute r
 WHERE g.id = r.galeria_id
   AND (g.valor_total_vendido IS DISTINCT FROM r.valor_extras
        OR g.total_fotos_extras_vendidas IS DISTINCT FROM r.qtd_extras);

UPDATE public.galerias g
   SET valor_total_vendido = 0, total_fotos_extras_vendidas = 0
 WHERE (COALESCE(g.valor_total_vendido, 0) <> 0 OR COALESCE(g.total_fotos_extras_vendidas, 0) <> 0)
   AND NOT EXISTS (
     SELECT 1 FROM public.cobrancas c
      WHERE c.galeria_id = g.id AND c.finalidade = 'fotos_extras'
        AND c.status IN ('pago','pago_manual')
   );

ALTER TABLE public.galerias ENABLE TRIGGER USER;

-- 3) Constraints relacionais
ALTER TABLE public.cobrancas DROP CONSTRAINT IF EXISTS cobrancas_finalidade_galeria_chk;
ALTER TABLE public.cobrancas ADD CONSTRAINT cobrancas_finalidade_galeria_chk
  CHECK (finalidade <> 'sessao' OR galeria_id IS NULL);

ALTER TABLE public.cobrancas DROP CONSTRAINT IF EXISTS cobrancas_extras_requires_galeria_chk;
ALTER TABLE public.cobrancas ADD CONSTRAINT cobrancas_extras_requires_galeria_chk
  CHECK (finalidade <> 'fotos_extras' OR galeria_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_cobrancas_galeria_finalidade
  ON public.cobrancas (galeria_id, finalidade, status);

-- 4) Triggers blindados
CREATE OR REPLACE FUNCTION public.sync_gallery_on_cobranca_paid()
RETURNS trigger LANGUAGE plpgsql AS $function$
DECLARE v_galeria_id uuid;
BEGIN
  IF NEW.status NOT IN ('pago','pago_manual') THEN RETURN NEW; END IF;
  IF OLD.status IN ('pago','pago_manual') THEN RETURN NEW; END IF;
  IF NEW.finalidade IS DISTINCT FROM 'fotos_extras' THEN RETURN NEW; END IF;
  IF NEW.galeria_id IS NULL AND NEW.session_id IS NOT NULL THEN
    SELECT id INTO v_galeria_id FROM public.galerias WHERE session_id = NEW.session_id LIMIT 1;
    IF v_galeria_id IS NOT NULL THEN NEW.galeria_id := v_galeria_id; END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_finalize_payment_on_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF NEW.status IN ('pago','pago_manual')
     AND (OLD.status IS NULL OR OLD.status NOT IN ('pago','pago_manual'))
     AND NEW.galeria_id IS NOT NULL
     AND NEW.finalidade = 'fotos_extras'
     AND NEW.extras_contabilizados IS NOT TRUE
  THEN
    BEGIN
      PERFORM public.finalize_gallery_payment(NEW.id, NEW.ip_receipt_url, NEW.data_pagamento, NEW.metodo_manual, NEW.obs_manual);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'auto-finalize falhou para cobranca %: %', NEW.id, SQLERRM;
      BEGIN
        INSERT INTO public.audit_log(action, resource_type, resource_id, gallery_id, metadata)
        VALUES ('auto_finalize_failed','cobranca', NEW.id, NEW.galeria_id,
          jsonb_build_object('error',SQLERRM,'sqlstate',SQLSTATE,'finalidade',NEW.finalidade));
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.tg_protect_no_overcharge()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_g RECORD; v_pago numeric; v_max numeric; v_extras_necess int;
BEGIN
  IF NEW.galeria_id IS NULL OR COALESCE(NEW.valor, 0) <= 0 THEN RETURN NEW; END IF;
  IF NEW.finalidade IS DISTINCT FROM 'fotos_extras' THEN RETURN NEW; END IF;
  SELECT fotos_selecionadas, fotos_incluidas, valor_foto_extra INTO v_g FROM galerias WHERE id = NEW.galeria_id;
  IF v_g IS NULL THEN RETURN NEW; END IF;
  v_extras_necess := GREATEST(0, COALESCE(v_g.fotos_selecionadas, 0) - COALESCE(v_g.fotos_incluidas, 0));
  v_max := v_extras_necess * COALESCE(v_g.valor_foto_extra, 0);
  SELECT COALESCE(SUM(valor), 0) INTO v_pago FROM cobrancas
   WHERE galeria_id = NEW.galeria_id AND finalidade = 'fotos_extras'
     AND status IN ('pago','pago_manual')
     AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
  IF v_max > 0 AND (v_pago + NEW.valor) > v_max + 0.01 THEN
    RAISE EXCEPTION 'Cobrança excederia o saldo devido. Pago=R$% + Nova=R$% > Máx=R$%', v_pago, NEW.valor, v_max;
  END IF;
  RETURN NEW;
END;
$function$;
