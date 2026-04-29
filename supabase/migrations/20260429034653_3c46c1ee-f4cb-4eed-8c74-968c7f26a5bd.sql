-- Correção pontual da Olívia - Newborn:
-- valor_total_vendido = 210 já estava correto, mas total_fotos_extras_vendidas ficou 0.
UPDATE public.galerias
SET total_fotos_extras_vendidas = 10, updated_at = now()
WHERE id = '37c3adb2-b391-4614-b736-2b3338a89760'
  AND total_fotos_extras_vendidas = 0
  AND valor_total_vendido = 210;

UPDATE public.clientes_sessoes
SET qtd_fotos_extra = 10, updated_at = now()
WHERE session_id = (SELECT session_id FROM public.galerias WHERE id = '37c3adb2-b391-4614-b736-2b3338a89760')
  AND qtd_fotos_extra = 0;