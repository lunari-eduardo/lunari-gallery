

# Continuação: Suporte a Múltiplas Assinaturas e Upgrades Cross-Product

## O que já está feito
- Tabela `unified_plans` criada e populada
- `transferPlans.ts` atualizado com todos os planos
- `useTransferStorage.ts` com `free_transfer_bytes`
- Edge functions com novos plan types
- Trigger de signup com 500 créditos + 0.5GB

## O que falta

### Bug: plan_type errado no combo
Linha 398 de `CreditsCheckout.tsx` usa `combo_studio_pro` mas o código correto é `combo_pro_select2k`.

### 1. `useAsaasSubscription.ts` — Suportar múltiplas assinaturas

Hoje retorna **uma** subscription. Mas o usuário pode ter Studio (assinado no outro projeto) + Transfer simultaneamente. Precisa retornar **todas** as assinaturas ativas e expor helpers:

- `subscriptions`: array de todas ativas
- `subscription`: mantém compatibilidade (primeira encontrada)
- `getByFamily(family)`: retorna assinatura de uma família específica
- `transferSub`: atalho para assinatura Transfer/Combo com transfer
- `studioSub`: atalho para assinatura Studio/Combo com studio

A query busca todas (não `limit(1)`) e agrupa.

### 2. `CreditsCheckout.tsx` — Upgrade cross-product nos combos

Quando usuário clica em um combo e já tem assinatura(s) ativa(s):

- Se tem **Transfer** ativo e quer **combo_completo**: calcular prorata do Transfer como desconto
- Se tem **Studio** ativo (vindo do outro projeto) e quer **combo_pro_select2k**: calcular prorata do Studio
- Se tem **Transfer + Studio** e quer **combo_completo**: somar proratas de ambos

O `handleSubscribe` precisa:
1. Detectar assinaturas existentes que serão substituídas pelo combo (usando `PLAN_INCLUDES`)
2. Passar array de `subscriptionsToCancel` no state da navegação para o checkout pay

### 3. `asaas-upgrade-subscription` Edge Function — Cancelar múltiplas

Hoje aceita `currentSubscriptionId` (singular). Expandir para aceitar `subscriptionIds` (array). Para cada uma:
- Calcular prorata individual
- Cancelar no Asaas
- Marcar como CANCELLED no banco
- Somar todos os proratas no valor de desconto

### 4. `SubscriptionManagement.tsx` — Exibir múltiplas assinaturas

Mostrar cards separados para cada assinatura ativa (Transfer e/ou Studio), cada um com suas próprias ações de upgrade/cancel.

## Arquivos a modificar

| Arquivo | Ação |
|---|---|
| `src/hooks/useAsaasSubscription.ts` | Retornar array de subscriptions + helpers por família |
| `src/pages/CreditsCheckout.tsx` | Fix combo plan_type bug; lógica cross-product nos combos |
| `src/pages/SubscriptionManagement.tsx` | Exibir múltiplas assinaturas |
| `src/hooks/useTransferStorage.ts` | Usar helper do hook atualizado (ajuste menor) |
| `supabase/functions/asaas-upgrade-subscription/index.ts` | Aceitar array de subscriptions para cancelar |

## Ordem
1. `useAsaasSubscription.ts` — múltiplas subs
2. Fix bug `combo_studio_pro` → `combo_pro_select2k`
3. `CreditsCheckout.tsx` — lógica cross-product
4. `SubscriptionManagement.tsx` — múltiplas subs
5. `asaas-upgrade-subscription` — cancelar múltiplas

