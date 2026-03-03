CREATE OR REPLACE FUNCTION refund_photo_credit(_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sub_balance INTEGER;
  sub_cap INTEGER;
BEGIN
  SELECT COALESCE(credits_subscription, 0)
  INTO sub_balance
  FROM photographer_accounts
  WHERE user_id = _user_id FOR UPDATE;

  SELECT CASE sa.plan_type
    WHEN 'combo_pro_select2k' THEN 2000
    WHEN 'combo_completo' THEN 2000
    ELSE 0
  END INTO sub_cap
  FROM subscriptions_asaas sa
  WHERE sa.user_id = _user_id
    AND sa.status IN ('ACTIVE','PENDING','OVERDUE')
    AND sa.plan_type IN ('combo_pro_select2k','combo_completo')
  LIMIT 1;

  sub_cap := COALESCE(sub_cap, 0);

  IF sub_balance < sub_cap THEN
    UPDATE photographer_accounts
    SET credits_subscription = credits_subscription + 1,
        credits_consumed_total = GREATEST(0, COALESCE(credits_consumed_total,0) - 1),
        updated_at = NOW()
    WHERE user_id = _user_id;
  ELSE
    UPDATE photographer_accounts
    SET photo_credits = photo_credits + 1,
        credits_consumed_total = GREATEST(0, COALESCE(credits_consumed_total,0) - 1),
        updated_at = NOW()
    WHERE user_id = _user_id;
  END IF;
END;
$$;