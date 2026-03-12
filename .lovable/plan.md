

# Plano Ajustado: Sistema "Indique e Ganhe"

Incorporando todos os 6 ajustes solicitados ao plano original.

---

## Fase 1: Migration — Tabela `referrals`, campos auxiliares, RPCs

### Tabela e campos

```sql
CREATE TABLE public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referral_code TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  select_bonus_granted BOOLEAN DEFAULT false,
  transfer_bonus_active BOOLEAN DEFAULT false,
  transfer_bonus_bytes BIGINT DEFAULT 0,
  transfer_plan_storage_bytes BIGINT DEFAULT 0,  -- ✅ Ajuste #5: salvar plano base
  UNIQUE(referred_user_id)
);

-- profiles: referral_code + referred_by
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES auth.users(id);

-- photographer_accounts: storage_bonus_bytes
ALTER TABLE public.photographer_accounts
  ADD COLUMN IF NOT EXISTS storage_bonus_bytes BIGINT DEFAULT 0;

-- credit_ledger: adicionar referral_bonus ao constraint
ALTER TABLE credit_ledger DROP CONSTRAINT credit_ledger_operation_type_check;
ALTER TABLE credit_ledger ADD CONSTRAINT credit_ledger_operation_type_check 
  CHECK (operation_type = ANY(ARRAY[
    'purchase','bonus','upload','refund','adjustment',
    'subscription_renewal','subscription_expiry','referral_bonus'
  ]));
```

### RPCs (SECURITY DEFINER)

**`ensure_referral_code()`** — gera código único 8 chars, idempotente.

**`register_referral(_referral_code)`** — valida (não self-referral, não já indicado), insere em `referrals` e seta `referred_by` em `profiles`.
- ✅ Ajuste #3: Verifica se profile existe (`SELECT user_id FROM profiles WHERE user_id = auth.uid()`). Se não existir, retorna FALSE.

**`grant_referral_select_bonus(_referred_user_id)`** — ✅ Ajuste #4: Usa apenas `select_bonus_granted = false` como controle (não depende de count de compras). Concede +1000 créditos a ambos, marca `select_bonus_granted = true`.

**`activate_referral_transfer_bonus(_referred_user_id, _plan_storage_bytes)`** — ✅ Ajuste #1: Adiciona guard no início:
```sql
IF v_ref.transfer_bonus_active = true THEN
  RETURN FALSE;  -- já ativo, evita duplicação por webhook repetido
END IF;
```
Calcula 10%, soma `storage_bonus_bytes`, salva `transfer_bonus_bytes` e `transfer_plan_storage_bytes`.

**`recalculate_referral_transfer_bonus(_referred_user_id, _new_plan_storage_bytes)`** — ✅ Ajuste #2 (NOVA): Trata upgrade/downgrade:
1. Busca referral com `transfer_bonus_active = true`
2. Calcula novo bônus (10% do novo plano)
3. Calcula diferença (`novo - antigo`)
4. Atualiza `storage_bonus_bytes` do referrer e referred (soma a diferença)
5. Atualiza `transfer_bonus_bytes` e `transfer_plan_storage_bytes`

**`deactivate_referral_transfer_bonus(_referred_user_id)`** — Remove bônus de ambos.

### RLS

- `referrals`: SELECT para `referrer_user_id = auth.uid() OR referred_user_id = auth.uid()`. No direct INSERT (via SECURITY DEFINER apenas).

---

## Fase 2: Webhooks

### `mercadopago-webhook/index.ts`
Após bloco de `credit_purchases` com status `approved`: chamar `grant_referral_select_bonus(purchase.user_id)`. A RPC já controla duplicação via `select_bonus_granted`.

### `mercadopago-credits-payment/index.ts`
Após cartão aprovado imediatamente: mesma chamada `grant_referral_select_bonus`.

