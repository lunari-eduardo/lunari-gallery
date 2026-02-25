

# Gerenciamento de Planos Transfer — Ajustes de UX e Regra de Upgrade Prorata

## Escopo

Duas frentes: (1) ajustes visuais na tela de gerenciamento de assinatura e (2) implementacao do fluxo de upgrade com cobranca proporcional.

## Mudancas

### 1. `src/pages/SubscriptionManagement.tsx` — Ajustes de UX

**1.1 Exibir tipo de ciclo abaixo do nome do plano:**
Abaixo do nome do plano (ex: "Transfer 5gb"), adicionar texto:
- Se `billing_cycle === 'MONTHLY'` → "Plano mensal"
- Se `billing_cycle === 'YEARLY'` → "Plano anual (20% off)"

**1.2 Microtexto abaixo dos botoes de acao:**
Adicionar `<p>` com texto: "Alteracoes de plano sao ajustadas proporcionalmente ao periodo atual." abaixo do grupo de botoes.

**1.3 Logica de navegacao para upgrade:**
O botao "Upgrade / Downgrade" passa a navegar para `/credits/checkout?tab=transfer&upgrade=true` incluindo dados da assinatura atual via query params ou state (plan_type, value_cents, billing_cycle, next_due_date, created_at).

### 2. `src/pages/CreditsCheckout.tsx` — Banner de upgrade e calculo prorata

**2.1 Detectar modo upgrade:**
Ler `searchParams.get('upgrade')` e, se presente, buscar a assinatura ativa via `useAsaasSubscription`.

**2.2 Banner no topo da secao Transfer:**
Quando em modo upgrade, exibir bloco informativo:
```
Seu plano atual: Transfer X GB
Voce pagara apenas a diferenca proporcional ao periodo restante.
```

**2.3 Calculo prorata nos cards:**
Para cada plano Transfer, calcular e exibir o valor proporcional:
- `difference = newPriceCents - currentPriceCents`
- `daysRemaining` = diferenca em dias entre `next_due_date` e hoje
- `totalCycleDays` = 30 (mensal) ou 365 (anual)
- `prorataValue = difference * (daysRemaining / totalCycleDays)`
- Exibir valor prorata abaixo do preco normal: "Pagar agora: R$ X,XX (proporcional)"
- Desabilitar planos inferiores ou iguais ao atual (ou permitir downgrade com logica separada conforme decisao futura)

**2.4 Botao de acao muda para "Fazer upgrade":**
Em modo upgrade, o botao do card muda de "Assinar" para "Fazer upgrade" e navega para a pagina de pagamento com state adicional: `isUpgrade: true`, `prorataValueCents`, `currentSubscriptionId`.

### 3. `src/pages/CreditsPayment.tsx` — Processar upgrade

**3.1 Novo tipo de state:**
Adicionar variante `UpgradePayment` com campos `isUpgrade`, `prorataValueCents`, `currentSubscriptionId`, alem dos campos de `SubscriptionPayment`.

**3.2 Order Summary ajustado:**
Quando `isUpgrade`, mostrar:
- Plano anterior → Plano novo
- Valor proporcional a cobrar
- Texto explicativo

**3.3 Cobranca:**
Cobrar `prorataValueCents` (nao o valor cheio). Apos pagamento confirmado, o backend deve cancelar a assinatura antiga e criar a nova.

### 4. Nova Edge Function `supabase/functions/asaas-upgrade-subscription/index.ts`

Responsabilidades:
1. Receber: `currentSubscriptionId`, `newPlanType`, `billingCycle`, `creditCard`, `creditCardHolderInfo`, `remoteIp`
2. Buscar assinatura atual no banco
3. Calcular prorata:
   - `difference = newPlanPrice - currentPlanPrice`
   - `daysRemaining = daysBetween(today, next_due_date)`
   - `totalCycleDays = billing_cycle === 'MONTHLY' ? 30 : 365`
   - `prorataValue = difference * (daysRemaining / totalCycleDays)`
4. Cobrar `prorataValue` como pagamento avulso no Asaas (`/v3/payments`)
5. Se pagamento confirmado:
   - Cancelar assinatura antiga no Asaas (`DELETE /v3/subscriptions/{id}`)
   - Marcar assinatura antiga como CANCELLED no banco
   - Criar nova assinatura no Asaas com cartao
   - Inserir nova assinatura no banco com status ACTIVE
6. Retornar resultado

### 5. `src/hooks/useAsaasSubscription.ts` — Adicionar mutation de upgrade

Adicionar `upgradeSubscription` mutation que chama a nova edge function `asaas-upgrade-subscription`.

### 6. `src/lib/transferPlans.ts` — Adicionar precos por plano

Adicionar mapa `TRANSFER_PLAN_PRICES` com precos mensais e anuais em centavos para cada plan_type, permitindo calculo de prorata no frontend:

```typescript
export const TRANSFER_PLAN_PRICES: Record<string, { monthly: number; yearly: number }> = {
  transfer_5gb: { monthly: 1290, yearly: 12384 },
  transfer_20gb: { monthly: 2490, yearly: 23904 },
  transfer_50gb: { monthly: 3490, yearly: 33504 },
  transfer_100gb: { monthly: 5990, yearly: 57504 },
};
```

## Detalhes Tecnicos — Calculo Prorata

```text
Exemplo:
  Plano atual: Transfer 5GB mensal (R$ 12,90/mes)
  Novo plano: Transfer 20GB mensal (R$ 24,90/mes)
  Dia da assinatura: 25/fev
  Proxima cobranca: 25/mar
  Hoje: 25/fev (0 dias usados, 28 dias restantes)

  difference = 2490 - 1290 = 1200 centavos
  daysRemaining = 28
  totalCycleDays = 30
  prorataValue = 1200 * (28/30) = 1120 centavos = R$ 11,20

  Cobrar R$ 11,20 agora.
  Nova assinatura: R$ 24,90/mes a partir do proximo ciclo.
```

## Arquivos

| Arquivo | Acao |
|---|---|
| `src/pages/SubscriptionManagement.tsx` | Ciclo do plano, microtexto, navegacao upgrade |
| `src/pages/CreditsCheckout.tsx` | Banner upgrade, calculo prorata, botao "Fazer upgrade" |
| `src/pages/CreditsPayment.tsx` | State de upgrade, order summary, cobranca prorata |
| `src/hooks/useAsaasSubscription.ts` | Mutation upgradeSubscription |
| `src/lib/transferPlans.ts` | Mapa de precos por plano |
| `supabase/functions/asaas-upgrade-subscription/index.ts` | Nova edge function para upgrade prorata |

