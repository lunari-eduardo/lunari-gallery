

# Plano: corrigir contagem de fotos extras pagas no fluxo Asaas (e padronizar todos os provedores)

## Diagnóstico

Galeria `963afe89...` no banco:

| Campo | Valor real | Esperado |
|---|---|---|
| `total_fotos_extras_vendidas` | **0** | 3 |
| `valor_total_vendido` | **R$ 0** | R$ 75 |
| Cobranças pagas (Asaas) | 2 (R$ 50 + R$ 25), `status='pago'` | ok |

Por isso, ao reativar, o cliente vê **todas as fotos extras de novo**: o sistema acha que nada foi pago. Em InfinitePay isso não acontece.

## Causa raiz: corrida de 3 caminhos no fluxo Asaas

Quando a parcela Asaas é confirmada, três trechos disputam o `status` da cobrança:

```text
1. webhook upsert em cobranca_parcelas
   └─► trigger reconcile_cobranca_from_parcelas
       └─► UPDATE cobrancas SET status='pago'
           └─► trigger sync_gallery_on_cobranca_paid (BEFORE UPDATE)
               └─► UPDATE galerias SET status_pagamento='pago', status_selecao='selecao_completa'
                   (NÃO toca em total_fotos_extras_vendidas nem valor_total_vendido)

2. webhook chama RPC finalize_gallery_payment(p_cobranca_id, p_receipt_url, p_paid_at)
   └─► RPC entra no branch "IF v_cobranca.status IN ('pago','pago_manual')" (já é pago)
       └─► Tenta incrementar contadores SOMENTE se status_pagamento NOT IN ('pago','pago_manual')
       └─► Mas o trigger (#1) já marcou status_pagamento='pago' → FOUND falha → contadores NUNCA são incrementados
```

**InfinitePay não tem esse problema** porque não passa por `cobranca_parcelas`. A RPC recebe `cobranca.status='pendente'` e cai no caminho "novo pagamento", que incrementa corretamente.

## Solução

### Parte 1 — Corrigir a RPC `finalize_gallery_payment` (5 args)

Tornar o incremento de `total_fotos_extras_vendidas` e `valor_total_vendido` **idempotente** e independente do `status_pagamento` corrente da galeria. Substituir a guard atual por uma trava por cobrança:

