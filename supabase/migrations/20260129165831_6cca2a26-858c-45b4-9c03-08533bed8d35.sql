-- =====================================================
-- Simplificação do Sistema de Créditos
-- Remove log por foto, adiciona contadores agregados
-- =====================================================

-- 1. Adicionar colunas agregadas em photographer_accounts
ALTER TABLE photographer_accounts
ADD COLUMN IF NOT EXISTS credits_purchased_total INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS credits_consumed_total INTEGER DEFAULT 0;

-- 2. Inicializar valores baseados no histórico existente (se houver)
UPDATE photographer_accounts pa
SET 
  credits_purchased_total = COALESCE((
    SELECT SUM(amount) FROM credit_ledger cl 
    WHERE cl.user_id = pa.user_id AND cl.operation_type IN ('purchase', 'bonus')
  ), 0),
  credits_consumed_total = COALESCE((
    SELECT ABS(SUM(amount)) FROM credit_ledger cl 
    WHERE cl.user_id = pa.user_id AND cl.operation_type = 'upload'
  ), 0);

-- 3. Drop existing function first, then recreate
DROP FUNCTION IF EXISTS consume_photo_credits(UUID, UUID, INTEGER);

CREATE FUNCTION consume_photo_credits(
  _user_id UUID,
  _gallery_id UUID,
  _photo_count INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_balance INTEGER;
BEGIN
  -- Get current balance with lock
  SELECT photo_credits INTO current_balance
  FROM photographer_accounts
  WHERE user_id = _user_id
  FOR UPDATE;
  
  -- Check if enough credits
  IF current_balance IS NULL OR current_balance < _photo_count THEN
    RETURN FALSE;
  END IF;
  
  -- Deduct credits and increment consumed counter
  UPDATE photographer_accounts
  SET 
    photo_credits = photo_credits - _photo_count,
    credits_consumed_total = COALESCE(credits_consumed_total, 0) + _photo_count,
    updated_at = NOW()
  WHERE user_id = _user_id;
  
  -- NO ledger entry for uploads - just aggregate counter
  
  RETURN TRUE;
END;
$$;

-- 4. Remover a função record_photo_credit_usage que não é mais necessária
DROP FUNCTION IF EXISTS record_photo_credit_usage(UUID, UUID, UUID, TEXT);

-- 5. Limpar entradas de upload antigas do ledger (libera espaço)
DELETE FROM credit_ledger WHERE operation_type = 'upload';