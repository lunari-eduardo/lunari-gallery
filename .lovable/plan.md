
# Checkout Transparente Asaas para Assinaturas (somente cartao de credito)

## Problema Atual

O fluxo atual redireciona o usuario para o checkout externo do Asaas (`invoiceUrl`). O requisito e que **todo o pagamento aconteca dentro da plataforma** (checkout transparente), e que **assinaturas aceitem apenas cartao de credito** (sem PIX).

## Logica de Provedores

| Produto | Provedor | Metodo de pagamento |
|---|---|---|
| Creditos Select (avulso) | Mercado Pago | PIX |
| Assinaturas Transfer/Combos | Asaas | Cartao de credito (transparente) |

## O que precisa mudar

### 1. Nova Edge Function: `asaas-pay-subscription`

Em vez de depender do `invoiceUrl`, criaremos uma Edge Function que recebe os dados do cartao e realiza o pagamento diretamente via API Asaas.

**Fluxo:**
1. Frontend coleta dados do cartao (numero, nome, validade, CVV) + dados do titular (CPF, CEP, endereco)
2. Edge Function cria a assinatura com `billingType: "CREDIT_CARD"` e envia os objetos `creditCard` + `creditCardHolderInfo` junto ao payload
3. Se a transacao for autorizada, o Asaas retorna `HTTP 200` e a assinatura ja fica ativa
4. O `creditCardToken` retornado e salvo para renovacoes futuras automaticas

**Payload da API Asaas:**

```text
POST /v3/subscriptions
{
  customer: "cus_XXXXX",
  billingType: "CREDIT_CARD",
  cycle: "MONTHLY" | "YEARLY",
  value: 24.90,
  nextDueDate: "2026-02-25",
  creditCard: {
    holderName: "NOME NO CARTAO",
    number: "5162306219378829",
    expiryMonth: "05",
    expiryYear: "2028",
    ccv: "318"
  },
  creditCardHolderInfo: {
    name: "Nome Completo",
    email: "email@email.com",
    cpfCnpj: "24971563792",
    postalCode: "89223005",
    addressNumber: "277",
    phone: "47998781877"
  },
  remoteIp: "IP do cliente"
}
```

### 2. Refatorar `AsaasCheckoutModal.tsx`

Substituir o modal atual (que coleta apenas nome/CPF e redireciona) por um checkout transparente completo com formulario de cartao:

**Campos do formulario:**
- Nome completo
- CPF/CNPJ
- Numero do cartao
- Nome no cartao
- Validade (mes/ano)
- CVV
- CEP
- Numero do endereco
- Telefone

**Fluxo visual:**
1. Step 1: Dados pessoais (nome, CPF, email, CEP, endereco, telefone)
2. Step 2: Dados do cartao (numero, nome, validade, CVV)
3. Processar pagamento (spinner)
4. Sucesso ou erro exibido inline no modal

**Sem opcao de PIX** -- o botao sera "Assinar com Cartao" diretamente.

### 3. Atualizar `asaas-create-subscription` Edge Function

Modificar para aceitar os dados do cartao diretamente no payload e enviar para a API Asaas com `billingType: "CREDIT_CARD"`:

- Recebe `creditCard`, `creditCardHolderInfo` e `remoteIp` do frontend
- Envia tudo junto na criacao da assinatura
- Salva `creditCardToken` retornado no `metadata` da `subscriptions_asaas` para renovacoes
- Remove a busca de `invoiceUrl` (nao necessaria no checkout transparente)

### 4. Atualizar Hook `useAsaasSubscription`

Adicionar tipagem para os novos campos de cartao no `CreateSubscriptionParams`:

```text
interface CreateSubscriptionParams {
  planType: string;
  billingCycle: 'MONTHLY' | 'YEARLY';
  creditCard: {
    holderName: string;
    number: string;
    expiryMonth: string;
    expiryYear: string;
    ccv: string;
  };
  creditCardHolderInfo: {
    name: string;
    email: string;
    cpfCnpj: string;
    postalCode: string;
    addressNumber: string;
    phone: string;
  };
  remoteIp: string;
}
```

## Seguranca

- Os dados do cartao trafegam via HTTPS (Supabase Edge Functions) e nunca sao armazenados no banco -- apenas o `creditCardToken` retornado pelo Asaas
- O Asaas e PCI DSS compliant e processa os dados de forma segura
- O `remoteIp` do cliente e capturado no frontend e enviado junto (requisito da API)

## Arquivos Modificados

| Arquivo | Acao |
|---|---|
| `supabase/functions/asaas-create-subscription/index.ts` | Refatorar para aceitar dados do cartao e enviar checkout transparente |
| `src/hooks/useAsaasSubscription.ts` | Atualizar tipagem com campos de cartao |
| `src/components/credits/AsaasCheckoutModal.tsx` | Reescrever com formulario de cartao completo (checkout transparente) |

## Requisitos para funcionar

1. **ASAAS_API_KEY** ja configurada (feito)
2. **Webhook** configurado no painel Asaas apontando para a URL do Edge Function (necessario para receber confirmacoes de renovacao)
3. **Tokenizacao** habilitada na conta Asaas (em Sandbox ja vem habilitada; em producao, solicitar ao gerente de contas)
