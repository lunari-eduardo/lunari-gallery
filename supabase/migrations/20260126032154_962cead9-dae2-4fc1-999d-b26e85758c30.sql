-- Adicionar coluna is_default para permitir múltiplos métodos de pagamento configurados
ALTER TABLE usuarios_integracoes 
ADD COLUMN IF NOT EXISTS is_default boolean DEFAULT false;

-- Criar índice para consulta rápida do método padrão
CREATE INDEX IF NOT EXISTS idx_usuarios_integracoes_default 
ON usuarios_integracoes(user_id, is_default) 
WHERE is_default = true;

-- Atualizar registros existentes: o ativo atual vira padrão
UPDATE usuarios_integracoes 
SET is_default = true 
WHERE status = 'ativo' 
AND provedor IN ('pix_manual', 'infinitepay', 'mercadopago')
AND NOT EXISTS (
  SELECT 1 FROM usuarios_integracoes ui2 
  WHERE ui2.user_id = usuarios_integracoes.user_id 
  AND ui2.is_default = true 
  AND ui2.provedor IN ('pix_manual', 'infinitepay', 'mercadopago')
);