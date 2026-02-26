

# Reorganização dos Planos no Banco de Dados — Migração para Asaas Unificado

## Contexto

**Estado atual:**
- Tabela `plans` contém 6 planos do Lunari Studio (Starter, Pro, Pro+Gallery) usando Stripe
- Tabela `subscriptions_asaas` contém assinaturas Transfer e Combos usando Asaas
- Tabela `subscriptions` referencia `plans` para Lunari Studio via Stripe
- `photographer_accounts` gerencia créditos e tipo de conta

**Estado desejado:**
- Todos os planos em Asaas (Stripe eliminado)
- Uma tabela de planos unificada com todos os produtos
- Combos como assinatura única
- Signup Gallery: 500 créditos Select + 0.5GB Transfer grátis (sem validade, sem trial Studio)
- Signup Studio: 30 dias grátis com acesso completo (Select + Transfer + Studio) com limites gratuitos

## Arquitetura dos Planos

```text
┌─────────────────────────────────────────────────────────┐
│                    unified_plans                         │
├──────────────────────┬──────┬────────┬──────────────────┤
│ code                 │ M(¢) │ A(¢)   │ Inclui           │
├──────────────────────┼──────┼────────┼──────────────────┤
│ studio_starter       │ 1490 │ 15198  │ Gestão básica    │
│ studio_pro           │ 3590 │ 36618  │ Gestão completa  │
├──────────────────────┼──────┼────────┼──────────────────┤
│ transfer_5gb         │ 1290 │ 12384  │ 5GB storage      │
│ transfer_20gb        │ 2490 │ 23904  │ 20GB storage     │
│ transfer_50gb        │ 3490 │ 33504  │ 50GB storage     │
│ transfer_100gb       │ 5990 │ 57504  │ 100GB storage    │
├──────────────────────┼──────┼────────┼──────────────────┤
│ combo_pro_select2k   │ 4490 │ 45259  │ Pro+2k créditos  │
│ combo_completo       │ 6490 │ 66198  │ Pro+2k+20GB      │
└──────────────────────┴──────┴────────┴──────────────────┘

Select (avulsos sem assinatura — já existem em gallery_credit_packages):
  2000 = R$19,90 | 5000 = R$39,90 | 10000 = R$69,90 | 15000 = R$94,90
```

## Regras de Negócio

### Cadastro no Gallery
- `handle_new_user_profile()` trigger: concede `photo_credits = 500` e grava `free_transfer_bytes = 536870912` (0.5GB) na `photographer_accounts`
- **Nenhum trial Studio** é criado

### Cadastro no Lunari Studio (outro projeto)
- Cria subscription trial de 30 dias com `plan_type = 'studio_pro_trial'`
- O trial dá acesso completo (Studio + Gallery), mas os limites de Select e Transfer são os gratuitos (500 créditos + 0.5GB)
- Ao expirar o trial, mantém acesso Gallery standalone com os limites gratuitos

### Upgrades e Downgrades — Regras

**Dentro da mesma família (Transfer → Transfer, Studio → Studio):**
- Upgrade: prorata imediato (já implementado)
- Downgrade: agendado para renovação (já implementado)

**Cross-product (individual → combo, combo → individual):**
- Combo é uma assinatura única. Se o usuário já tem Transfer 20GB e quer Combo Completo (que inclui 20GB):
  - Cancela assinatura Transfer existente
  - Cria nova assinatura Combo com prorata do valor restante do Transfer como desconto
- Se tem Studio Pro e quer Combo Pro + Select:
  - Cancela assinatura Studio existente (via Asaas)
  - Cria Combo com prorata do Studio como desconto
- Se tem Transfer + Studio separados e quer Combo Completo:
  - Cancela ambas, soma proratas como desconto

**Combo → Individual:**
- Se tem Combo Completo e quer só Transfer 20GB:
  - Agenda downgrade: na renovação, cancela combo e cria só Transfer
  - Perde acesso Studio e créditos Select mensais

### Coluna `free_transfer_bytes` (nova)
- Todos os usuários recebem 0.5GB gratuito permanente
- Storage limit efetivo = `free_transfer_bytes` + limite do plano Transfer/Combo ativo
- Se não tem plano Transfer, ainda pode usar 0.5GB

