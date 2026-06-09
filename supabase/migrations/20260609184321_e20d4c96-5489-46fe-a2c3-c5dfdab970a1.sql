-- 1. Adicionar restrição UNIQUE para evitar duplicidade de logs de eventos específicos
ALTER TABLE public.webhook_events_audit 
ADD CONSTRAINT webhook_events_audit_provider_external_id_event_name_key 
UNIQUE (provider, external_id, event_name);

-- 2. Função para adquirir advisory lock baseado em string (conveniente para Edge Functions)
CREATE OR REPLACE FUNCTION public.try_acquire_advisory_lock(lock_key text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_lock_acquired boolean;
BEGIN
    -- Usa hashtext para converter a string em um bigint para o pg_try_advisory_lock
    -- O lock é de sessão, então ele dura enquanto a conexão estiver aberta ou até ser liberado
    SELECT pg_try_advisory_lock(hashtext(lock_key)) INTO v_lock_acquired;
    RETURN v_lock_acquired;
END;
$$;

GRANT EXECUTE ON FUNCTION public.try_acquire_advisory_lock(text) TO authenticated, anon, service_role;

-- 3. Função para liberar o lock (útil no final da execução)
CREATE OR REPLACE FUNCTION public.release_advisory_lock(lock_key text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN pg_advisory_unlock(hashtext(lock_key));
END;
$$;

GRANT EXECUTE ON FUNCTION public.release_advisory_lock(text) TO authenticated, anon, service_role;
