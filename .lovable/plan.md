

# Cartao de Credito via Asaas para Select + Parcelamento Anual + Badge de Renovacao

## Resumo

Tres mudancas principais:

1. **Select com cartao de credito**: Pagamentos com cartao no Select passam a ser via Asaas (nao Mercado Pago). PIX continua via Mercado Pago.
2. **Parcelamento ate 12x para planos anuais**: Planos anuais (Transfer/Combos) usam cobranca avulsa Asaas (`/v3/payments`) com `installmentCount`, em vez de subscription recorrente.
3. **Badge de renovacao manual**: Planos anuais (com ou sem parcelamento) mostram aviso de que a renovacao e manual apos 1 ano, ja que cobranqa avulsa nao renova automaticamente.

## Logica de Provedores (atualizada)

| Produto | PIX | Cartao de Credito |
|---|---|---|
| Select (creditos avulsos) | Mercado Pago | **Asaas** (a vista, 1x) |
| Transfer/Combos mensal | -- | Asaas (subscription recorrente, 1x) |
| Transfer/Combos anual | -- | Asaas (cobranca avulsa, 1-12x sem juros) |

## Mudancas Tecnicas

### 1. Nova Edge Function `asaas-create-payment`

Responsavel por cobranqas avulsas via Asaas (nao recorrentes):
- **Select com cartao**: `installmentCount: 1`, sem recorrencia
- **Planos anuais com parcelamento**: `installmentCount: 1-12`

Fluxo:
1. Recebe `productType` (`select` ou `subscription_yearly`), dados do cartao + titular
2. Cria customer se necessario (reutiliza `asaas_customer_id`)
3. Chama `POST /v3/payments` do Asaas com `billingType: CREDIT_CARD`
4. Para Select: chama RPC `purchase_credits` para adicionar creditos se pagamento aprovado
5. Para planos anuais: salva em `subscriptions_asaas` com status e data de expiracao (1 ano)

Payload da API:
```text
POST /v3/payments
{
  customer: "cus_XXXXX",
  billingType: "CREDIT_CARD",
  value: 239.04,
  dueDate: "2026-02-25",
  description: "Transfer 20GB - Anual",
  externalReference: "user_id",
  installmentCount: 12,
  installmentValue: 19.92,
  creditCard: { ... },
  creditCardHolderInfo: { ... },
  remoteIp: "..."
}
```

### 2. Atualizar `asaas-create-subscription` Edge Function

Manter apenas para planos **mensais** (subscription recorrente com auto-renovacao). Sem mudancas estruturais, apenas garantir que so aceita `billingCycle: MONTHLY`.

### 3. Refatorar `SelectForm` em `CreditsPayment.tsx`

Adicionar toggle PIX / Cartao de Credito:

```text
[PIX]  [Cartao de Credito]

Se PIX: fluxo atual (email + gerar QR)
Se Cartao: formulario de dados pessoais + cartao (mesmo layout do SubscriptionForm)
           Ao submeter: chama asaas-create-payment com productType: 'select'
```

### 4. Refatorar `SubscriptionForm` em `CreditsPayment.tsx`

- Se `billingCycle === 'YEARLY'`: exibir seletor de parcelas (1x a 12x) e chamar `asaas-create-payment` (cobranca avulsa)
- Se `billingCycle === 'MONTHLY'`: manter fluxo atual via `asaas-create-subscription` (subscription recorrente, 1x)

### 5. Atualizar `OrderSummary`

- Mostrar parcelas quando selecionadas: "12x de R$ 19,92 sem juros"
- Para planos anuais: exibir badge/aviso "Renovacao manual apos 12 meses"

### 6. Atualizar `useAsaasSubscription` hook

- Adicionar funcao `createPayment` para cobranqas avulsas (nova edge function)
- Adicionar `installmentCount` e `productType` aos tipos

### 7. Badge de renovacao no `CreditsCheckout.tsx`

Nos cards de planos anuais (Transfer e Combos), adicionar texto informativo:
```text
"Renovacao manual apos 12 meses"
```

---

## Arquivos

| Arquivo | Acao |
|---|---|
| `supabase/functions/asaas-create-payment/index.ts` | **Novo** - cobranca avulsa Asaas (Select cartao + anuais parcelados) |
| `src/pages/CreditsPayment.tsx` | Toggle PIX/Cartao no Select, seletor parcelas no anual, badge renovacao |
| `src/hooks/useAsaasSubscription.ts` | Adicionar `createPayment` para cobrancas avulsas |
| `src/pages/CreditsCheckout.tsx` | Badge "Renovacao manual" nos cards anuais |

## Regras de Negocio

| Produto | Metodo | Parcelas | Renovacao |
|---|---|---|---|
| Select | PIX (MP) | 1x | N/A |
| Select | Cartao (Asaas) | 1x a vista | N/A |
| Transfer/Combo mensal | Cartao (Asaas) | 1x | Automatica |
| Transfer/Combo anual | Cartao (Asaas) | 1-12x sem juros | Manual (badge) |

