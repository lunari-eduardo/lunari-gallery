-- Remove duplicatas existentes mantendo o registro mais antigo
DELETE FROM galeria_acoes a
USING galeria_acoes b
WHERE a.tipo = 'enviada'
  AND b.tipo = 'enviada'
  AND a.galeria_id = b.galeria_id
  AND a.created_at > b.created_at;

-- Índice único parcial para evitar duplicatas futuras
CREATE UNIQUE INDEX IF NOT EXISTS idx_galeria_acoes_enviada_unique
ON galeria_acoes (galeria_id, tipo)
WHERE tipo = 'enviada';