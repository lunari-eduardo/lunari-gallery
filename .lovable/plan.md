

## Análise: Gaps entre o documento de regras e a implementação atual

Após análise completa do código (edge functions, hooks, páginas, migrações), identifiquei as seguintes lacunas organizadas por prioridade.

---

### GAP 1 — Separação de créditos (subscription vs purchased) [CRÍTICO]

**Atual:** Campo único `photo_credits` em `photographer_accounts`. Todos os créditos são permanentes.

**Regra:** Dois saldos internos — `balance_subscription` (expira no ciclo) e `balance_purchased` (permanente). Consumo na ordem: subscription primeiro, purchased depois.

**Plano:**
- Migração SQL: adicionar `credits_subscription` (default 0) em `photographer_accounts`
- Alterar `get_photo_credit_balance` para retornar `photo_credits + credits_subscription`
- Criar função `consume_credits(_user_id, _amount)` que debita de `credits_subscription` primeiro, depois `photo_credits`
- Substituir debito direto no upload (`photo_credits - N`) pela nova função
- Criar função `renew_subscription_credits(_user_id, _amount)` que zera `credits_subscription` e seta o novo valor (para renovação de ciclo)
- Criar função `expire_subscription_credits(_user_id)` que zera `credits_subscription` (para cancelamento/fim de ciclo)

---

### GAP 2 — Combos concedem créditos mensais [CRÍTICO]

**Atual:** Combos estão "Em breve" (botão com `toast.info`). Não há lógica para conceder créditos de plano.

**Regra:** `combo_pro_select2k` inclui 2.000 créditos/mês. `combo_completo` inclui 2.000 créditos/mês + 20GB storage.

**Plano:**
- Adicionar mapa `PLAN_SUBSCRIPTION_CREDITS` em `transferPlans.ts`:
  - `combo_pro_select2k: 2000`
  - `combo_completo: 2000`
- Na criação de assinatura combo (edge function `asaas-create-subscription`): chamar `renew_subscription_credits` para conceder créditos imediatamente
- No webhook de renovação (`asaas-webhook`): chamar `renew_subscription_credits` a cada ciclo
- No cancelamento efetivo (fim do ciclo): chamar `expire_subscription_credits`

---

### GAP 3 — Downgrade não cobre combos e cross-product [MÉDIO]

**Atual:** `asaas-downgrade-subscription` só aceita `PLAN_ORDER` de transfer (5gb→100gb).

**Regra:** Downgrade deve funcionar para qualquer plano (combo→transfer, combo→studio, etc.), sempre agendado para próximo ciclo.

**Plano:**
- Expandir `PLAN_ORDER` ou remover a validação de ordem fixa
- Usar `ALL_PLAN_PRICES` de `transferPlans.ts` para validar que o novo plano é mais barato
- Garantir que downgrade de armazenamento bloqueia uploads mas não deleta

---

### GAP 4 — Anual → Mensal [MÉDIO]

**Atual:** Não há lógica para downgrade de ciclo (anual→mensal).

**Regra:** Sem reembolso. Alteração entra apenas no próximo ciclo.

**Plano:**
- Permitir `newBillingCycle` no downgrade
- Salvar em `pending_downgrade_cycle`
- No webhook de renovação: aplicar novo ciclo

---

### GAP 5 — UI de créditos não diferencia tipos [BAIXO]

**Atual:** Página Credits.tsx mostra "Seus créditos não vencem" para todos.

**Regra:** Créditos de plano vencem. Na interface podem aparecer somados, mas deve haver indicação.

**Plano:**
- Alterar `usePhotoCredits` para retornar `{ purchased, subscription, total }`
- Na UI, mostrar total e indicar se há parcela de plano (ex: "500 do plano + 200 avulsos")

---

### GAP 6 — Storage: 30 dias acima do limite → galerias expiradas [BAIXO]

**Atual:** `account_over_limit` + `deletion_scheduled_at` existem, mas a regra diz "após 30 dias, galerias entram em modo privado/expiradas", não deletadas.

**Regra:** Nunca deletar. Após 30 dias acima do limite, galerias ficam expiradas/privadas, reativáveis só após regularização.

**Plano:**
- Revisar CRON job (se existir) para não deletar, apenas expirar
- Verificar se `expired_due_to_plan` já cobre esse caso (parece que sim)

---

### Sequência de implementação recomendada

1. **Migração SQL** — Adicionar `credits_subscription`, criar funções `consume_credits`, `renew_subscription_credits`, `expire_subscription_credits`
2. **Edge functions** — Atualizar `asaas-create-subscription`, `asaas-webhook`, `asaas-downgrade-subscription` para usar novas funções
3. **Upload pipeline** — Substituir debito direto por `consume_credits`
4. **Frontend** — Atualizar `usePhotoCredits`, Credits.tsx, CreditsPayment.tsx
5. **Downgrade cross-product** — Expandir validação no edge function

### Seção técnica

Arquivos impactados:
- Nova migração SQL (3 funções + 1 coluna)
- `supabase/functions/asaas-create-subscription/index.ts`
- `supabase/functions/asaas-webhook/index.ts`
- `supabase/functions/asaas-downgrade-subscription/index.ts`
- `src/hooks/usePhotoCredits.ts`
- `src/lib/transferPlans.ts`
- `src/pages/Credits.tsx`
- `src/lib/uploadPipeline.ts` (ou onde o debito de créditos acontece)

