-- Expandir CHECK constraints da tabela cobrancas para aceitar pago_manual e foto_extra

-- 1. Expandir status para incluir pago_manual
ALTER TABLE cobrancas DROP CONSTRAINT IF EXISTS cobrancas_status_check;
ALTER TABLE cobrancas ADD CONSTRAINT cobrancas_status_check
  CHECK (status = ANY(ARRAY[
    'pendente','parcialmente_pago','pago','pago_manual','cancelado','expirado'
  ]));

-- 2. Expandir tipo_cobranca para incluir foto_extra
ALTER TABLE cobrancas DROP CONSTRAINT IF EXISTS cobrancas_tipo_cobranca_check;
ALTER TABLE cobrancas ADD CONSTRAINT cobrancas_tipo_cobranca_check
  CHECK (tipo_cobranca = ANY(ARRAY[
    'pix','link','card','presencial','foto_extra'
  ]));