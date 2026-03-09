-- Drop the old policy that blocks client actions (user_id = null)
DROP POLICY IF EXISTS "Users can manage own gallery actions" ON public.galeria_acoes;

-- Photographer can VIEW all actions of their own galleries (including user_id null from edge functions)
CREATE POLICY "Owner can view gallery actions"
  ON public.galeria_acoes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.galerias g 
      WHERE g.id = galeria_acoes.galeria_id 
      AND g.user_id = auth.uid()
    )
  );

-- Photographer can INSERT actions into their own galleries
CREATE POLICY "Owner can insert gallery actions"
  ON public.galeria_acoes
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);