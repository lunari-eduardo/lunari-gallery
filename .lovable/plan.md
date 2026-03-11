

## Plano: RPC `finalize_gallery_payment` + Refactor das 5 Edge Functions

### Lógica unificada identificada

A mesma lógica está duplicada em **5 arquivos** (não 4):
- `infinitepay-webhook` (linhas 310-436)
- `asaas-gallery-webhook` (linhas 93-153)
- `check-payment-status` (linhas 244-338)
- `confirm-payment-manual` (linhas 52-130)
- `mercadopago-webhook` (linhas 280-357)

Cada um faz o mesmo read-then-write:
1. Marcar `cobrancas.status = 'pago'`
2. Ler galeria → incrementar `total_fotos_extras_vendidas` e `valor_total_vendido` → finalizar
3. Ler sessão → incrementar `valor_pago` → atualizar status

### RPC: `finalize_gallery_payment`

Criar uma função PostgreSQL `SECURITY DEFINER` que recebe:
- `p_cobranca_id UUID`
- `p_receipt_url TEXT DEFAULT NULL`
- `p_paid_at TIMESTAMPTZ DEFAULT now()`

Executa atomicamente numa única transação:

```text
1. Lock advisory na cobrança (previne race condition)
2. SELECT cobrança FOR UPDATE
3. Se já paga → retorna { already_paid: true } (idempotente)
4. UPDATE cobrancas SET status='pago', data_pagamento, ip_receipt_url
   WHERE id = p_cobranca_id AND status = 'pendente'
5. Se galeria_id existe:
   UPDATE galerias SET
     total_fotos_extras_vendidas = total_fotos_extras_vendidas + qtd_fotos,  ← ATÔMICO
     valor_total_vendido = valor_total_vendido + valor,  ← ATÔMICO
     status_pagamento = 'pago',
     status_selecao = 'selecao_completa',
     finalized_at = p_paid_at
6. Se session_id existe:
   UPDATE clientes_sessoes SET
     status_galeria = 'selecao_completa',
     status_pagamento_fotos_extra = 'pago',
     updated_at = now()
7. Retorna JSONB com resultado
```

O trigger `ensure_transaction_on_cobranca_paid` já existente cria automaticamente a transação em `clientes_transacoes` quando `cobrancas.status` muda para `'pago'`.

O trigger `trigger_recompute_session_paid` já existente recalcula `valor_pago` quando `clientes_transacoes` é inserido.

Portanto a RPC **não precisa** incrementar `valor_pago` manualmente — os triggers fazem isso.

### Refactor das Edge Functions

Cada função substituirá toda a lógica duplicada por uma única chamada:

```typescript
const { data, error } = await supabase.rpc('finalize_gallery_payment', {
  p_cobranca_id: cobranca.id,
  p_receipt_url: receiptUrl || null,
  p_paid_at: new Date().toISOString(),
});
```

A lógica específica de cada webhook (validação de assinatura, busca da cobrança, log) permanece inalterada. Apenas o bloco de "atualizar cobrança + galeria + sessão" é substituído pela chamada RPC.

### Arquivos modificados

1. **Nova migration SQL** — cria `finalize_gallery_payment`
2. `supabase/functions/infinitepay-webhook/index.ts` — substituir linhas 310-436
3. `supabase/functions/asaas-gallery-webhook/index.ts` — substituir linhas 93-153
4. `supabase/functions/check-payment-status/index.ts` — substituir linhas 244-338 (função `updateToPaid`)
5. `supabase/functions/confirm-payment-manual/index.ts` — substituir linhas 52-130
6. `supabase/functions/mercadopago-webhook/index.ts` — substituir linhas 280-357

### Benefícios
- Operação atômica (uma transação PostgreSQL)
- Incrementos atômicos (`SET x = x + N` em vez de read-then-write)
- Idempotente (verifica status antes de atualizar)
- Advisory lock previne race conditions
- Ponto único de manutenção

