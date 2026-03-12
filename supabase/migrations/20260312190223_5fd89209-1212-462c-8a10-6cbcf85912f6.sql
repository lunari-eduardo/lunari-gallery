
-- Grant +1000 credits to referrer (eduardo)
UPDATE photographer_accounts SET photo_credits = photo_credits + 1000, updated_at = now() WHERE user_id = '6471b07e-3103-4839-9ee9-836335d6374a';
INSERT INTO credit_ledger (user_id, operation_type, amount, description) VALUES ('6471b07e-3103-4839-9ee9-836335d6374a', 'referral_bonus', 1000, 'Bônus de indicação: emailtesterefe@gmail.com comprou créditos (retroativo)');

-- Grant +1000 credits to referred (emailtesterefe)
UPDATE photographer_accounts SET photo_credits = photo_credits + 1000, updated_at = now() WHERE user_id = 'ee82393d-cada-428e-bfd4-a6e069c84f3d';
INSERT INTO credit_ledger (user_id, operation_type, amount, description) VALUES ('ee82393d-cada-428e-bfd4-a6e069c84f3d', 'referral_bonus', 1000, 'Bônus de indicação: bônus de boas-vindas por ser indicado (retroativo)');

-- Mark bonus as granted
UPDATE referrals SET select_bonus_granted = true WHERE id = 'c2e1cf0e-323c-42ba-937a-c29970555fbd';
