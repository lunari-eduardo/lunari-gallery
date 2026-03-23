

# Conformidade com Regras de Integração Gallery ↔ Gestão

## Problemas encontrados

### `asaas-gallery-payment/index.ts` (linha 427)
```typescript
status: isConfirmed ? 'pago' : 'pendente', // ← VIOLA REGRA IMUTÁVEL
```
Quando cartão de crédito é confirmado imediatamente, insere com `status: 'pago'`. O trigger `ensure_transaction_on_cobranca_paid` é AFTER UPDATE — nunca dispara em INSERT. Resultado: transação financeira não criada, extrato vazio, `valor_pago` da sessão não atualizado.

Adicionalmente, na linha 457-470, chama `finalize_gallery_payment` diretamente após INSERT com status já `pago`, o que é redundante e perigoso.

### `asaas-gallery-webhook/index.ts` (linhas 93-98)
- Não extrai `payment.netValue` do payload
- Não cria registro em `cobranca_parcelas`
- Não atualiza `cobrancas.valor_liquido`
- Perde toda informação de taxas do gateway

## Correções

### 1. `asaas-gallery-payment/index.ts`

**Linha 427**: Sempre `status: 'pendente'`, nunca `'pago'`

**Linha 433**: Sempre `data_pagamento: null`

**Linhas 456-470**: Remover bloco `isConfirmed` que chama `finalize_gallery_payment` diretamente. O webhook processará a confirmação e fará a transição correta.

**Resultado**: INSERT sempre pendente → webhook muda para pago → trigger `ensure_transaction_on_cobranca_paid` dispara → transação criada → `valor_pago` atualizado.

### 2. `asaas-gallery-webhook/index.ts`

Após encontrar a cobrança e antes de chamar a RPC:

1. Extrair `payment.netValue` e calcular `taxa_gateway`
2. Atualizar `cobrancas.valor_liquido`
3. Criar `cobranca_parcelas` com upsert (idempotente via `asaas_payment_id`)
4. O trigger `reconcile_cobranca_from_parcelas` atualizará a cobrança automaticamente
5. Manter chamada a `finalize_gallery_payment` para sincronizar galeria/sessão
6. Também tratar `PAYMENT_ANTICIPATED` como evento válido

```text
Fluxo resultante:
webhook → extrai netValue → upsert cobranca_parcelas
  → trigger reconcile → UPDATE cobrancas (status='pago', valor_liquido)
    → trigger ensure_transaction → INSERT clientes_transacoes
      → trigger recompute_session_paid → UPDATE valor_pago
webhook → RPC finalize_gallery_payment → sincroniza galeria/sessão
```

## Arquivos a editar

| Arquivo | Mudança |
|---|---|
| `supabase/functions/asaas-gallery-payment/index.ts` | Sempre `status: 'pendente'`; remover bloco `isConfirmed` + `finalize_gallery_payment` |
| `supabase/functions/asaas-gallery-webhook/index.ts` | Extrair netValue; criar `cobranca_parcelas`; atualizar `valor_liquido`; tratar `PAYMENT_ANTICIPATED` |

