-- Fix Aurora - Newborn data
UPDATE galerias
SET total_fotos_extras_vendidas = 2,
    valor_total_vendido = 50
WHERE id = '1bca90ca-feb8-45f6-a1ad-3dbf6c7fdd1e';

-- Cancel orphaned pending cobranca (correct status value)
UPDATE cobrancas
SET status = 'cancelado', updated_at = now()
WHERE id = '079bc3d4-1594-49c3-8820-7b82a2c8589a'
  AND status = 'pendente';
