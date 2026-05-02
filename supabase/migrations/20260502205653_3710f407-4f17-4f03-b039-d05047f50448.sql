-- Reconciliar valor_foto_extra entre galeria e sessão vinculada.
-- A partir desta data, a fonte de verdade do valor da foto extra é
-- clientes_sessoes (regras_congeladas.pacote.valorFotoExtra), refletido na
-- coluna escalar clientes_sessoes.valor_foto_extra (mantido pelo trigger
-- sync_session_extra_price_to_frozen).
--
-- Esta migration apenas reconcilia divergências históricas em galerias
-- NÃO finalizadas onde a galeria foi editada localmente mas a sessão ficou
-- com o valor antigo. Adota o valor da galeria como verdade no momento da
-- cura. Galerias finalizadas ficam intocadas (preservam histórico).

UPDATE public.clientes_sessoes s
SET
  valor_foto_extra = ROUND(LEAST(GREATEST(g.valor_foto_extra::numeric, 0), 999.99)::numeric, 2),
  updated_at = now()
FROM public.galerias g
WHERE g.session_id = s.session_id
  AND g.finalized_at IS NULL
  AND COALESCE(g.valor_foto_extra, 0) > 0
  AND ABS(COALESCE(s.valor_foto_extra, 0) - COALESCE(g.valor_foto_extra, 0)) > 0.005;