

## Plano: Corrigir Prorata Cross-Product e Resumo de Pagamento

### Problemas identificados

**1. Gallery usa apenas a última assinatura para cálculo de crédito**
Em `CreditsCheckout.tsx`, `activeSub` pega apenas UMA assinatura (a última ativa). Quando o usuário tem Transfer 5GB (R$12,90) + Studio Starter (R$14,90 via Gestão), `currentPriceCents` vira R$14,90 (Studio), e o crédito exibido nos cards Transfer é R$14,40 em vez de R$12,90 proporcional.

**2. Gallery não detecta sobreposição de capabilities (cross-product)**
Gestão usa `getOverlappingSubs()` com `PLAN_INCLUDES` para encontrar TODAS as assinaturas que se sobrepõem ao plano alvo. Gallery não tem essa lógica — só detecta combos de forma simplificada via `getActiveSubsToCancel()` que retorna TODAS as subs ativas indiscriminadamente.

**3. Upgrade Transfer ignora assinatura Studio existente**
Na tab Transfer, `isUpgradeMode` usa `activeSub` (que pode ser Studio, não Transfer). O cálculo de prorata deveria:
- Para upgrade Transfer→Transfer: creditar apenas o Transfer ativo
- Para upgrade para Combo: creditar Transfer + Studio (ambos são absorvidos)

**4. Resumo mostra "Diferença proporcional" em vez de "Crédito de planos ativos"**
O `OrderSummary` em `CreditsPayment.tsx` exibe `prorataFormatted` como "Diferença proporcional". Deveria mostrar o valor do CRÉDITO (newPrice - prorataValue) como "Crédito de planos ativos" e o valor líquido como "Pagar agora".

---

### Correções

#### 1. `src/pages/CreditsCheckout.tsx` — Portar lógica cross-product do Gestão

- Adicionar `getOverlappingSubs(targetPlanType)` usando `PLAN_INCLUDES` (já importado de `transferPlans.ts`)
- Adicionar `getCrossProductProrata(targetPlanType, targetPriceCents)` — mesma lógica do Gestão com cap de crédito por plano
- Corrigir `handleSubscribe`:
  - No modo upgrade Transfer: calcular crédito apenas do `transferSub`, mas também verificar cross-product (se tem Studio e vai para Combo)
  - No modo combo: usar `getCrossProductProrata` para somar créditos de todas as subs sobrepostas
- Corrigir cards Transfer: exibir prorata usando crédito combinado correto (Transfer atual + cross-product se aplicável)
- Passar `creditCents` (valor do crédito) no state de navegação para exibir no OrderSummary

#### 2. `src/pages/CreditsPayment.tsx` — Corrigir OrderSummary

- Receber `creditCents` adicional no `SubscriptionPayment` interface
- Calcular `creditAmount = priceCents - prorataValueCents`
- Exibir:
  - "Valor do novo plano" → R$ X/mês
  - "Crédito de planos ativos" → R$ Y (valor do crédito, em verde ou destaque)
  - "Pagar agora" → R$ Z (prorataValueCents)

#### 3. `src/lib/transferPlans.ts` — Já tem `PLAN_INCLUDES`, nenhuma mudança necessária

---

### Ordem

1. Portar `getOverlappingSubs` + `getCrossProductProrata` para `CreditsCheckout.tsx`
2. Corrigir `handleSubscribe` e cálculo de prorata nos cards
3. Atualizar `OrderSummary` para mostrar "Crédito de planos ativos"

