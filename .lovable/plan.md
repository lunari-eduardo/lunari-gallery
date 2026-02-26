

# Correções: Upgrade sem Desconto, Cancelamento 404 e UX Pós-Cancelamento

## Problemas Identificados

### 1. Upgrade sem desconto proporcional ao acessar diretamente
A página `CreditsCheckout.tsx` só calcula prorata quando `isUpgradeMode = true`, que depende do parâmetro URL `upgrade=true`. Ao acessar `/credits/checkout?tab=transfer` diretamente (sem o botão "Upgrade"), os parâmetros `current_plan`, `billing_cycle`, `next_due_date` e `subscription_id` não estão na URL, então o sistema não sabe que existe plano ativo.

**Solução**: Usar o hook `useAsaasSubscription` diretamente no `CreditsCheckout` para detectar automaticamente se existe assinatura ativa, sem depender de parâmetros de URL. Se `subscription` existir, entrar automaticamente em modo upgrade com os dados reais.

### 2. Cancelamento retorna 404
O erro mostra que o POST para `asaas-cancel-subscription` retorna 404 — a Edge Function não está deployed. Precisa ser redeployed.

Adicionalmente, há um bug de parâmetro: `SubscriptionManagement.tsx` chama `cancelSubscription(subscription.asaas_subscription_id)` mas a Edge Function busca por `eq("id", subscriptionId)` (campo local do banco). Deveria receber o `subscription.id` (ID local) em vez do `asaas_subscription_id`.

### 3. UX pós-cancelamento ausente
- Após cancelar, o código navega para `/credits` imediatamente, sem feedback.
- A query do hook filtra apenas `ACTIVE, PENDING, OVERDUE`, então assinaturas `CANCELLED` desaparecem da UI.
- Falta: mostrar que o plano foi cancelado mas está vigente até `next_due_date`, com opção de desfazer o cancelamento.
- Falta: quando não há plano ativo nem período vigente, mostrar mensagem motivacional + histórico.

## Mudanças

### 1. `src/pages/CreditsCheckout.tsx` — Auto-detectar assinatura ativa

Em vez de depender de `searchParams` para saber o plano atual, importar `useAsaasSubscription` e usar `subscription` diretamente:
- Se `subscription` existir E `activeTab === 'transfer'`, ativar modo upgrade automaticamente
- Manter os parâmetros de URL como fallback (para manter compatibilidade com o botão existente)
- Calcular `currentPlanType`, `currentBillingCycle`, `nextDueDate`, `currentSubscriptionId` a partir de `subscription` quando disponível

### 2. `src/hooks/useAsaasSubscription.ts` — Query inclui CANCELLED recente

Alterar a query para incluir assinaturas `CANCELLED` que ainda estão no período vigente (`next_due_date > now()`). Adicionar lógica de prioridade: `ACTIVE` primeiro, depois `CANCELLED` com período vigente.

Corrigir: a query deve buscar status `CANCELLED` também, e retornar a mais relevante.

### 3. `src/pages/SubscriptionManagement.tsx` — Corrigir chamada de cancelamento e UX

**Bug**: Mudar `cancelSubscription(subscription.asaas_subscription_id)` para `cancelSubscription(subscription.id)`.

**UX pós-cancelamento**: 
- Não navegar para `/credits` após cancelar — permanecer na página
- Quando `status === 'CANCELLED'` e `next_due_date` está no futuro: mostrar card com "Assinatura cancelada — acesso vigente até [data]" + botão "Desfazer cancelamento"
- Quando `status === 'CANCELLED'` e `next_due_date` já passou (ou sem assinatura): mostrar mensagem "Ative um plano e faça entregas que geram valor à sua fotografia" + botão para ver planos
- Esconder botões de "Cancelar assinatura" e "Upgrade/Downgrade" quando já está cancelada

### 4. `supabase/functions/asaas-cancel-subscription/index.ts` — Manter período vigente

Ao cancelar, em vez de apenas marcar `status: CANCELLED`, preservar `next_due_date` para que o sistema saiba até quando o acesso é válido. A edge function já faz isso (apenas muda status), mas precisa ser redeployed.

### 5. Nova funcionalidade: Desfazer cancelamento

Adicionar mutation `reactivateSubscription` no hook que:
- Chama a API Asaas para reativar a assinatura (se suportado) ou apenas atualiza o status local para `ACTIVE`
- Atualiza o banco de `CANCELLED` para `ACTIVE`

## Arquivos

| Arquivo | Acao |
|---|---|
| `src/pages/CreditsCheckout.tsx` | Auto-detectar assinatura ativa via hook, sem depender de URL params |
| `src/hooks/useAsaasSubscription.ts` | Incluir CANCELLED com período vigente na query; adicionar mutation de reativação |
| `src/pages/SubscriptionManagement.tsx` | Corrigir param do cancel; UX para cancelada vigente; estado sem plano |
| `supabase/functions/asaas-cancel-subscription/index.ts` | Redeploy (sem mudanças de código) |

## Detalhes Tecnicos

**Auto-detecção de assinatura no Checkout:**
```text
// Prioridade: subscription do hook > URL params
const sub = subscription; // do useAsaasSubscription()
const hasActiveSub = !!sub && activeTab === 'transfer';

const effectiveUpgradeMode = hasActiveSub || isUpgradeMode;
const effectiveCurrentPlan = sub?.plan_type || currentPlanType;
const effectiveBillingCycle = sub?.billing_cycle || currentBillingCycle;
const effectiveNextDueDate = sub?.next_due_date || nextDueDate;
const effectiveSubscriptionId = sub?.id || currentSubscriptionId;
```

**Query expandida no hook:**
```text
// Buscar ACTIVE/PENDING/OVERDUE primeiro, senão CANCELLED com período vigente
.in('status', ['ACTIVE', 'PENDING', 'OVERDUE', 'CANCELLED'])
// Ordenar: ACTIVE primeiro, CANCELLED por último
// Filtrar CANCELLED sem período vigente no código
```

**Estados da página de gerenciamento:**
```text
1. Loading → Skeleton
2. subscription.status = ACTIVE → Card completo com ações
3. subscription.status = CANCELLED + next_due_date > now() → Card com aviso amarelo "Cancelada, vigente até X" + botão desfazer
4. subscription.status = CANCELLED + next_due_date <= now() (ou !subscription) → Mensagem motivacional + histórico
```

