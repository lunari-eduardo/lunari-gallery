UPDATE clientes_transacoes
SET taxa_gateway = 0,
    valor_liquido = 50
WHERE cobranca_id = 'bb08db9d-08fc-411b-a725-37dde55b50b4'
  AND taxa_gateway IS NOT NULL
  AND taxa_gateway > 0;