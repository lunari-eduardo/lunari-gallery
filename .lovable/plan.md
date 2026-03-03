

## Plano: Corrigir "Mudar para anual" e Adicionar Renovação Antecipada

### Problema 1: "Mudar para anual" não funciona

O botão "Mudar para anual" chama `handleSubscribe('combo_completo', ...)` que na linha 228 executa:
```typescript
if (isSubActiveForPlan(allSubs, planType)) {
  toast.error('Você já possui este plano ativo.');
  return;
}
```
Como o usuário já tem `combo_completo` mensal ativo, o guard bloqueia. O sistema não distingue "mesmo plano, ciclo diferente" de "mesmo plano duplicado".

**Correção em `src/pages/CreditsCheckout.tsx` — `handleSubscribe` (linhas 226-310):**

Adicionar detecção de cycle upgrade antes do guard:
```typescript
const handleSubscribe = (planType, planName, priceCents) => {
  const selectedCycle = billingPeriod === 'monthly' ? 'MONTHLY' : 'YEARLY';
  
  // Detect cycle upgrade: same plan, different cycle (monthly→yearly)
  const existingSub = allSubs.find(s => 
    s.plan_type === planType && 
    ['ACTIVE','PENDING','OVERDUE'].includes(s.status)
  );
  const isCycleUpgrade = existingSub && existingSub.billing_cycle !== selectedCycle;
  
  // Guard: block only if exact same plan AND same cycle
  if (!isCycleUpgrade && isSubActiveForPlan(allSubs, planType)) {
    toast.error('Você já possui este plano ativo.');
    return;
  }
  
  if (isCycleUpgrade) {
    // Treat as upgrade: cancel current, apply prorata, create new
    // Navigate to payment with isUpgrade=true and the existing sub ID
    navigate('/credits/checkout/pay', {
      state: {
        type: 'subscription',
        planType,
        planName,
        billingCycle: selectedCycle,
        priceCents: newPriceCentsForCycle,
        isUpgrade: true,
        prorataValueCents: calculatedProrata,
        currentSubscriptionId: existingSub.id,
        subscriptionIdsToCancel: [existingSub.id],
        currentPlanName: getPlanDisplayName(existingSub.plan_type),
      },
    });
    return;
  }
  // ... rest of existing logic
};
```

O cálculo de prorata segue a mesma lógica existente: `crédito = preçoAtual * diasRestantes / totalDiasCiclo`. O valor líquido é `preçoAnual - crédito`.

A Edge Function `asaas-upgrade-subscription` já suporta este fluxo — cancela a sub antiga, cobra o valor líquido e cria a nova assinatura anual.

### Problema 2: Renovação Antecipada de planos anuais

Na página `SubscriptionManagement.tsx`, planos anuais precisam de um botão "Renovar antecipadamente" que:
1. Encerra a assinatura atual
2. Cria uma nova assinatura idêntica
3. Reinicia o ciclo de 12 meses
4. **Sem prorata** — é uma compra intencional do valor cheio

**Correção em `src/pages/SubscriptionManagement.tsx`:**

No `SubscriptionCard`, para assinaturas YEARLY ativas, adicionar botão "Renovar antecipadamente" ao lado de "Upgrade / Downgrade":

```typescript
{subscription.billing_cycle === 'YEARLY' && !isCancelled && (
  <Button variant="outline" size="sm" className="gap-1.5"
    onClick={() => handleEarlyRenewal(subscription)}>
    <RotateCcw className="h-3.5 w-3.5" />
    Renovar antecipadamente
  </Button>
)}
```

O fluxo de renovação antecipada reutiliza `handleSubscribe` mas com flag `isRenewal: true`:
- Navega para `/credits/checkout/pay` com `isUpgrade: true` + `isRenewal: true`
- O `OrderSummary` mostra "Renovação antecipada" em vez de "Upgrade"
- O `prorataValueCents` = preço cheio (sem desconto, renovação voluntária)

**Alteração no `SubscriptionPayment` type (CreditsPayment.tsx):**
```typescript
interface SubscriptionPayment {
  // ... existing fields
  isRenewal?: boolean; // early renewal flag
}
```

**Alteração no `OrderSummary` (CreditsPayment.tsx):**
- Se `isRenewal`, mostrar "Renovação antecipada" e não exibir crédito de prorata
- Texto: "Sua assinatura atual será encerrada e um novo ciclo de 12 meses iniciará."

**Alteração na Edge Function `asaas-upgrade-subscription`:**
- Já suporta o fluxo (cancela antiga, cria nova). Quando `netChargeCents === newPriceCents` (sem prorata), o step 3 de pagamento proporcional é pulado automaticamente pois o valor do one-time payment é zero.
- Na verdade, para renovação antecipada o prorata do plano antigo deve ser ZERO (usuário aceita perder os dias restantes). Então o frontend envia `prorataValueCents = priceCents` (valor cheio).

### Arquivos modificados

1. `src/pages/CreditsCheckout.tsx` — `handleSubscribe`: adicionar detecção de cycle upgrade antes do guard
2. `src/pages/SubscriptionManagement.tsx` — adicionar botão "Renovar antecipadamente" para planos anuais
3. `src/pages/CreditsPayment.tsx` — adicionar `isRenewal` ao type e ajustar `OrderSummary`