- guardar uma flag `extras_contabilizados` na própria `cobrancas` (coluna `boolean DEFAULT false`);
- a RPC só incrementa os contadores se a cobrança ainda não foi contabilizada;
- após incrementar, marca `cobrancas.extras_contabilizados = true` na mesma transação;
- isso elimina a dependência do `status_pagamento` da galeria como guard, que é frágil (o trigger #1 sempre vai chegar primeiro em Asaas).

Em pseudo-SQL na RPC:

```text
IF v_cobranca.extras_contabilizados IS NOT TRUE
   AND COALESCE(v_cobranca.qtd_fotos, 0) > 0
   AND v_galeria_id IS NOT NULL THEN
  UPDATE galerias
    SET total_fotos_extras_vendidas = COALESCE(total_fotos_extras_vendidas,0) + v_cobranca.qtd_fotos,
        valor_total_vendido       = COALESCE(valor_total_vendido,0)       + v_cobranca.valor,
        ...
    WHERE id = v_galeria_id;
  UPDATE cobrancas SET extras_contabilizados = true WHERE id = p_cobranca_id;
END IF;
```

Aplicar em **todos os branches** da RPC (already paid, parcelas Asaas, novo pagamento). Assim qualquer caminho — webhook, auto-heal, polling, finalização manual — produz o mesmo resultado uma única vez.

### Parte 2 — Migração para curar registros já existentes

```sql
ALTER TABLE public.cobrancas
  ADD COLUMN IF NOT EXISTS extras_contabilizados boolean NOT NULL DEFAULT false;

-- Marcar como contabilizadas as cobranças cujos valores já estão refletidos
-- na galeria (heurística: status pago/pago_manual + qtd_fotos > 0).
-- Para registros órfãos (Asaas pagos cujos contadores foram zerados pelo bug),
-- recalcular galerias.total_fotos_extras_vendidas e valor_total_vendido a partir
-- da soma das cobranças pagas e marcar todas como contabilizadas.
WITH agregado AS (
  SELECT galeria_id,
         SUM(qtd_fotos) AS qtd,
         SUM(valor)     AS val
  FROM public.cobrancas
  WHERE status IN ('pago','pago_manual')
    AND galeria_id IS NOT NULL
    AND COALESCE(qtd_fotos,0) > 0
  GROUP BY galeria_id
)
UPDATE public.galerias g
   SET total_fotos_extras_vendidas = a.qtd,
       valor_total_vendido         = a.val
  FROM agregado a
 WHERE g.id = a.galeria_id;

UPDATE public.cobrancas
   SET extras_contabilizados = true
 WHERE status IN ('pago','pago_manual')
   AND COALESCE(qtd_fotos,0) > 0;
```

Resultado: galeria de teste passa para `total_fotos_extras_vendidas=3` e `valor_total_vendido=75`.

### Parte 3 — Padronizar contrato compartilhado para todos os provedores

Hoje cada provedor calcula extras de forma ligeiramente diferente:

| Provedor | Caminho de finalização | Risco |
|---|---|---|
| InfinitePay | webhook → RPC (sem trigger intermediário) | OK hoje, mas continuará OK porque a RPC vira idempotente |
| Asaas | webhook → upsert parcela → triggers → RPC | quebrado — corrigido pela Parte 1 |
| Mercado Pago | webhook → RPC | mesmo padrão InfinitePay; herda a correção |
| PIX Manual | confirm-payment-manual → RPC | mesmo padrão; herda a correção |
| Asaas via polling (`check-payment-status`) | API Asaas → RPC | mesmo padrão; herda a correção |

A coluna `extras_contabilizados` torna a regra **uma só** para todos: "incrementa uma vez por cobrança paga, nunca mais". Não precisa mudar nenhum webhook ou edge function.

### Parte 4 — Garantir que reativação não zere o crédito

`useSupabaseGalleries.reopenSelectionMutation` hoje faz:

```text
UPDATE galerias SET
  status='selecao_iniciada',
  status_selecao='em_andamento',
  status_pagamento='sem_vendas',
  finalized_at=null
WHERE id=...
```

Confirmar (e proteger) que **NÃO** zera `total_fotos_extras_vendidas` nem `valor_total_vendido`. Está correto hoje, mas adicionar um comentário explícito no código alertando que esses dois campos são "crédito do cliente" e nunca devem ser resetados — só incrementados pela RPC.

### Parte 5 — Validação extra no `confirm-selection`

Hoje o `confirm-selection` lê `gallery.total_fotos_extras_vendidas` para descontar do `extrasACobrar`. Adicionar log de sanidade quando há cobranças pagas para a galeria mas o contador é zero — sinaliza divergência precoce em galerias futuras:

```text
IF (SELECT COUNT(*) FROM cobrancas WHERE galeria_id=... AND status IN ('pago','pago_manual')) > 0
   AND gallery.total_fotos_extras_vendidas = 0 THEN
  console.warn('⚠️ DIVERGÊNCIA: cobranças pagas existem mas contador zerado, executando auto-heal...')
  PERFORM finalize_gallery_payment para cada cobrança
END IF;
```

## Detalhes técnicos

| Arquivo | Mudança |
|---|---|
| `supabase/migrations/<novo>.sql` | (a) `ADD COLUMN extras_contabilizados`; (b) recompor galerias afetadas; (c) marcar cobranças já pagas como contabilizadas; (d) atualizar a RPC `finalize_gallery_payment` (5 args) |
| `supabase/functions/confirm-selection/index.ts` | adicionar auto-heal preventivo + log de divergência (opcional, defensivo) |
| `src/hooks/useSupabaseGalleries.ts` | comentário explícito no `reopenSelectionMutation` |
| Nenhuma mudança em | webhooks Asaas, InfinitePay, MercadoPago; `infinitepay-create-link`; `asaas-gallery-payment`; `gallery-access`; `try_lock_gallery_selection`; triggers `sync_gallery_on_cobranca_paid` e `reconcile_cobranca_from_parcelas` |

A versão antiga de `finalize_gallery_payment(p_cobranca_id uuid)` de 1 argumento (que ainda existe no banco) será **deletada** para evitar uso acidental. Nenhuma edge function a chama hoje.

## Validação

1. rodar a migração → galeria de teste passa a mostrar `total_fotos_extras_vendidas=3, valor_total_vendido=75`;
2. abrir a galeria como cliente após a reativação atual → tela de seleção mostra "Extras já pagas: 3" e "Valor a pagar: R$ 0" para as mesmas 2 fotos;
3. selecionar uma 3ª foto extra (4ª foto total) → deve cobrar apenas o valor da nova extra com desconto progressivo aplicado sobre `totalExtras=4`;
4. confirmar e pagar → após webhook, `total_fotos_extras_vendidas=4` e `extras_contabilizados=true` em ambas as cobranças novas e antigas;
5. reativar de novo → contador permanece 4, cliente não vê cobrança duplicada;
6. repetir o teste com InfinitePay (regressão): comportamento idêntico ao atual, sem cobrança duplicada;
7. repetir com Mercado Pago e PIX Manual;
8. `npm run build` sem erros TS;
9. webhooks `asaas-webhook`, `asaas-gallery-webhook`, `infinitepay-webhook`, `mercadopago-webhook` continuam intactos.

## Resultado esperado

- a coluna `extras_contabilizados` torna o incremento de extras pagas **idempotente e provedor-agnóstico**;
- ao reativar uma galeria, o cliente nunca mais paga novamente fotos já compradas;
- desconto progressivo conta automaticamente o histórico em todos os provedores;
- nenhum impacto em InfinitePay (continua funcionando exatamente como antes);
- sem alteração nos webhooks ou nos `create-link` de InfinitePay (contrato compartilhado preservado).

