-- Corrigir restrição em system_audit_logs (atualmente bloqueia com NO ACTION)
ALTER TABLE public.system_audit_logs 
DROP CONSTRAINT IF EXISTS system_audit_logs_gallery_id_fkey,
ADD CONSTRAINT system_audit_logs_gallery_id_fkey 
FOREIGN KEY (gallery_id) REFERENCES public.galerias(id) ON DELETE CASCADE;

-- Corrigir audit_log (atualmente NO ACTION)
ALTER TABLE public.audit_log 
DROP CONSTRAINT IF EXISTS audit_log_gallery_id_fkey,
ADD CONSTRAINT audit_log_gallery_id_fkey 
FOREIGN KEY (gallery_id) REFERENCES public.galerias(id) ON DELETE CASCADE;

-- Corrigir email_delivery_logs (atualmente NO ACTION)
ALTER TABLE public.email_delivery_logs 
DROP CONSTRAINT IF EXISTS email_delivery_logs_gallery_id_fkey,
ADD CONSTRAINT email_delivery_logs_gallery_id_fkey 
FOREIGN KEY (gallery_id) REFERENCES public.galerias(id) ON DELETE CASCADE;

-- Corrigir credit_ledger (atualmente NO ACTION)
ALTER TABLE public.credit_ledger 
DROP CONSTRAINT IF EXISTS credit_ledger_gallery_id_fkey,
ADD CONSTRAINT credit_ledger_gallery_id_fkey 
FOREIGN KEY (gallery_id) REFERENCES public.galerias(id) ON DELETE CASCADE;

-- Grant permissions just in case (though they should exist)
GRANT ALL ON public.system_audit_logs TO service_role;
GRANT ALL ON public.audit_log TO service_role;
GRANT ALL ON public.email_delivery_logs TO service_role;
GRANT ALL ON public.credit_ledger TO service_role;
