-- CRITICAL FIX: system_cache was readable by any authenticated user
-- Drop the permissive USING(true) policy
DROP POLICY IF EXISTS "Service role can manage cache" ON system_cache;

-- Create restrictive policy that blocks ALL access (service role bypasses RLS automatically)
CREATE POLICY "Block all non-service access to cache"
ON system_cache
FOR ALL
TO authenticated, anon
USING (false)
WITH CHECK (false);