### `asaas-webhook/index.ts`
- **PAYMENT_CONFIRMED/RECEIVED** (subscription payment): após ativar assinatura, buscar `STORAGE_LIMITS[plan_type]` e chamar `activate_referral_transfer_bonus(sub.user_id, storage_bytes)`.
- **SUBSCRIPTION_DELETED/INACTIVATED**: chamar `deactivate_referral_transfer_bonus(sub.user_id)`.
- ✅ Ajuste #2: No `asaas-upgrade-subscription` e `asaas-downgrade-subscription`: após mudança de plano, chamar `recalculate_referral_transfer_bonus(user_id, new_storage_bytes)`.

---

## Fase 3: Signup com código de indicação

### `SignupForm.tsx`
- Ler `?ref=` da URL via `useSearchParams`
- Exibir badge visual "Indicado por código: XXXX"
- Passar `referral_code` via `signUpWithEmail`

### `useAuth.ts` → `signUpWithEmail`
- Aceitar parâmetro opcional `referralCode`
- Incluir em `options.data: { referral_code: referralCode }`

### ✅ Ajuste #3: Registrar indicação após profile existir
- No `AuthContext` ou hook de inicialização: após login, verificar `user.user_metadata.referral_code`
- Chamar `supabase.rpc('register_referral', { _referral_code: code })` apenas quando profile já existe
- Limpar metadata após registro bem-sucedido

---

## Fase 4: Frontend — Página "Indique e Ganhe"

### `src/pages/Referrals.tsx`
- ✅ Ajuste #6: Dashboard com estatísticas no topo:
  - **Indicados**: total count
  - **Créditos ganhos**: soma dos bônus Select concedidos (count * 1000)
  - **Armazenamento bônus**: soma `storage_bonus_bytes` do `photographer_accounts`
- Link copiável de indicação
- Lista de indicados: nome parcial, data, status Select (concedido/pendente), status Transfer (ativo/cancelado)

### `src/hooks/useReferrals.ts`
- Busca `referrals` onde `referrer_user_id = user.id`
- Join com `profiles` para nomes dos indicados
- Busca `storage_bonus_bytes` de `photographer_accounts`
- Chama `ensure_referral_code()` para garantir código

### `src/App.tsx`
- Rota protegida `/referrals`

### `src/components/Layout.tsx`
- Adicionar link "Indique e Ganhe" no menu (ícone `Gift` do lucide)

---

## Fase 5: Storage — Incluir bônus no cálculo

### `src/hooks/useTransferStorage.ts`
- No query `transfer-account-data`: adicionar `storage_bonus_bytes` ao select
- Calcular: `storageLimitBytes = planStorageBytes + freeBytes + storageBonusBytes`
- Quando `storage_used > storage_total` (após remoção de bônus): bloquear uploads, manter arquivos, exibir aviso

---

## Arquivos a criar/editar

| Arquivo | Ação |
|---|---|
| Migration SQL | Criar tabela, campos, 6 RPCs |
| `supabase/functions/mercadopago-webhook/index.ts` | +grant_referral_select_bonus |
| `supabase/functions/mercadopago-credits-payment/index.ts` | +grant_referral_select_bonus |
| `supabase/functions/asaas-webhook/index.ts` | +activate/deactivate/recalculate transfer bonus |
| `supabase/functions/asaas-upgrade-subscription/index.ts` | +recalculate transfer bonus |
| `supabase/functions/asaas-downgrade-subscription/index.ts` | +recalculate transfer bonus |
| `src/hooks/useAuth.ts` | Passar referral_code no signup |
| `src/components/auth/SignupForm.tsx` | Ler ?ref=, badge, passar code |
| `src/contexts/AuthContext.tsx` | register_referral após login |
| `src/hooks/useTransferStorage.ts` | +storage_bonus_bytes |
| `src/hooks/useReferrals.ts` | Novo hook |
| `src/pages/Referrals.tsx` | Nova página |
| `src/App.tsx` | Rota /referrals |
| `src/components/Layout.tsx` | Link no menu |

