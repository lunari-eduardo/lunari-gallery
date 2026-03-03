

## Plano: Dois Fluxos de Pagamento Anual + Destaque no Checkout

### Contexto atual

- Planos anuais **sempre** usam `createPayment` (pagamento avulso parcelável), sem renovação automática
- Planos mensais usam `createSubscription` (recorrência automática)
- O `asaas-create-subscription` já suporta `billingCycle: 'YEARLY'` — cria assinatura recorrente anual no Asaas

### Dois fluxos para plano anual

| Opção | Endpoint | Renovação | Parcelas |
|-------|----------|-----------|----------|
| À vista (1x) | `asaas-create-subscription` (YEARLY) | Automática | 1x |
| Parcelado (2-12x) | `asaas-create-payment` | Manual | 2-12x |

### Alterações

#### 1. `src/pages/CreditsPayment.tsx` — SubscriptionForm

**Área de parcelamento com destaque:**
- Reformular o seletor de parcelas para ficar visualmente proeminente (card com borda primária)
- Dividir em duas opções visuais claras:
  - **"À vista"** com badge "Renovação automática" — seleciona 1x e roteia para `createSubscription`
  - **"Parcelado"** com badge "Renovação manual" — permite 2-12x e roteia para `createPayment`
- Aviso contextual abaixo da seleção:
  - Se à vista: "Sua assinatura será renovada automaticamente a cada 12 meses."
  - Se parcelado: "Este plano terá renovação manual. Você será notificado antes do vencimento para renovar."

**Lógica de submit:**
- `installments === 1` → chamar `createSubscription({ billingCycle: 'YEARLY', ... })` (assinatura recorrente)
- `installments > 1` → chamar `createPayment({ productType: 'subscription_yearly', installmentCount, ... })` (pagamento avulso)

#### 2. `src/pages/CreditsPayment.tsx` — OrderSummary

- Quando anual: mostrar se é "Assinatura anual" (à vista) ou "Compra parcelada" (parcelado)
- Mostrar parcelas no resumo: "12x de R$ X sem juros"
- Aviso de renovação no rodapé do resumo

#### 3. `src/pages/CreditsCheckout.tsx` — Nenhuma mudança estrutural

Os cards já passam `billingCycle: 'YEARLY'` via navigate state. A distinção à vista vs parcelado é feita no checkout (CreditsPayment).

### Nenhuma mudança em Edge Functions

- `asaas-create-subscription` já suporta `YEARLY`
- `asaas-create-payment` já suporta `installmentCount`
- Ambos já gravam em `subscriptions_asaas` com os campos corretos

### Ordem de implementação

1. Reformular área de parcelas no `SubscriptionForm` com os dois fluxos visuais
2. Ajustar lógica de submit para rotear entre subscription e payment
3. Atualizar `OrderSummary` para refletir tipo de renovação e parcelas

