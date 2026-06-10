-- Ajuste para system_audit_logs
ALTER TABLE public.system_audit_logs 
DROP CONSTRAINT IF EXISTS system_audit_logs_gallery_id_fkey,
ADD CONSTRAINT system_audit_logs_gallery_id_fkey 
  FOREIGN KEY (gallery_id) REFERENCES public.galerias(id) ON DELETE CASCADE;

-- Ajuste para audit_log
ALTER TABLE public.audit_log 
DROP CONSTRAINT IF EXISTS audit_log_gallery_id_fkey,
ADD CONSTRAINT audit_log_gallery_id_fkey 
  FOREIGN KEY (gallery_id) REFERENCES public.galerias(id) ON DELETE CASCADE;

-- Ajuste para email_delivery_logs
ALTER TABLE public.email_delivery_logs 
DROP CONSTRAINT IF EXISTS email_delivery_logs_gallery_id_fkey,
ADD CONSTRAINT email_delivery_logs_gallery_id_fkey 
  FOREIGN KEY (gallery_id) REFERENCES public.galerias(id) ON DELETE CASCADE;

-- Ajuste para credit_ledger
ALTER TABLE public.credit_ledger 
DROP CONSTRAINT IF EXISTS credit_ledger_gallery_id_fkey,
ADD CONSTRAINT credit_ledger_gallery_id_fkey 
  FOREIGN KEY (gallery_id) REFERENCES public.galerias(id) ON DELETE CASCADE;

-- Ajuste para cobrancas (settando NULL para não perder histórico financeiro mas permitir exclusão da galeria)
ALTER TABLE public.cobrancas 
DROP CONSTRAINT IF EXISTS cobrancas_galeria_id_fkey,
ADD CONSTRAINT cobrancas_galeria_id_fkey 
  FOREIGN KEY (galeria_id) REFERENCES public.galerias(id) ON DELETE SET NULL;
