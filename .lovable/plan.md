

# Documento Técnico de Handoff — Gallery → Gestão

Este documento detalha todas as implementações realizadas no projeto Gallery que impactam o banco de dados compartilhado e que o projeto Gestão precisa conhecer, respeitar ou replicar.

---

## 1. SCHEMA: Nova coluna `credits_subscription`

**Tabela:** `photographer_accounts`
**Coluna adicionada:** `credits_subscription INTEGER NOT NULL DEFAULT 0`

Agora existem **dois saldos de créditos Select**:
- `photo_credits` → créditos avulsos comprados (permanentes, nunca expiram)
- `credits_subscription` → créditos do plano combo (expiram no fim do ciclo)

**Regra:** O frontend pode exibir a soma, mas internamente são separados.

---

## 2. FUNÇÕES SQL ALTERADAS/CRIADAS

### 2.1 `get_photo_credit_balance(_user_id UUID) → INTEGER`
Retorna `photo_credits + credits_subscription`. Qualquer consulta de saldo deve usar esta função ou somar ambas colunas.

### 2.2 `check_photo_credits(_user_id UUID, _photo_count INTEGER) → BOOLEAN`
Verifica se `(photo_credits + credits_subscription) >= _photo_count`.

### 2.3 `consume_photo_credits(_user_id UUID, _gallery_id UUID, _photo_count INTEGER) → BOOLEAN`
**Ordem de consumo obrigatória:**
1. Debita de `credits_subscription` primeiro (até zerar)
2. Debita o restante de `photo_credits`

Usa `FOR UPDATE` para lock de linha. Atualiza `credits_consumed_total`.

### 2.4 `renew_subscription_credits(_user_id UUID, _amount INTEGER) → VOID` [NOVA]
- Seta `credits_subscription = _amount` (não soma, substitui)
- Registra no `credit_ledger` com `operation_type = 'subscription_renewal'`
- **Quando chamar:** ao criar assinatura de combo OU a cada renovação de ciclo

### 2.5 `expire_subscription_credits(_user_id UUID) → VOID` [NOVA]
- Seta `credits_subscription = 0`
- Registra no `credit_ledger` com `operation_type = 'subscription_expiry'` e `amount = -N`
- **Quando chamar:** ao cancelar assinatura de combo OU ao fim do ciclo sem renovação

### 2.6 `purchase_credits` [INALTERADA]
Continua adicionando apenas em `photo_credits` (créditos avulsos). Não toca `credits_subscription`.

---

## 3. EDGE FUNCTIONS — Comportamento Atual

### 3.1 `asaas-create-customer`
- Recebe: `{ name, cpfCnpj, email, forceRecreate? }`
- **Auto-healing:** Se `asaas_customer_id` já existe no banco, valida chamando `GET /v3/customers/{id}` no Asaas. Se não encontrar (troca de ambiente sandbox↔prod), limpa o ID e recria.
- Salva `asaas_customer_id` em `photographer_accounts`
- Retorna `{ customerId, requestId }`

### 3.2 `asaas-create-subscription`
- Recebe: `{ planType, billingCycle, creditCard, creditCardHolderInfo, remoteIp? }`
- Planos suportados: `transfer_5gb`, `transfer_20gb`, `transfer_50gb`, `transfer_100gb`, `combo_pro_select2k`, `combo_completo`
- Cria assinatura recorrente no Asaas via transparent checkout (cartão)
- Salva em `subscriptions_asaas` com `metadata.creditCardToken`
- **Se combo:** chama `renew_subscription_credits(_user_id, 2000)` imediatamente

### 3.3 `asaas-create-payment`
- Recebe: `{ productType, planType?, packageId?, credits?, priceCents?, installmentCount?, creditCard, creditCardHolderInfo, remoteIp? }`
- **productType = "select":** pagamento avulso de créditos. Chama `purchase_credits` RPC se aprovado. Credita em `photo_credits`.
- **productType = "subscription_yearly":** pagamento único anual. Cria registro em `subscriptions_asaas` com `billing_cycle = "YEARLY"`.
- **Auto-healing:** Se Asaas retorna erro de customer inválido, limpa `asaas_customer_id`, recria customer e retenta 1x.
- Retorna `requestId` em todas as respostas para rastreio.

