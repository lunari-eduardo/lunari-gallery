-- Corrigir transação existente com valores líquidos corretos
-- cobrança 22c7deca: valor=12, valor_liquido=11.24, taxa_gateway=0.76
UPDATE clientes_transacoes
SET valor_liquido = 11.24,
    taxa_gateway = 0.76,
    updated_at = now()
WHERE id = 'ab209502-da04-4eba-a47e-949a73b49097';