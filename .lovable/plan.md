
# Integracao Asaas -- Assinaturas e Parcelamentos

## Contexto

O sistema atual usa **Mercado Pago** para cobrar creditos Gallery Select via PIX. Para os planos de assinatura (Transfer, combos) e parcelamentos no cartao, vamos integrar a **API Asaas**. O Mercado Pago continua sendo o provedor exclusivo para pagamentos PIX de creditos avulsos.

## Escopo

| Funcionalidade | Provedor |
|---|---|
| Creditos Select (PIX) | Mercado Pago (ja funciona) |
| Assinaturas Transfer (cartao/PIX) | Asaas |
| Combos mensais/anuais (cartao/PIX) | Asaas |
| Parcelamento no cartao | Asaas |

---

## Fase 1 -- Secret e Infraestrutura

### 1.1 Adicionar secret `ASAAS_API_KEY`

Sera necessario adicionar a API Key do Asaas como secret no Supabase. O usuario precisara:
1. Criar conta no Asaas (https://www.asaas.com)
2. Ir em Configuracoes > Integracao > Gerar API Key
3. Usar ambiente **Sandbox** para testes (`$aact_...`) e depois trocar para producao

### 1.2 Tabela `subscriptions_asaas`

Nova tabela para rastrear assinaturas criadas via Asaas:

```text
subscriptions_asaas
  id              UUID PK
  user_id         UUID (FK profiles)
  asaas_customer_id   TEXT
  asaas_subscription_id TEXT
  plan_type       TEXT ('transfer_5gb', 'transfer_20gb', etc.)
  billing_cycle   TEXT ('MONTHLY', 'YEARLY')
  status          TEXT ('ACTIVE', 'INACTIVE', 'OVERDUE', 'CANCELLED')
  value_cents     INTEGER
  next_due_date   DATE
  created_at      TIMESTAMPTZ
  updated_at      TIMESTAMPTZ
  metadata        JSONB
```

RLS: usuarios so veem suas proprias assinaturas.

---

## Fase 2 -- Edge Functions

### 2.1 `asaas-create-customer`

Cria ou reutiliza um customer no Asaas a partir do perfil do fotografo.

- Input: `{ name, cpfCnpj, email }`
- Chama `POST /v3/customers` na API Asaas
- Salva `asaas_customer_id` no `photographer_accounts` (nova coluna)
- Retorna o customer ID

### 2.2 `asaas-create-subscription`

Cria uma assinatura recorrente no Asaas.

- Input: `{ planType, billingCycle, billingType }`
- Valida o plano e preco
- Chama `POST /v3/subscriptions` com:
  - `customer`: ID do customer Asaas
  - `billingType`: `CREDIT_CARD` ou `PIX` ou `UNDEFINED` (gera link)
  - `cycle`: `MONTHLY` ou `YEARLY`
  - `value`: valor em reais
  - `nextDueDate`: proximo dia util
  - `description`: nome do plano
- Se `billingType === 'CREDIT_CARD'`: aceita `creditCard` + `creditCardHolderInfo` tokenizados
- Salva em `subscriptions_asaas`
- Retorna `invoiceUrl` (link de pagamento Asaas) para casos sem cartao tokenizado

### 2.3 `asaas-webhook`

Recebe notificacoes do Asaas para atualizar status.

- Eventos tratados:
  - `PAYMENT_CONFIRMED` / `PAYMENT_RECEIVED`: marca pagamento como pago
  - `PAYMENT_OVERDUE`: marca como atrasado
  - `SUBSCRIPTION_DELETED` / `SUBSCRIPTION_INACTIVATED`: cancela assinatura
- Atualiza `subscriptions_asaas.status`
- Loga em `webhook_logs` (tabela existente)

### 2.4 `asaas-cancel-subscription`

Cancela assinatura existente.

- Chama `DELETE /v3/subscriptions/{id}`
- Atualiza status local

---

## Fase 3 -- Frontend

### 3.1 Hook `useAsaasSubscription`

Novo hook em `src/hooks/useAsaasSubscription.ts`:

- Query para buscar assinatura ativa do usuario em `subscriptions_asaas`
- Mutation `createSubscription` que chama a Edge Function
- Mutation `cancelSubscription`
- Retorna `{ subscription, isLoading, subscribe, cancel }`

### 3.2 Checkout flow na pagina de planos

Arquivo: `src/pages/CreditsCheckout.tsx`

- Botao "Assinar" nos cards Transfer e Combos abre um modal/pagina de checkout
- Fluxo:
  1. Coleta nome, CPF/CNPJ e email (se nao cadastrado)
  2. Escolha: PIX ou Cartao
  3. **PIX**: gera cobranca via Asaas, exibe QR code (reutiliza `PixPaymentDisplay`)
  4. **Cartao**: redireciona para `invoiceUrl` do Asaas (checkout hospedado) -- mais seguro, sem PCI compliance
- Apos pagamento confirmado (webhook ou polling), atualiza o status do plano

### 3.3 Indicador de plano ativo

- Na pill de "Plano ativo" da aba Transfer, mostrar o plano atual em vez de "Sem plano ativo"
- Na pagina `/credits`, bloco Transfer mostra badge do plano ativo

---

## Fase 4 -- Configuracao do webhook

O webhook Asaas precisa de uma URL publica. Sera:

```
https://tlnjspsywycbudhewsfv.supabase.co/functions/v1/asaas-webhook
```

O usuario configura essa URL no painel Asaas em:
Configuracoes > Integracao > Webhooks > Adicionar

---

## Arquivos criados/modificados

| Arquivo | Acao |
|---|---|
| `supabase/functions/asaas-create-customer/index.ts` | Novo |
| `supabase/functions/asaas-create-subscription/index.ts` | Novo |
| `supabase/functions/asaas-webhook/index.ts` | Novo |
| `supabase/functions/asaas-cancel-subscription/index.ts` | Novo |
| `supabase/config.toml` | Adicionar 4 novas functions com `verify_jwt = false` |
| `src/hooks/useAsaasSubscription.ts` | Novo |
| `src/pages/CreditsCheckout.tsx` | Conectar botoes "Assinar" ao fluxo real |
| Migration SQL | Criar tabela `subscriptions_asaas` + coluna `asaas_customer_id` em `photographer_accounts` |

## Prerequisito

Antes de implementar, sera necessario que voce:
1. Crie uma conta no Asaas (https://www.asaas.com)
2. Gere sua API Key (Sandbox para testes)
3. Forneca a chave para armazenarmos como secret seguro no Supabase

Deseja que eu solicite a API Key agora para comecarmos a implementacao?
