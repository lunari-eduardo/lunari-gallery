-- Backfill: inserir parcelas para cobrança 22c7deca que não foram criadas pelo webhook antigo
-- Valores extraídos dos logs do webhook Asaas (netValue: 5.62, value: 6)

INSERT INTO cobranca_parcelas (cobranca_id, numero_parcela, asaas_payment_id, valor_bruto, valor_liquido, taxa_gateway, status, billing_type, data_pagamento)
VALUES 
  ('22c7deca-24c5-4a9c-a389-eb9dd67e20ca', 1, 'pay_zhgs2jm70oo0xcbm', 6, 5.62, 0.38, 'confirmado', 'card', '2026-03-26'),
  ('22c7deca-24c5-4a9c-a389-eb9dd67e20ca', 2, 'pay_be0jqy3rgxlsci37', 6, 5.62, 0.38, 'confirmado', 'card', '2026-03-26')
ON CONFLICT (asaas_payment_id) DO NOTHING;