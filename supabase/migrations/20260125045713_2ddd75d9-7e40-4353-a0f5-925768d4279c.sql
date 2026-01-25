-- Step 1: Add credit columns to photographer_accounts
ALTER TABLE public.photographer_accounts
ADD COLUMN gallery_credits INTEGER NOT NULL DEFAULT 0,
ADD COLUMN galleries_published_total INTEGER NOT NULL DEFAULT 0;