

## Checkout Transparente Asaas para Cliente Final

### Contexto Atual
Quando o provedor de pagamento é **Asaas**, o `confirm-selection` cria a cobrança via `asaas-gallery-payment` e retorna um `checkoutUrl` (URL do invoice Asaas). O cliente vê a tela de `PaymentRedirect` com countdown e é redirecionado para `sandbox.asaas.com`. Isso é desnecessário porque a edge function `asaas-gallery-payment` **já suporta checkout transparente** -- aceita dados de cartão, gera QR Code PIX, e retorna tudo inline.

### Solução
Criar um componente `AsaasCheckout` que renderiza **dentro da galeria** com abas PIX / Cartão de Crédito, eliminando o redirecionamento externo. O fluxo muda para:

1. `confirm-selection` detecta provedor Asaas e, em vez de gerar cobrança com invoice URL, retorna flag `transparentCheckout: true` com dados do fotógrafo (settings habilitados, galeriaId, userId, etc.)
2. O frontend exibe o `AsaasCheckout` onde o cliente escolhe PIX ou Cartão
3. O componente chama `asaas-gallery-payment` diretamente com `billingType` + dados do cartão (se aplicável)
4. Para PIX: exibe QR Code + Copia e Cola com polling automático
5. Para Cartão: formulário com nome, CPF, dados do cartão, CEP, com validação em tempo real
6. Após confirmação, atualiza o status da galeria

### Arquitetura

```text
┌─ ClientGallery.tsx ─────────────────────────┐
│  confirm-selection retorna:                  │
│  { requiresPayment, provedor: 'asaas',      │
│    asaasCheckout: { galeriaId, userId,       │
│    valorTotal, habilitarPix, habilitarCartao,│
│    maxParcelas, absorverTaxa, ... } }        │
│                                              │
│  ┌─ AsaasCheckout.tsx ────────────────────┐  │
│  │  [PIX] | [Cartão de Crédito]          │  │
│  │                                        │  │
│  │  PIX: QR Code + Copia e Cola          │  │
│  │  + polling check-payment-status        │  │
│  │                                        │  │
│  │  Cartão: Form (nome, CPF, nº cartão,  │  │
│  │  validade, CVV, CEP, parcelas)         │  │
│  │  → asaas-gallery-payment transparente  │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
```

### Alterações

#### 1. `supabase/functions/confirm-selection/index.ts`
Quando o provedor for `asaas`, **não criar a cobrança imediatamente**. Em vez disso, retornar os dados necessários para o checkout transparente:
- `provedor: 'asaas'`
- `transparentCheckout: true`
- `asaasCheckoutData: { galeriaId, userId, valorTotal, descricao, qtdFotos, clienteId, sessionId, galleryToken }`
- `enabledMethods: { pix, creditCard }` (baseado nos settings do fotógrafo)
- `maxParcelas`, `absorverTaxa`, `taxaAntecipacao` settings

A galeria ainda é marcada como `aguardando_pagamento` e a cobrança Asaas é criada quando o cliente escolher o método.

#### 2. Novo componente `src/components/AsaasCheckout.tsx`
Tela full-page (mesmo padrão visual do `PixPaymentScreen`) com:
- **Header**: Logo do estúdio + valor total
- **Tabs**: PIX / Cartão (habilitados conforme settings)
- **Tab PIX**:
  - Chama `asaas-gallery-payment` com `billingType: 'PIX'`
  - Exibe QR Code (base64 do Asaas) + Copia e Cola
  - Polling automático via `check-payment-status` (30s)
  - Botão "Copiar código PIX"
- **Tab Cartão**:
  - Formulário: Nome no cartão, CPF/CNPJ, Número, Validade, CVV, CEP, Telefone
  - Seletor de parcelas (1x a maxParcelas)
  - Exibição de taxa de antecipação (se aplicável)
  - Validação de CPF com checksum
  - Chama `asaas-gallery-payment` com dados do cartão
  - Feedback imediato de aprovação/rejeição
- **Botão Cancelar**: Volta para tela de confirmação

#### 3. `src/pages/ClientGallery.tsx`
- Novo estado `asaasCheckoutData` para dados do checkout transparente
- Na `onSuccess` do `confirmMutation`: detectar `transparentCheckout === true` e setar `asaasCheckoutData` em vez de `paymentInfo`
- Novo bloco de render antes do `PaymentRedirect`: se `asaasCheckoutData` existe, renderizar `<AsaasCheckout />`
- Callback `onPaymentConfirmed` para marcar galeria como paga e ir para tela de confirmação

#### 4. Edge functions existentes (sem alteração)
- `asaas-gallery-payment`: Já suporta `billingType`, `creditCard`, `creditCardHolderInfo`, `remoteIp` -- tudo pronto
- `check-payment-status`: Já faz polling de status -- reutilizado
- `infinitepay-create-link` e `mercadopago-create-link`: Não afetados (continuam com redirect)

### UX/UI Design
- Glassmorphism consistente com o tema da galeria (herda `themeStyles` e `backgroundMode`)
- Animação de transição suave entre abas
- Loading states com skeleton durante geração do QR Code
- Toast de sucesso com confetti visual ao confirmar pagamento
- Formulário de cartão com máscara automática (número, validade, CPF)
- Indicador de segurança ("Pagamento criptografado" com ícone de cadeado)
- Mobile-first: campos empilhados, botões full-width
- Parcelas com valor da parcela calculado em tempo real

### Segurança
- Dados do cartão nunca são armazenados no frontend -- enviados diretamente para a edge function que repassa ao Asaas
- `remoteIp` capturado via API externa (ou header) para compliance do Asaas
- Validação de CPF/CNPJ com checksum antes do envio

