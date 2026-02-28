
-- 1. Add credits_subscription column
ALTER TABLE photographer_accounts
ADD COLUMN IF NOT EXISTS credits_subscription INTEGER NOT NULL DEFAULT 0;

-- 2. Replace get_photo_credit_balance to return sum of both balances
CREATE OR REPLACE FUNCTION get_photo_credit_balance(_user_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(photo_credits, 0) + COALESCE(credits_subscription, 0)
  FROM photographer_accounts
  WHERE user_id = _user_id;
$$;

-- 3. Replace check_photo_credits to check combined balance
CREATE OR REPLACE FUNCTION check_photo_credits(_user_id UUID, _photo_count INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  total_balance INTEGER;
BEGIN
  SELECT COALESCE(photo_credits, 0) + COALESCE(credits_subscription, 0)
  INTO total_balance
  FROM photographer_accounts
  WHERE user_id = _user_id;

  IF total_balance IS NULL OR total_balance < _photo_count THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$;

-- 4. Replace consume_photo_credits: subscription first, then purchased
CREATE OR REPLACE FUNCTION consume_photo_credits(_user_id UUID, _gallery_id UUID, _photo_count INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  sub_balance INTEGER;
  purchased_balance INTEGER;
  remaining INTEGER;
  from_sub INTEGER;
  from_purchased INTEGER;
BEGIN
  -- Lock row
  SELECT COALESCE(credits_subscription, 0), COALESCE(photo_credits, 0)
  INTO sub_balance, purchased_balance
  FROM photographer_accounts
  WHERE user_id = _user_id
  FOR UPDATE;

  IF (sub_balance + purchased_balance) < _photo_count THEN
    RETURN FALSE;
  END IF;

  -- Consume from subscription first
  from_sub := LEAST(sub_balance, _photo_count);
  remaining := _photo_count - from_sub;
  from_purchased := remaining;

  UPDATE photographer_accounts
  SET
    credits_subscription = credits_subscription - from_sub,
    photo_credits = photo_credits - from_purchased,
    credits_consumed_total = COALESCE(credits_consumed_total, 0) + _photo_count,
    updated_at = NOW()
  WHERE user_id = _user_id;

  RETURN TRUE;
END;
$$;

-- 5. Create renew_subscription_credits: resets and sets new value
CREATE OR REPLACE FUNCTION renew_subscription_credits(_user_id UUID, _amount INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE photographer_accounts
  SET
    credits_subscription = _amount,
    updated_at = NOW()
  WHERE user_id = _user_id;

  -- Log in credit_ledger
  INSERT INTO credit_ledger (user_id, operation_type, amount, description, created_by)
  VALUES (_user_id, 'subscription_renewal', _amount, 'Créditos do plano renovados', _user_id);
END;
$$;

-- 6. Create expire_subscription_credits: zeroes subscription credits
CREATE OR REPLACE FUNCTION expire_subscription_credits(_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  expired_amount INTEGER;
BEGIN
  SELECT COALESCE(credits_subscription, 0) INTO expired_amount
  FROM photographer_accounts
  WHERE user_id = _user_id;

  IF expired_amount > 0 THEN
    UPDATE photographer_accounts
    SET credits_subscription = 0, updated_at = NOW()
    WHERE user_id = _user_id;

    INSERT INTO credit_ledger (user_id, operation_type, amount, description, created_by)
    VALUES (_user_id, 'subscription_expiry', -expired_amount, 'Créditos do plano expirados', _user_id);
  END IF;
END;
$$;
