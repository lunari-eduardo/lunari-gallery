UPDATE public.cobrancas
SET status = 'cancelado'
WHERE id IN (
  '9b94a534-bdd7-435b-8be3-ea1072ddaf60',
  '16d86621-ac8e-4589-b048-6bb4555ba14a'
)
AND status = 'pendente'
AND provedor = 'infinitepay';