

# Downgrade de Planos Transfer — Sistema Completo com Modo Excedente

## Escopo

Implementar o fluxo completo de downgrade de planos Transfer, incluindo: agendamento para o proximo ciclo, modo excedente com expiracao automatica de galerias, reativacao inteligente, aviso com checkbox obrigatorio, contador regressivo de exclusao, e job automatico de limpeza apos 30 dias.

## Visao Geral da Arquitetura

```text
┌──────────────────────────────────────────────────────┐
│                  FLUXO DE DOWNGRADE                   │
│                                                      │
│  1. Usuario solicita downgrade no checkout           │
│     ↓                                                │
│  2. Aviso com checkbox se storage > novo limite      │
│     ↓                                                │
│  3. Agendar downgrade (salva no banco)               │
│     ↓                                                │
│  4. No dia da renovacao (webhook asaas):             │
│     - Aplica novo plano                              │
│     - Se storage > limite → MODO EXCEDENTE           │
│       - Expira todas galerias Transfer               │
│       - Define deletion_scheduled_at = now + 30d     │
│     ↓                                                │
│  5. Durante 30 dias: usuario pode excluir/reativar   │
│     ↓                                                │
│  6. Apos 30 dias: CRON job exclui galerias           │
└──────────────────────────────────────────────────────┘
```

## Mudancas

### 1. Nova migration SQL — Infraestrutura de downgrade e modo excedente

**Tabela `subscriptions_asaas`** — Novos campos:
- `pending_downgrade_plan` TEXT — plano agendado para downgrade (null = sem downgrade pendente)
- `pending_downgrade_cycle` TEXT — ciclo do downgrade (MONTHLY/YEARLY)

**Tabela `photographer_accounts`** — Novos campos:
- `account_over_limit` BOOLEAN DEFAULT false
- `over_limit_since` TIMESTAMPTZ
- `deletion_scheduled_at` TIMESTAMPTZ

**Tabela `galerias`** — Novo status:
- Atualizar constraint `galerias_status_check` para incluir `expired_due_to_plan`

### 2. `src/pages/CreditsCheckout.tsx` — Suportar downgrade

Atualmente planos inferiores ficam com `opacity-50 pointer-events-none`. Mudar para:

**2.1** Planos inferiores ficam clicaveis (remover `pointer-events-none`)
**2.2** Botao muda para "Agendar downgrade"
**2.3** Ao clicar, se `storageUsedBytes > novoLimiteBytes`:
  - Abrir dialog com aviso obrigatorio:
    ```
    Seu novo plano permite X GB.
    Voce possui Y GB armazenados.
    As galerias excedentes serao expiradas.
    Se nao forem excluidas manualmente, serao removidas permanentemente em 30 dias.
    ```
  - Checkbox obrigatorio: "Entendo que galerias acima do limite poderao ser excluidas apos 30 dias."
  - Botao "Confirmar downgrade" desabilitado ate marcar checkbox
**2.4** Se `storageUsedBytes <= novoLimiteBytes`: fluxo direto sem aviso especial
**2.5** Chamar nova edge function `asaas-downgrade-subscription` em vez de navegar para pagamento (downgrade nao tem cobranca)

Precisa importar `useTransferStorage` para obter `storageUsedBytes`.

### 3. Nova Edge Function `supabase/functions/asaas-downgrade-subscription/index.ts`

Responsabilidades:
1. Receber: `currentSubscriptionId`, `newPlanType`, `newBillingCycle`
2. Validar que novo plano e inferior ao atual
3. Salvar `pending_downgrade_plan` e `pending_downgrade_cycle` na assinatura atual
4. Retornar confirmacao de agendamento
5. **NAO** cancela nem cria nova assinatura agora — isso acontece na renovacao

### 4. `supabase/functions/asaas-webhook/index.ts` — Aplicar downgrade na renovacao

No evento `PAYMENT_CONFIRMED` ou `SUBSCRIPTION_RENEWED`:
1. Verificar se a assinatura tem `pending_downgrade_plan`
2. Se sim:
   a. Cancelar assinatura atual no Asaas
   b. Criar nova assinatura no Asaas com plano inferior
   c. Marcar assinatura antiga como CANCELLED
   d. Inserir nova assinatura no banco
   e. Limpar `pending_downgrade_plan`
   f. Verificar se `storage_total > novo_limite`:
      - Se SIM: marcar `account_over_limit = true`, `over_limit_since = now()`, `deletion_scheduled_at = now + 30d`
      - Atualizar todas galerias Transfer ativas → `status = 'expired_due_to_plan'`
      - Definir `prazo_selecao` como `deletion_scheduled_at` para controle

### 5. `src/pages/SubscriptionManagement.tsx` — Exibir downgrade pendente

Se `subscription.pending_downgrade_plan` estiver preenchido:
- Exibir badge: "Downgrade agendado para proximo ciclo"
- Exibir: "Seu plano sera alterado para [nome] no proximo ciclo de cobranca."
- Botao "Cancelar downgrade" que limpa o campo no banco

