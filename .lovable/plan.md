

## Plano: Migrar preços para `unified_plans` + Suporte a cupons

### Escopo

Três entregáveis:
1. **Hook `useUnifiedPlans`** — lê `unified_plans` do Supabase, substitui todas as constantes hardcoded
2. **Refatorar `transferPlans.ts`** — manter funções utilitárias mas alimentar dados do banco
3. **Hook `useCouponValidation`** + campo de cupom no checkout

### Dados confirmados no banco

- `unified_plans`: 8 planos ativos, RLS `SELECT` para `public` (anon OK). Transfer_5gb já tem `monthly_price_cents: 1090` (diferente do hardcoded 1290) — confirmando que o admin já editou e o frontend não reflete.
- `coupons`: tabela existente com `code`, `discount_type`, `discount_value`, `applies_to`, `plan_codes[]`, `max_uses`, `current_uses`, `valid_from`, `valid_until`, `is_active`. RLS SELECT para authenticated (active only).
- `gallery_credit_packages`: já é lida dinamicamente via `useCreditPackages` — OK.

### 1. Criar `src/hooks/useUnifiedPlans.ts`

```typescript
// Query unified_plans com useQuery, staleTime 5min
// Exporta:
//   plans: UnifiedPlan[]
//   getPlanPrice(code, 'monthly'|'yearly'): number
//   getPlanName(code): string
//   getPlanByCode(code): UnifiedPlan | undefined
//   allPlanPrices: Record<string, {monthly, yearly}>  // backward-compat
//   isLoading: boolean
```

Fallback: se query falhar, usa valores hardcoded atuais de `transferPlans.ts` (renomeados para `FALLBACK_*`).

### 2. Refatorar `src/lib/transferPlans.ts`

- Renomear constantes exportadas para `FALLBACK_PLAN_PRICES`, `FALLBACK_PLAN_NAMES`, etc.
- Manter todas as funções utilitárias (`formatStorageSize`, `getPlanHierarchyLevel`, `isSubActiveForPlan`, `getHighestActivePlan`) — estas não dependem de preços.
- Funções que dependem de preços (`getPlanDisplayName`) ganham overload que aceita dados dinâmicos.
- `TRANSFER_STORAGE_LIMITS`, `PLAN_FAMILIES`, `PLAN_INCLUDES` passam a ser computados do banco quando disponíveis.

### 3. Atualizar consumidores (4 arquivos)

| Arquivo | Mudança |
|---|---|
| `CreditsCheckout.tsx` | Usar `useUnifiedPlans()` em vez de constantes. `TRANSFER_PLANS` e `COMBO_PLANS` computados dos dados do banco. Loading skeleton enquanto carrega. |
| `Credits.tsx` | Preços dos cards combo (`R$ 44,90`, `R$ 64,90`) vêm do hook em vez de hardcoded. |
| `SubscriptionManagement.tsx` | `ALL_PLAN_PRICES[plan_type]` → `getPlanPrice(plan_type, cycle)` do hook. |
| `useAsaasSubscription.ts` | `PLAN_FAMILIES`, `PLAN_INCLUDES` — manter import do transferPlans (dados estáticos de hierarchy/family). |

### 4. Criar `src/hooks/useCouponValidation.ts`

```typescript
// validateCoupon(code, planCode?, productFamily?): Promise<CouponResult>
// Faz query na tabela coupons verificando:
//   is_active, valid_from <= now, valid_until >= now (ou null)
//   max_uses > current_uses (ou null)
//   applies_to matches ('all' | 'plan' | 'product_family')
//   plan_codes contains planCode (se applies_to === 'plan')
// Retorna: { valid, discountType, discountValue, calculateDiscount(cents) }
```

### 5. Campo de cupom no checkout (`CreditsCheckout.tsx`)

- Input "Cupom" antes do botão de assinar (apenas para assinaturas, não avulsos)
- Ao digitar e clicar "Aplicar": chama `validateCoupon(code, planType, family)`
- Se válido: mostra preço original riscado + preço com desconto
- Envia `couponCode` no state para `CreditsPayment.tsx` → body da Edge Function

### Sem alterações

- Edge Functions (já leem do banco)
- Tabelas/migrações (tabelas já existem)
- Painel admin (gerenciado no Gestão)

### Riscos

- Nenhum — RLS já permite leitura pública de `unified_plans` e autenticada de `coupons`
- Fallback hardcoded garante que o app funciona mesmo se a query falhar

