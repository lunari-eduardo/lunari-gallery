

# Correcao de Navegacao + Pagina de Gerenciamento de Assinatura

## Problemas Identificados

1. **Botao "Voltar" no checkout/pay**: Navega para `/credits/checkout` sem o parametro `?tab=transfer`, caindo no Select (default). Precisa preservar o contexto do produto.
2. **Botao "Voltar" no checkout**: Navega para `/credits` em vez de voltar para `/credits/checkout?tab=transfer` quando vindo do Transfer.
3. **Falta pagina de gerenciamento de assinatura**: Nao existe forma de ver historico de transacoes de assinatura, cancelar ou fazer downgrade.

## Mudancas

### 1. Corrigir navegacao "Voltar" no `CreditsPayment.tsx`

O `location.state` ja contem `type: 'subscription'` ou `type: 'select'`. Usar isso para construir a URL de retorno:

- Se `type === 'select'`: voltar para `/credits/checkout?tab=select`
- Se `type === 'subscription'`: voltar para `/credits/checkout?tab=transfer`

Linha 66 atual: `navigate('/credits/checkout')` → `navigate('/credits/checkout?tab=' + (pkg?.type === 'subscription' ? 'transfer' : 'select'))`

### 2. Adicionar botao "Gerenciar assinatura" no `Credits.tsx`

No bloco do Gallery Transfer, quando `hasTransferPlan === true`, adicionar abaixo do botao principal:

```text
[Ver planos de armazenamento]
Gerenciar assinatura    ← texto-link na cor primary
```

Navega para `/credits/subscription`.

### 3. Nova pagina `SubscriptionManagement.tsx`

Pagina dedicada ao gerenciamento da assinatura ativa:

**Conteudo:**
- Header com botao voltar para `/credits`
- Card com dados da assinatura ativa (plano, status, valor, proxima cobranca)
- Historico de pagamentos da assinatura (via `subscriptions_asaas` + metadata)
- Botao "Cancelar assinatura" com dialog de confirmacao (usa `cancelSubscription` do hook existente)
- Link "Fazer upgrade/downgrade" que redireciona para `/credits/checkout?tab=transfer`

**Dados necessarios:**
- `useAsaasSubscription()` ja retorna `subscription` com status, valor, datas
- Cancelamento ja implementado no hook (`cancelSubscriptionMutation`)

### 4. Registrar rota no `App.tsx`

Nova rota: `/credits/subscription` → `SubscriptionManagement`

## Arquivos

| Arquivo | Acao |
|---|---|
| `src/pages/CreditsPayment.tsx` | Corrigir URL do botao "Voltar" (linha 66) |
| `src/pages/Credits.tsx` | Adicionar link "Gerenciar assinatura" no bloco Transfer |
| `src/pages/SubscriptionManagement.tsx` | **Novo** - pagina de gerenciamento |
| `src/App.tsx` | Registrar rota `/credits/subscription` |