### 6. `src/hooks/useTransferStorage.ts` — Adicionar dados de excedente

Buscar tambem de `photographer_accounts`:
- `account_over_limit`
- `over_limit_since`
- `deletion_scheduled_at`

Retornar: `isOverLimit`, `deletionScheduledAt`, `daysUntilDeletion`

### 7. `src/pages/Dashboard.tsx` — Badge de excedente e contador regressivo

Quando `isOverLimit === true`:
- Exibir badge fixo acima da lista de galerias:
  ```
  ⚠ Excedente de armazenamento
  Exclusao automatica em XX dias
  ```
- Contador regressivo baseado em `deletion_scheduled_at`

### 8. `src/hooks/useSupabaseGalleries.ts` — Suportar novo status

Incluir `expired_due_to_plan` no mapeamento de status para exibicao no Dashboard. Galerias com esse status aparecem na aba Transfer com badge "Expirada (limite excedido)".

### 9. Reativacao inteligente — `DeliverDetail.tsx` ou componente de galeria

Para galerias com `status = 'expired_due_to_plan'`:
- Exibir botao "Reativar galeria"
- Antes de reativar, calcular: `storageActive + gallerySize <= storageLimit`
- Se verdadeiro: alterar status para `enviado`, atualizar storage
- Se falso: mostrar mensagem "Reativar esta galeria ultrapassara o limite do seu plano."

### 10. Upgrade cancela modo excedente

No hook `useAsaasSubscription` (ja existente) e na edge function `asaas-upgrade-subscription`:
- Apos upgrade com sucesso, limpar: `account_over_limit = false`, `deletion_scheduled_at = null`, `over_limit_since = null`
- Reativar galerias `expired_due_to_plan` que cabem no novo limite

### 11. CRON Job — Exclusao automatica apos 30 dias

Nova edge function `transfer-cleanup-expired` executada via `pg_cron` diariamente:
1. Selecionar contas com `deletion_scheduled_at <= now()` e `account_over_limit = true`
2. Para cada conta:
   a. Selecionar galerias com `status = 'expired_due_to_plan'`, ordenar por `created_at ASC` (mais antigas primeiro)
   b. Para cada galeria que excede o limite:
      - Chamar logica de exclusao (mesma da `delete-photos`)
      - Remover galeria do banco
   c. Atualizar `account_over_limit = false`, limpar `deletion_scheduled_at`

### 12. `supabase/config.toml` — Registrar novas funcoes

Adicionar:
```toml
[functions.asaas-downgrade-subscription]
verify_jwt = false

[functions.transfer-cleanup-expired]
verify_jwt = false
```

## Arquivos

| Arquivo | Acao |
|---|---|
| Nova migration SQL | Campos de downgrade, excedente, novo status |
| `src/pages/CreditsCheckout.tsx` | Downgrade clicavel, dialog com checkbox, chamar edge function |
| `supabase/functions/asaas-downgrade-subscription/index.ts` | Nova — agendar downgrade |
| `supabase/functions/asaas-webhook/index.ts` | Aplicar downgrade na renovacao, modo excedente |
| `supabase/functions/asaas-upgrade-subscription/index.ts` | Limpar modo excedente no upgrade |
| `supabase/functions/transfer-cleanup-expired/index.ts` | Nova — CRON de exclusao apos 30 dias |
| `src/pages/SubscriptionManagement.tsx` | Exibir/cancelar downgrade pendente |
| `src/hooks/useTransferStorage.ts` | Retornar dados de excedente |
| `src/hooks/useAsaasSubscription.ts` | Nova mutation downgradeSubscription |
| `src/pages/Dashboard.tsx` | Badge de excedente com contador |
| `src/hooks/useSupabaseGalleries.ts` | Suportar status expired_due_to_plan |
| `supabase/config.toml` | Registrar novas funcoes |

## Detalhes Tecnicos

**Calculo de excedente:**
```text
storage_total = SUM(original_file_size) de todas galerias Transfer
storage_limit = limite do novo plano
is_over = storage_total > storage_limit

Se is_over:
  account_over_limit = true
  deletion_scheduled_at = now() + 30 dias
  Todas galerias Transfer ativas → expired_due_to_plan
```

**Reativacao:**
```text
storage_active = SUM(original_file_size) de galerias com status != expired_due_to_plan
gallery_size = SUM(original_file_size) da galeria a reativar
pode_reativar = (storage_active + gallery_size) <= storage_limit
```

**Prioridade de implementacao sugerida (pode ser dividido em etapas):**
1. Migration + Edge function de agendamento + UX no checkout (itens 1-3)
2. Webhook de aplicacao + SubscriptionManagement (itens 4-5)
3. Modo excedente no frontend + reativacao (itens 6-9)
4. Upgrade cancela excedente (item 10)
5. CRON job de limpeza (item 11)