## Mudanças no Banco de Dados

### 1. Nova tabela `unified_plans` (substitui `plans`)

```sql
CREATE TABLE public.unified_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  product_family TEXT NOT NULL, -- 'studio', 'transfer', 'select', 'combo'
  monthly_price_cents INT NOT NULL DEFAULT 0,
  yearly_price_cents INT NOT NULL DEFAULT 0,
  features JSONB DEFAULT '[]',
  includes_studio BOOLEAN DEFAULT false,
  includes_select BOOLEAN DEFAULT false,
  includes_transfer BOOLEAN DEFAULT false,
  select_credits_monthly INT DEFAULT 0,
  transfer_storage_bytes BIGINT DEFAULT 0,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

Inserir todos os planos da tabela de preços.

### 2. Alterar `photographer_accounts`
- Adicionar `free_transfer_bytes BIGINT DEFAULT 0`
- Atualizar trigger `handle_new_user_profile()` para conceder 500 `photo_credits` e `free_transfer_bytes = 536870912`

### 3. Alterar `subscriptions_asaas`
- Adicionar `plan_id UUID REFERENCES unified_plans(id)` (opcional, para referência)
- O campo `plan_type` continua sendo a chave primária de identificação (já em uso)

### 4. Marcar tabela `plans` como deprecated
- Setar `is_active = false` em todos os planos antigos
- Não deletar para manter referência histórica em `subscriptions`

## Mudanças no Frontend

### `src/lib/transferPlans.ts`
- Atualizar `TRANSFER_STORAGE_LIMITS` para incluir combos e novos plan types
- Adicionar lógica para somar `free_transfer_bytes` ao calcular limite efetivo
- Adicionar preços dos planos Studio e Combos

### `src/hooks/useTransferStorage.ts`
- Buscar `free_transfer_bytes` de `photographer_accounts`
- Somar ao limite do plano para o cálculo real de storage disponível

### `src/pages/CreditsCheckout.tsx`
- Atualizar `COMBO_PLANS` e `TRANSFER_PLANS` com novos preços
- Adicionar seção "Lunari Studio" com planos Starter e Pro
- Lógica de upgrade cross-product: detectar assinaturas existentes (Transfer E/OU Studio) e calcular prorata combinado

### `src/hooks/useAsaasSubscription.ts`
- A query deve buscar TODAS as assinaturas ativas do usuário (pode ter Studio + Transfer separadas)
- Retornar array de subscriptions em vez de single
- Adicionar helper `getActiveByFamily(family)` para buscar por família

### Edge Functions (upgrades cross-product)
- `asaas-upgrade-subscription`: aceitar lista de subscriptions a cancelar + novo plan_type
- Calcular prorata somado de todas as subscriptions sendo substituídas

## Arquivos a modificar

| Arquivo | Ação |
|---|---|
| Migration SQL | Criar `unified_plans`, alterar `photographer_accounts`, seed planos |
| `src/lib/transferPlans.ts` | Novos plan types, preços, storage limits incluindo combos e studio |
| `src/hooks/useTransferStorage.ts` | Somar `free_transfer_bytes` ao cálculo |
| `src/hooks/useAsaasSubscription.ts` | Suportar múltiplas subscriptions ativas |
| `src/pages/CreditsCheckout.tsx` | Novos preços, seção Studio, upgrade cross-product |
| `supabase/functions/asaas-upgrade-subscription/index.ts` | Cancelar múltiplas subs no upgrade cross-product |
| `supabase/functions/asaas-webhook/index.ts` | Reconhecer novos plan types para provisioning |
| Trigger `handle_new_user_profile()` | Conceder 500 créditos + 0.5GB no signup Gallery |

## Ordem de implementação

1. Migration: criar `unified_plans` + seed + alterar `photographer_accounts` + atualizar trigger
2. Atualizar `transferPlans.ts` com todos os plan types e preços
3. Atualizar `useTransferStorage.ts` com `free_transfer_bytes`
4. Atualizar `useAsaasSubscription.ts` para múltiplas subscriptions
5. Atualizar `CreditsCheckout.tsx` com novos planos e lógica cross-product
6. Atualizar Edge Functions para upgrade cross-product e provisioning de combos

