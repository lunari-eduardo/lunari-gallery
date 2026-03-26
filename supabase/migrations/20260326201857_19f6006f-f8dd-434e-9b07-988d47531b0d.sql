-- Backfill parcelas for 3 cobranças that failed upsert due to missing constraint

-- Cobrança 88730b83: valor=20, total_parcelas=3, payment=pay_7lzzby6fu3ntpe63, netValue=6.66, valor_bruto=6.99
INSERT INTO cobranca_parcelas (cobranca_id, numero_parcela, asaas_payment_id, valor_bruto, valor_liquido, taxa_gateway, status, billing_type, data_pagamento)
VALUES ('88730b83-135b-40b0-bceb-e29e4500fb8a', 1, 'pay_7lzzby6fu3ntpe63', 6.99, 6.66, 0.33, 'confirmado', 'card', '2026-03-26')
ON CONFLICT (cobranca_id, numero_parcela) DO NOTHING;

-- Cobrança 7f961770: valor=15, total_parcelas=2, payment=pay_af3eextw40nq42pf, netValue=7.08, valor_bruto=7.50
INSERT INTO cobranca_parcelas (cobranca_id, numero_parcela, asaas_payment_id, valor_bruto, valor_liquido, taxa_gateway, status, billing_type, data_pagamento)
VALUES ('7f961770-4d88-4c04-be14-e47391c5bc2c', 1, 'pay_af3eextw40nq42pf', 7.50, 7.08, 0.42, 'confirmado', 'card', '2026-03-26')
ON CONFLICT (cobranca_id, numero_parcela) DO NOTHING;

-- Cobrança 74fc31c1: valor=20, total_parcelas=2, payment=pay_iwnqycuo3ziw5h2v, netValue=9.52, valor_bruto=10.00
INSERT INTO cobranca_parcelas (cobranca_id, numero_parcela, asaas_payment_id, valor_bruto, valor_liquido, taxa_gateway, status, billing_type, data_pagamento)
VALUES ('74fc31c1-6b36-494f-8e5f-37cfe5df4ca1', 1, 'pay_iwnqycuo3ziw5h2v', 10.00, 9.52, 0.48, 'confirmado', 'card', '2026-03-26')
ON CONFLICT (cobranca_id, numero_parcela) DO NOTHING;

-- Update valor_liquido on cobrancas
UPDATE cobrancas SET valor_liquido = 6.66 WHERE id = '88730b83-135b-40b0-bceb-e29e4500fb8a';
UPDATE cobrancas SET valor_liquido = 7.08 WHERE id = '7f961770-4d88-4c04-be14-e47391c5bc2c';
UPDATE cobrancas SET valor_liquido = 9.52 WHERE id = '74fc31c1-6b36-494f-8e5f-37cfe5df4ca1';