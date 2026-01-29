-- Corrigir policy de update para ser mais restritiva
-- Apenas permite update se o status atual for 'pending' (para webhook processar)
DROP POLICY IF EXISTS "System can update purchases" ON public.credit_purchases;

CREATE POLICY "System can update pending purchases"
  ON public.credit_purchases
  FOR UPDATE
  USING (status = 'pending')
  WITH CHECK (true);