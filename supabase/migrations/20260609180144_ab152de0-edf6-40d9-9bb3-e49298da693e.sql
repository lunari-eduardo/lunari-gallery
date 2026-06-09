-- 1. Tabela de Auditoria Centralizada
CREATE TABLE IF NOT EXISTS public.system_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    correlation_id UUID NOT NULL,
    event_type TEXT NOT NULL,
    source TEXT NOT NULL, -- 'edge_function', 'trigger', 'rpc'
    source_name TEXT,     -- Nome da função ou trigger
    user_id UUID REFERENCES auth.users(id),
    gallery_id UUID REFERENCES public.galerias(id),
    session_id UUID REFERENCES public.clientes_sessoes(id),
    payload JSONB,
    status TEXT DEFAULT 'success',
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Tabela de Logs de Webhooks (Rastreabilidade de Pagamentos)
CREATE TABLE IF NOT EXISTS public.webhook_events_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    correlation_id UUID,
    provider TEXT NOT NULL, -- 'asaas', 'mercadopago', 'infinitepay'
    external_id TEXT,       -- ID no provedor
    event_name TEXT,
    payload JSONB,
    processed_status TEXT DEFAULT 'pending', -- 'pending', 'processed', 'error', 'ignored'
    error_log TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    processed_at TIMESTAMPTZ
);

-- 3. Índices para performance
CREATE INDEX IF NOT EXISTS idx_audit_correlation ON public.system_audit_logs(correlation_id);
CREATE INDEX IF NOT EXISTS idx_audit_gallery ON public.system_audit_logs(gallery_id);
CREATE INDEX IF NOT EXISTS idx_webhook_external ON public.webhook_events_audit(external_id);

-- 4. Permissões
GRANT SELECT, INSERT ON public.system_audit_logs TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.webhook_events_audit TO authenticated, service_role;

-- 5. Função para gerar/capturar Correlation ID
CREATE OR REPLACE FUNCTION public.get_current_correlation_id() 
RETURNS UUID AS $$
BEGIN
    -- Tenta pegar do settings da transação (definido pela Edge Function)
    -- Se não existir, gera um novo para esta transação SQL
    RETURN COALESCE(
        current_setting('app.correlation_id', true)::UUID,
        gen_random_uuid()
    );
EXCEPTION WHEN OTHERS THEN
    RETURN gen_random_uuid();
END;
$$ LANGUAGE plpgsql;

-- 6. Trigger Genérico de Auditoria de Mudança de Status
CREATE OR REPLACE FUNCTION public.audit_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.status IS DISTINCT FROM NEW.status) THEN
        INSERT INTO public.system_audit_logs (
            correlation_id,
            event_type,
            source,
            source_name,
            gallery_id,
            payload
        ) VALUES (
            public.get_current_correlation_id(),
            'STATUS_CHANGE',
            'trigger',
            TG_NAME,
            CASE WHEN TG_TABLE_NAME = 'galerias' THEN NEW.id ELSE NULL END,
            jsonb_build_object(
                'table', TG_TABLE_NAME,
                'id', NEW.id,
                'old_status', OLD.status,
                'new_status', NEW.status
            )
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar auditoria de status em tabelas críticas
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_audit_galerias_status') THEN
        CREATE TRIGGER trg_audit_galerias_status
        AFTER UPDATE ON public.galerias
        FOR EACH ROW EXECUTE FUNCTION public.audit_status_change();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_audit_cobrancas_status') THEN
        CREATE TRIGGER trg_audit_cobrancas_status
        AFTER UPDATE ON public.cobrancas
        FOR EACH ROW EXECUTE FUNCTION public.audit_status_change();
    END IF;
END $$;