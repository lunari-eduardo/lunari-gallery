-- Fix existing Deliver galleries: set finalized_at and allowDownload
-- so downloads work with the current Worker without redeployment
UPDATE galerias
SET finalized_at = enviado_em,
    configuracoes = COALESCE(configuracoes, '{}'::jsonb) || '{"allowDownload": true}'::jsonb
WHERE tipo = 'entrega'
  AND finalized_at IS NULL
  AND status = 'enviado';