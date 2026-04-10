CREATE POLICY "Users can check own allowed email"
ON public.allowed_emails
FOR SELECT
TO authenticated
USING (email = (auth.jwt()->>'email'));