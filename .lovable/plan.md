

## Implementar Asaas como Gateway de Cobrança de Clientes

### Contexto
O Asaas já existe no sistema como gateway **da plataforma** (assinaturas, créditos). Agora será adicionado como gateway **do fotógrafo** para cobrar clientes em galerias e sessões — similar ao InfinitePay e Mercado Pago. Cada fotógrafo configura sua própria API Key do Asaas.

### Arquitetura

```text
┌─────────────────────────────────────────────┐
│  Settings > Pagamentos > Asaas              │
│  ┌─ API Key do fotógrafo                    │
│  ├─ Ambiente (sandbox/produção)             │
│  ├─ Métodos: PIX, Cartão, Boleto           │
│  ├─ Max parcelas (1-12)                     │
│  ├─ Absorver taxa ou repassar               │
│  └─ Taxa de antecipação (crédito)           │
└─────────────┬───────────────────────────────┘
              │
   ┌──────────▼──────────┐
   │ usuarios_integracoes │  provedor='asaas'
   │ access_token = key   │  dados_extras = config
   └──────────┬──────────┘
              │
   ┌──────────▼──────────────────┐
   │ Edge: asaas-gallery-payment │ ← Checkout transparente
   │ (PIX QR, Cartão, Boleto)   │
   └──────────┬──────────────────┘
              │
   ┌──────────▼──────────────────┐
   │ Edge: asaas-gallery-webhook │ ← Confirma pagamento
   └─────────────────────────────┘
```

### Alterações

#### 1. Frontend — Types e Hook (`usePaymentIntegration.ts`)
- Adicionar `'asaas'` ao tipo `PaymentProvider`
- Criar interface `AsaasData` com campos: `environment` (sandbox/production), `habilitarPix`, `habilitarCartao`, `habilitarBoleto`, `maxParcelas`, `absorverTaxa`, `taxaAntecipacao` (boolean + valor percentual)
- Adicionar mutations `saveAsaas` e `updateAsaasSettings` seguindo padrão MP
- Adicionar `isAsaas` ao retorno de `PaymentIntegrationData`

#### 2. Frontend — UI Configuração (`PaymentSettings.tsx`)
- Novo card "Asaas" no padrão `lunari-card` com:
  - Campo API Key (mascarado)
  - Toggle ambiente sandbox/produção
  - Switches para PIX, Cartão, Boleto
  - Select de max parcelas (1-12)
  - Toggle absorver taxa / repassar ao cliente
  - Toggle taxa de antecipação + campo percentual
- Logo do Asaas (precisa adicionar asset)

#### 3. Frontend — Componentes de seleção
- Atualizar `PaymentMethodSelector.tsx` para incluir Asaas como opção

#### 4. Edge Function — `asaas-gallery-payment` (NOVA)
- Recebe: `userId`, `clienteId`, `sessionId`, `valor`, `descricao`, `galeriaId`, `qtdFotos`, `galleryToken`, `billingType` (PIX/CREDIT_CARD/BOLETO)
- Busca API Key do fotógrafo em `usuarios_integracoes`
- Cria customer no Asaas (ou reutiliza) com dados do cliente
- Cria cobrança via API Asaas (`/payments`)
- Para PIX: retorna QR code + copia-e-cola
- Para Cartão: retorna dados para checkout transparente
- Para Boleto: retorna URL do boleto
- Registra em tabela `cobrancas`
- Compatível com projeto Studio (mesmo contrato de entrada/saída)

#### 5. Edge Function — `asaas-gallery-webhook` (NOVA)
- Recebe eventos do Asaas do fotógrafo
- Processa `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`
- Atualiza `cobrancas.status` e `galerias.status_pagamento`
- Finaliza galeria se aplicável (mesmo fluxo dos outros gateways)

#### 6. Edge Functions existentes — Atualizar
- `gallery-create-payment`: adicionar `asaas` como provider válido, chamar `asaas-gallery-payment`
- `confirm-selection`: incluir `asaas` na lista de providers ao descobrir integração ativa

#### 7. Configuração
- `supabase/config.toml`: adicionar `[functions.asaas-gallery-payment]` e `[functions.asaas-gallery-webhook]` com `verify_jwt = false`
- Logo Asaas em `src/assets/payment-logos/asaas.png`

### Segurança
- API Key do fotógrafo armazenada em `usuarios_integracoes.access_token` (não em secrets globais)
- Edge functions de InfinitePay e Mercado Pago **não serão alteradas** — apenas os pontos de roteamento
- Webhook valida provedor e referência cruzada com cobrança existente

### Compatibilidade com Studio
O contrato da edge function `asaas-gallery-payment` seguirá o mesmo padrão de entrada/saída dos outros gateways, permitindo que o Studio a invoque para cobranças avulsas e de sessões via links.

### Fora de escopo (próxima iteração)
- Tela de checkout transparente no lado do cliente (cartão inline)
- Cálculo detalhado de taxa de antecipação (aguardando especificação da lógica)

