

## Implementação: Separação de créditos e ciclo de vida de assinaturas

### Status: ✅ GAPs 1-5 implementados

---

### GAP 1 — Separação de créditos (subscription vs purchased) ✅

- Coluna `credits_subscription` adicionada em `photographer_accounts`
- `get_photo_credit_balance` retorna soma dos dois saldos
- `consume_photo_credits` consome subscription primeiro, purchased depois
- `check_photo_credits` verifica soma dos dois saldos
- `renew_subscription_credits(_user_id, _amount)` criada
- `expire_subscription_credits(_user_id)` criada

### GAP 2 — Combos concedem créditos mensais ✅

- Mapa `PLAN_SUBSCRIPTION_CREDITS` adicionado em `transferPlans.ts` e edge functions
- `asaas-create-subscription`: concede créditos imediatamente ao criar combo
- `asaas-webhook` (SUBSCRIPTION_RENEWED): renova créditos a cada ciclo
- `asaas-webhook` (SUBSCRIPTION_DELETED/INACTIVATED): expira créditos

### GAP 3 — Downgrade cross-product ✅

- `asaas-downgrade-subscription` agora aceita qualquer plano
- Validação por preço mensal (novo deve ser mais barato)
- Suporta combos, transfer, studio

### GAP 4 — Anual → Mensal ✅

- `newBillingCycle` já suportado no downgrade (salvo em `pending_downgrade_cycle`)
- Webhook aplica no próximo ciclo via `applyDowngrade`

### GAP 5 — UI de créditos diferencia tipos ✅

- `usePhotoCredits` retorna `{ photoCredits, creditsPurchased, creditsSubscription }`
- Credits.tsx exibe "X do plano · Y avulsos" quando há créditos de assinatura

### GAP 6 — Storage: nunca deletar [PENDENTE - revisão futura]

- Lógica atual usa `expired_due_to_plan` (correto)
- Revisar CRON job separadamente para garantir que não deleta

---

### Arquivos modificados

- **Migração SQL**: `credits_subscription` + 3 funções + 2 funções atualizadas
- `src/hooks/usePhotoCredits.ts`
- `src/lib/transferPlans.ts`
- `src/pages/Credits.tsx`
- `supabase/functions/asaas-create-subscription/index.ts`
- `supabase/functions/asaas-webhook/index.ts`
- `supabase/functions/asaas-downgrade-subscription/index.ts`
