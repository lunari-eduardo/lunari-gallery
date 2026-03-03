

## Plano: Corrigir lógica de upgrade/downgrade entre ciclos e adicionar upgrade de ciclo

### Problemas identificados

**1. Transfer cards mostram "Fazer upgrade" no ciclo anual quando usuário tem combo_completo mensal**

Na linha 637-641 de `CreditsCheckout.tsx`, a lógica de `isDowngrade` compara **preços** entre ciclos diferentes:
```typescript
const isDowngrade = isUpgradeMode && currentPlanPrices && (
  effectiveBilling === 'YEARLY'
    ? plan.yearlyPrice <= currentPriceCents  // compara preço anual vs preço mensal do combo!
    : plan.monthlyPrice <= currentPriceCents
);
```
Quando o usuário tem combo_completo mensal (6490 cents), ao ver transfer anual (ex: transfer_5gb = 12384/ano), `12384 > 6490` → sistema diz que não é downgrade. **Errado.** Transfer solo é SEMPRE inferior a combo_completo independente do ciclo.

**2. Combo card no Transfer tab não oferece upgrade de ciclo (mensal → anual)**

Na linha 794, `isSubActiveForPlan` detecta o combo como "Plano atual" e mostra "Gerenciar assinatura". Mas se o usuário tem combo mensal e está vendo preços anuais, deveria oferecer upgrade de ciclo (mensal → anual).

### Correções em `src/pages/CreditsCheckout.tsx`

**Correção 1 — Usar hierarquia de plano em vez de preço para detectar downgrade nos Transfer cards (linhas 636-641)**

Substituir a lógica de preço por comparação de hierarquia:
```typescript
const cardHierarchy = getPlanHierarchyLevel(planKey);
const isCurrentPlan = isUpgradeMode && planKey === currentPlanType;

// Get highest active plan level across ALL subs (not just transfer)
const highestActiveLevel = Math.max(
  ...activeSubs.map(s => getPlanHierarchyLevel(s.plan_type)), 0
);

// A transfer solo is ALWAYS a downgrade if user has a combo (higher hierarchy)
const isDowngrade = !isCurrentPlan && highestActiveLevel > cardHierarchy;
```

Isso garante que todo transfer solo (level 30-60) é downgrade quando o usuário tem combo_completo (level 200).

**Correção 2 — Adicionar upgrade de ciclo no combo card do Transfer tab (linhas 793-851)**

Quando o combo está ativo MAS o `billingPeriod` visualizado é diferente do ciclo atual da sub:
- Se usuário tem combo mensal e está vendo aba anual → mostrar botão "Mudar para anual" (upgrade de ciclo)
- Se usuário tem combo anual e está vendo aba mensal → mostrar como "Plano atual" (downgrade de ciclo pode ser feito em Gerenciar)

Lógica:
```typescript
const isCurrentComboCompleto = isSubActiveForPlan(allSubs, 'combo_completo');
const activeComboSub = allSubs.find(s => s.plan_type === 'combo_completo' && ['ACTIVE','PENDING','OVERDUE'].includes(s.status));
const currentComboCycle = activeComboSub?.billing_cycle || 'MONTHLY';
const viewingCycle = billingPeriod === 'monthly' ? 'MONTHLY' : 'YEARLY';
const isCycleUpgrade = isCurrentComboCompleto && currentComboCycle === 'MONTHLY' && viewingCycle === 'YEARLY';
```

Se `isCycleUpgrade`: mostrar botão "Mudar para anual" que chama `handleSubscribe` com o preço anual e flag de upgrade.

**Correção 3 — Mesma lógica para combo cards na aba Select (linhas 460-463)**

Aplicar a mesma detecção de upgrade de ciclo nos combo cards da aba Select. Se o usuário tem combo_pro_select2k mensal e está vendo anual, oferecer upgrade de ciclo.

### Arquivos modificados

- `src/pages/CreditsCheckout.tsx` — 3 blocos de código alterados

