

## Plano: Parcelamento em Upgrades Anuais

### Problema

O seletor de parcelas só aparece para novas assinaturas anuais (`isYearly && !isUpgrade`). Em upgrades anuais (screenshot do usuário), o checkout vai direto para cartão sem opção de parcelar. A API de subscriptions do Asaas (`/v3/subscriptions`) não suporta `installmentCount` — apenas `/v3/payments` suporta.

### Solução

Adicionar o seletor de parcelas também para upgrades anuais. Quando o usuário escolhe parcelar (2-12x), o upgrade usa apenas `/v3/payments` (pagamento avulso parcelado) em vez de criar uma nova subscription recorrente.

### Alterações

#### 1. `src/pages/CreditsPayment.tsx` — SubscriptionForm

- Mudar condição do seletor de parcelas de `isYearly && !isUpgrade` para `isYearly`
- Ajustar cálculo do valor base para parcelas em upgrades: usar `prorataValueCents` (valor líquido após crédito) em vez de `priceCents`
- No submit do upgrade:
  - `installments === 1` → fluxo atual (`upgradeSubscription` → cancela + cria subscription)
  - `installments > 1` → novo fluxo: chama `upgradeSubscription` com `installmentCount` para que o backend use payment em vez de subscription

#### 2. `supabase/functions/asaas-upgrade-subscription/index.ts`

- Aceitar novo campo `installmentCount` no body
- Quando `installmentCount > 1` e `billingCycle === 'YEARLY'`:
  - Mantém cancelamento das subs antigas (igual)
  - Mantém pagamento prorata (igual)
  - Em vez de criar subscription em `/v3/subscriptions`, cria payment em `/v3/payments` com `installmentCount` e `installmentValue` (valor total do novo plano, não apenas o prorata)
  - Grava em `subscriptions_asaas` com `metadata.paymentType: 'one_time'` e `metadata.installmentCount`
- Quando `installmentCount <= 1`: fluxo atual inalterado

#### 3. `src/pages/CreditsPayment.tsx` — OrderSummary

- Mostrar parcelas no resumo também para upgrades anuais parcelados
- Badge de renovação manual/automática para upgrades anuais

### Detalhe técnico do fluxo parcelado em upgrade

```
1. Cancela subs antigas no Asaas (DELETE /v3/subscriptions/{id})
2. Calcula prorata credit das subs canceladas
3. Cobra prorata (net charge) como payment avulso SEM parcelas (valor proporcional residual)
4. Cria payment do novo plano COMPLETO com installmentCount (valor cheio anual, parcelado)
5. Grava subscription_asaas com paymentType: 'one_time', next_due_date = +1 ano
```

Espera — reanalisando: no upgrade, o "pagar agora" já é o net charge (newPrice - creditProrata). Para parcelar, devemos parcelar esse net charge, não o valor cheio. Então:

```
1. Cancela subs antigas
2. Calcula net charge = newPriceCents - prorataCredit  
3. Se installments > 1: cria 1 payment com valor = netCharge, installmentCount, installmentValue
4. Se installments === 1: cria subscription recorrente + payment prorata (fluxo atual)
5. Em ambos os casos, grava em subscriptions_asaas
```

### Ordem

1. Atualizar edge function `asaas-upgrade-subscription` para suportar `installmentCount`
2. Expandir seletor de parcelas no `SubscriptionForm` para upgrades
3. Passar `installmentCount` no body do `upgradeSubscription`
4. Atualizar `OrderSummary` para upgrades parcelados

