-- Fix check constraint to include subscription_renewal and subscription_expiry
ALTER TABLE credit_ledger DROP CONSTRAINT credit_ledger_operation_type_check;
ALTER TABLE credit_ledger ADD CONSTRAINT credit_ledger_operation_type_check 
  CHECK (operation_type = ANY (ARRAY['purchase', 'bonus', 'upload', 'refund', 'adjustment', 'subscription_renewal', 'subscription_expiry']));

-- Grant 2000 subscription credits to existing combo subscribers who have 0
UPDATE photographer_accounts pa
SET credits_subscription = 2000, updated_at = now()
WHERE credits_subscription = 0
  AND EXISTS (
    SELECT 1 FROM subscriptions_asaas sa
    WHERE sa.user_id = pa.user_id
      AND sa.plan_type IN ('combo_pro_select2k', 'combo_completo')
      AND sa.status IN ('ACTIVE', 'PENDING', 'OVERDUE')
  );

-- Insert audit records in credit_ledger
INSERT INTO credit_ledger (user_id, operation_type, amount, description, created_by)
SELECT pa.user_id, 'subscription_renewal', 2000, 'Créditos de assinatura combo concedidos retroativamente (fix)', pa.user_id
FROM photographer_accounts pa
JOIN subscriptions_asaas sa ON sa.user_id = pa.user_id
WHERE sa.plan_type IN ('combo_pro_select2k', 'combo_completo')
AND sa.status IN ('ACTIVE', 'PENDING', 'OVERDUE');