### 3.4 `asaas-upgrade-subscription`
- Recebe: `{ currentSubscriptionId? | subscriptionIdsToCancel[], newPlanType, billingCycle, creditCard, creditCardHolderInfo, remoteIp? }`
- **Cross-product:** aceita array de assinaturas para cancelar (ex: Studio + Transfer → Combo)
- **Cálculo prorata:**
  ```
  Para cada assinatura cancelada:
    unusedValueCents = currentPriceCents × (daysRemaining / totalCycleDays)
  
  totalProrata = soma de todos unusedValueCents
  netCharge = max(0, newPriceCents - totalProrata)
  ```
- Cancela assinaturas antigas no Asaas (DELETE) e marca CANCELLED no banco
- Cobra `netCharge` como pagamento avulso
- Cria nova assinatura recorrente
- **Mensal→Anual:** reinicia ciclo (nextDueDate = now + 1 ano)
- **Mensal→Mensal:** mantém nextDueDate da assinatura mais recente
- Limpa flags `account_over_limit`, `over_limit_since`, `deletion_scheduled_at`
- Reativa galerias com status `expired_due_to_plan` se novo plano tem storage

### 3.5 `asaas-downgrade-subscription`
- Recebe: `{ subscriptionId, newPlanType, newBillingCycle? }`
- **Validação:** novo plano deve ter `monthlyPrice` menor que o atual
- **Não aplica imediatamente.** Salva em:
  - `pending_downgrade_plan = newPlanType`
  - `pending_downgrade_cycle = newBillingCycle || currentCycle`
- A aplicação real acontece no webhook (próximo ciclo)
- Suporta qualquer combinação cross-product (combo→transfer, combo→studio, etc.)

### 3.6 `asaas-cancel-subscription`
- Recebe: `{ subscriptionId, action? }`
- **action = "reactivate":** verifica se assinatura ainda existe no Asaas e marca ACTIVE localmente
- **Sem action:** cancela no Asaas (DELETE) e marca CANCELLED localmente
- Preserva `next_due_date` para tracking de período ativo restante

### 3.7 `asaas-webhook`
- Eventos processados:
  - **PAYMENT_CONFIRMED / PAYMENT_RECEIVED:** Marca assinatura ACTIVE. Se tem `pending_downgrade_plan`, aplica downgrade.
  - **PAYMENT_OVERDUE:** Marca assinatura OVERDUE.
  - **SUBSCRIPTION_DELETED / SUBSCRIPTION_INACTIVATED:** Marca CANCELLED. **Se plano tinha créditos de combo:** chama `expire_subscription_credits`.
  - **SUBSCRIPTION_RENEWED:** Marca ACTIVE. **Se plano tem créditos:** chama `renew_subscription_credits`. Se tem `pending_downgrade_plan`, aplica downgrade.

- **Função `applyDowngrade` (interna ao webhook):**
  1. Cancela assinatura antiga no Asaas
  2. Marca antiga como CANCELLED, limpa pending
  3. Recria assinatura nova no Asaas com novo plano/ciclo
  4. Insere nova assinatura no banco
  5. Se novo storage < uso atual → ativa modo over-limit:
     - `account_over_limit = true`
     - `over_limit_since = now()`
     - `deletion_scheduled_at = now() + 30 dias`
     - Todas galerias Transfer ativas → `status = 'expired_due_to_plan'`

---

## 4. TABELA `subscriptions_asaas` — Colunas Relevantes

| Coluna | Uso |
|--------|-----|
| `plan_type` | Código do plano (ex: `combo_completo`, `transfer_20gb`) |
| `billing_cycle` | `MONTHLY` ou `YEARLY` |
| `status` | `ACTIVE`, `PENDING`, `OVERDUE`, `CANCELLED` |
| `value_cents` | Valor em centavos |
| `next_due_date` | Próximo vencimento |
| `pending_downgrade_plan` | Plano agendado para downgrade (NULL se não há) |
| `pending_downgrade_cycle` | Ciclo agendado para downgrade |
| `metadata` | JSONB com `creditCardToken`, `creditCardBrand`, `upgraded_from`, etc. |

