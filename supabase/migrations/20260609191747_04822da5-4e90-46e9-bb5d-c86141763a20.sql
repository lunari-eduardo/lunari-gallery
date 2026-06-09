ALTER TABLE public.cobranca_parcelas ADD COLUMN IF NOT EXISTS mp_payment_id TEXT;
CREATE INDEX IF NOT EXISTS idx_cobranca_parcelas_mp_payment_id ON public.cobranca_parcelas(mp_payment_id);
-- Permitir que a mesma parcela seja identificada por qualquer um dos IDs
ALTER TABLE public.cobranca_parcelas DROP CONSTRAINT IF EXISTS cobranca_parcelas_asaas_payment_id_key;
-- Note: we don't necessarily want a unique constraint on mp_payment_id yet because MP might group them differently,
-- but for single payments it helps. We'll rely on (cobranca_id, numero_parcela) as the logical primary key for logic.
