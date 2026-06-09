ALTER TABLE public.cobrancas 
ADD COLUMN IF NOT EXISTS snapshot_fotos_incluidas INTEGER,
ADD COLUMN IF NOT EXISTS snapshot_regras_congeladas JSONB,
ADD COLUMN IF NOT EXISTS correlation_id UUID;

COMMENT ON COLUMN public.cobrancas.snapshot_fotos_incluidas IS 'Quantidade de fotos incluídas no pacote no momento em que a cobrança foi gerada.';
COMMENT ON COLUMN public.cobrancas.snapshot_regras_congeladas IS 'Snapshot das regras de precificação (pacote, extras, faixas) no momento da cobrança.';
