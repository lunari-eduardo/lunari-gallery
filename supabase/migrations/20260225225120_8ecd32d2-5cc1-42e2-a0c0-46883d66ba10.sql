-- Add downgrade scheduling fields to subscriptions_asaas
ALTER TABLE public.subscriptions_asaas 
  ADD COLUMN IF NOT EXISTS pending_downgrade_plan TEXT,
  ADD COLUMN IF NOT EXISTS pending_downgrade_cycle TEXT;

-- Add over-limit fields to photographer_accounts
ALTER TABLE public.photographer_accounts
  ADD COLUMN IF NOT EXISTS account_over_limit BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS over_limit_since TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deletion_scheduled_at TIMESTAMPTZ;