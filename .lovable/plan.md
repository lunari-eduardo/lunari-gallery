
# Checkout Unificado em Pagina Dedicada

## Objetivo

Substituir o modal de checkout Asaas e unificar com a pagina de pagamento Select (`/credits/checkout/pay`) em uma unica pagina de checkout que adapta os metodos de pagamento conforme o produto:

- **Select (creditos avulsos)**: mostra apenas PIX (Mercado Pago)
- **Transfer/Combos (assinaturas)**: mostra apenas Cartao de Credito (Asaas, checkout transparente)

## Design

Layout inspirado na ultima imagem de referencia: duas colunas em desktop (formulario a esquerda, resumo do pedido a direita), coluna unica em mobile. Bordas com `rounded-lg` (menos arredondadas que os `rounded-2xl` atuais). Visual limpo e leve.

```text
+------------------------------------------+---------------------------+
|  Finalizar Compra                        |  Resumo do Pedido         |
|  Pagamento via Cartao de Credito         |                           |
|                                          |  Transfer 20GB            |
|  [Formulario de dados pessoais]          |  Assinatura mensal        |
|  Nome completo                           |                           |
|  CPF ou CNPJ                             |  Subtotal     R$ 24,90    |
|  E-mail (disabled)                       |                           |
|  Telefone                                |  Total        R$ 24,90    |
|  CEP  |  N endereco                      |                           |
|                                          |  [Assinar R$ 24,90]       |
|  -- Metodo de Pagamento --               |                           |
|  [Cartao] (unica opcao p/ assinatura)    +---------------------------+
|  Numero do cartao                        |
|  Nome no cartao                          |
|  Mes  |  Ano  |  CVV                     |
|                                          |
|  Pagamento seguro via Asaas              |
+------------------------------------------+

Para Select (PIX):
+------------------------------------------+---------------------------+
|  Finalizar Compra                        |  Resumo do Pedido         |
|  Pagamento via PIX                       |                           |
|                                          |  Select 5k                |
|  E-mail para recibo                      |  5.000 creditos           |
|  [input email]                           |                           |
|                                          |  Total        R$ 39,90   |
|  [icone PIX]                             |                           |
|  Pague instantaneamente com PIX          |  [Gerar PIX de R$ 39,90] |
|                                          |                           |
|  Pagamento seguro via Mercado Pago       +---------------------------+
+------------------------------------------+
```

## Mudancas Tecnicas

### 1. Refatorar `src/pages/CreditsPayment.tsx`

Transformar em pagina de checkout unificada. Recebe via `location.state` um objeto que indica o tipo de produto:

```text
// Para Select (creditos avulsos):
{
  type: 'select',
  packageId: string,
  packageName: string,
  credits: number,
  priceCents: number,
}

// Para Transfer/Combos (assinaturas):
{
  type: 'subscription',
  planType: string,
  planName: string,
  billingCycle: 'MONTHLY' | 'YEARLY',
  priceCents: number,
}
```

A pagina renderiza condicionalmente:
- Se `type === 'select'`: formulario PIX (email + botao gerar PIX) -- logica atual do CreditsPayment
- Se `type === 'subscription'`: formulario de cartao em 2 steps (dados pessoais -> dados do cartao) -- logica atual do AsaasCheckoutModal

Layout em 2 colunas (lg+): formulario a esquerda, resumo do pedido a direita. Mobile: coluna unica com resumo no topo.

### 2. Atualizar `src/pages/CreditsCheckout.tsx`

- Remover `AsaasCheckoutModal` e seu state
- Alterar `handleSubscribe` para navegar para `/credits/checkout/pay` passando o state de subscription
- `handleBuy` ja navega para `/credits/checkout/pay` (manter, apenas adicionar `type: 'select'`)

### 3. Remover `src/components/credits/AsaasCheckoutModal.tsx`

Nao sera mais necessario -- toda a logica de checkout Asaas migra para a pagina unificada.

### 4. Estilo

- Usar `rounded-lg` em vez de `rounded-2xl` nos cards e inputs
- Bordas finas (`border`) sem sombras pesadas
- Fundo `bg-muted/30` na pagina, cards `bg-card`
- Botao principal com estilo primario padrao do sistema

## Arquivos Modificados

| Arquivo | Acao |
|---|---|
| `src/pages/CreditsPayment.tsx` | Reescrever como checkout unificado (PIX + Cartao) |
| `src/pages/CreditsCheckout.tsx` | Remover modal, navegar para pagina de pagamento |
| `src/components/credits/AsaasCheckoutModal.tsx` | Remover |
