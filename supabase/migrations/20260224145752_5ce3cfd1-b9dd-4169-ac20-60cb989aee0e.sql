
-- Create subscriptions_asaas table
CREATE TABLE public.subscriptions_asaas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  asaas_customer_id TEXT,
  asaas_subscription_id TEXT,
  plan_type TEXT NOT NULL,
  billing_cycle TEXT NOT NULL DEFAULT 'MONTHLY',
  status TEXT NOT NULL DEFAULT 'PENDING',
  value_cents INTEGER NOT NULL DEFAULT 0,
  next_due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Add asaas_customer_id to photographer_accounts
ALTER TABLE public.photographer_accounts 
ADD COLUMN IF NOT EXISTS asaas_customer_id TEXT;

-- RLS
ALTER TABLE public.subscriptions_asaas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscriptions"
  ON public.subscriptions_asaas
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscriptions"
  ON public.subscriptions_asaas
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subscriptions"
  ON public.subscriptions_asaas
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Allow service role / webhook updates (no auth context)
CREATE POLICY "Service can update any subscription"
  ON public.subscriptions_asaas
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Updated_at trigger
CREATE TRIGGER update_subscriptions_asaas_updated_at
  BEFORE UPDATE ON public.subscriptions_asaas
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_profiles_updated_at();