---

## 5. MAPA DE PLANOS E PREÇOS (centavos)

```
studio_starter:      monthly=1490   yearly=15198
studio_pro:          monthly=3590   yearly=36618
transfer_5gb:        monthly=1290   yearly=12384
transfer_20gb:       monthly=2490   yearly=23904
transfer_50gb:       monthly=3490   yearly=33504
transfer_100gb:      monthly=5990   yearly=57504
combo_pro_select2k:  monthly=4490   yearly=45259
combo_completo:      monthly=6490   yearly=66198
```

**Créditos por plano (por ciclo):**
```
combo_pro_select2k: 2000 créditos
combo_completo:     2000 créditos
Demais planos:      0
```

**Storage por plano:**
```
transfer_5gb:   5 GB
transfer_20gb:  20 GB
transfer_50gb:  50 GB
transfer_100gb: 100 GB
combo_completo: 20 GB
Demais:         0 GB (usam free_transfer_bytes = 0.5 GB)
```

---

## 6. O QUE O GESTÃO PRECISA FAZER / RESPEITAR

### 6.1 Leitura de saldo de créditos
- **Sempre somar** `photo_credits + credits_subscription` para exibir saldo total
- OU usar `get_photo_credit_balance(_user_id)`
- Se quiser diferenciar na UI: ler ambas colunas separadamente

### 6.2 Consumo de créditos
- **Usar** `consume_photo_credits(_user_id, _gallery_id, _photo_count)` que já respeita a ordem (subscription primeiro)
- **Nunca** debitar diretamente com `UPDATE photo_credits = photo_credits - N`

### 6.3 Compra de créditos avulsos
- Continuar usando `purchase_credits()` que credita apenas em `photo_credits`

### 6.4 Admin: concessão manual de créditos
- Se admin concede créditos avulsos → adicionar em `photo_credits`
- Se admin quer ajustar créditos de plano → usar `credits_subscription` diretamente

### 6.5 Painel admin de assinaturas
- Respeitar as colunas `pending_downgrade_plan` e `pending_downgrade_cycle`
- Exibir se há downgrade agendado
- Não limpar esses campos manualmente (webhook aplica automaticamente)

### 6.6 Webhook
- O webhook `asaas-webhook` é **único e compartilhado** (URL do Supabase)
- Não criar webhook duplicado no Gestão
- Se precisar de lógica adicional no Gestão para eventos Asaas, adicionar no mesmo webhook

### 6.7 Storage / Over-limit
- Respeitar flags: `account_over_limit`, `over_limit_since`, `deletion_scheduled_at`
- Status `expired_due_to_plan` em galerias = bloqueadas por excesso de storage
- **Nunca deletar arquivos.** Apenas bloquear upload e expirar galerias.

### 6.8 Variável de ambiente
- `ASAAS_ENV` deve ser idêntica em ambos os projetos (atualmente `sandbox`)
- `ASAAS_API_KEY` deve ser a mesma chave do mesmo ambiente

---

## 7. FLUXOS QUE O GESTÃO PODE PRECISAR IMPLEMENTAR

1. **Exibir créditos separados** no painel admin: `X do plano · Y avulsos`
2. **Checkout de combos** (se Gestão tiver interface de assinatura): chamar `asaas-create-subscription` com `planType = "combo_pro_select2k"` ou `"combo_completo"`
3. **Upgrade cross-product** no admin: chamar `asaas-upgrade-subscription` com `subscriptionIdsToCancel[]`
4. **Monitorar downgrades agendados**: exibir `pending_downgrade_plan` no card de assinatura

---

## 8. CREDIT_LEDGER — Novos operation_types

O Gestão deve reconhecer estes novos tipos no `credit_ledger`:
- `subscription_renewal` — créditos do plano renovados (amount positivo)
- `subscription_expiry` — créditos do plano expirados (amount negativo)
- `purchase` — compra avulsa (já existia)

