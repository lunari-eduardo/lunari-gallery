
# Documentação Técnica Completa: Sistema de Pagamentos InfinitePay

## Visão Geral

O sistema de pagamentos InfinitePay deste projeto (Gallery) é compartilhado com o projeto **Gestão** através de tabelas comuns no Supabase. Esta documentação detalha todos os componentes envolvidos para facilitar a separação ou refatoração futura.

---

## 1. Tabelas do Banco de Dados

### 1.1 `cobrancas` (Tabela Principal de Cobranças)

| Coluna | Tipo | Descrição | Usado por |
|--------|------|-----------|-----------|
| `id` | UUID | Identificador único | Gallery + Gestão |
| `user_id` | UUID | ID do fotógrafo (owner) | Gallery + Gestão |
| `cliente_id` | UUID | ID do cliente | Gallery + Gestão |
| `session_id` | TEXT | ID da sessão (workflow-*) - **CRÍTICO para sincronização** | Gallery + Gestão |
| `valor` | NUMERIC | Valor em **REAIS** (não centavos) | Gallery + Gestão |
| `descricao` | TEXT | Descrição da cobrança | Gallery + Gestão |
| `tipo_cobranca` | TEXT | Tipo: 'link', 'pix', etc. | Gallery + Gestão |
| `status` | TEXT | 'pendente', 'pago', 'cancelado' | Gallery + Gestão |
| `provedor` | TEXT | 'infinitepay', 'mercadopago', 'pix_manual' | Gallery + Gestão |
| `ip_checkout_url` | TEXT | URL de checkout da InfinitePay | Gallery |
| `ip_order_nsu` | TEXT | **Identificador único**: `gallery-{timestamp}-{random}` | Gallery |
| `ip_transaction_nsu` | TEXT | NSU da transação (vem do webhook) | Gallery |
| `ip_receipt_url` | TEXT | URL do recibo | Gallery |
| `data_pagamento` | TIMESTAMPTZ | Data/hora do pagamento | Gallery + Gestão |
| `mp_*` | TEXT | Campos Mercado Pago | Gallery + Gestão |

**Observação Crítica**: O campo `ip_order_nsu` no formato `gallery-*` é gerado apenas pelo **Gallery**. Se o Gestão criar cobranças com outro formato, não haverá conflito.

---

### 1.2 `usuarios_integracoes` (Configurações do Provedor)

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID | ID único |
| `user_id` | UUID | ID do fotógrafo |
| `provedor` | TEXT | 'infinitepay', 'mercadopago', 'pix_manual' |
| `status` | TEXT | 'ativo', 'inativo', 'pendente' |
| `dados_extras` | JSONB | Dados do provedor (ver abaixo) |
| `is_default` | BOOLEAN | Se é o método padrão |
| `conectado_em` | TIMESTAMPTZ | Data de conexão |
| `access_token` | TEXT | Token OAuth (MercadoPago) |

**Estrutura de `dados_extras` por provedor:**

```jsonc
// InfinitePay
{
  "handle": "@usuario_infinitepay"  // Handle público do fotógrafo
}

// PIX Manual
{
  "chavePix": "email@exemplo.com",
  "tipoChave": "email|cpf|cnpj|telefone|aleatoria",
  "nomeTitular": "Nome do Titular"
}
```

---

### 1.3 `galerias` (Campos Relacionados a Pagamento)

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `session_id` | TEXT | Link com `clientes_sessoes` do Gestão |
| `status_pagamento` | TEXT | 'sem_vendas', 'pendente', 'aguardando_confirmacao', 'pago' |
| `valor_extras` | NUMERIC | Valor total das fotos extras |
| `public_token` | TEXT | Token público para URL da galeria |
| `configuracoes` | JSONB | Inclui `saleSettings` com método de pagamento |

**Estrutura de `configuracoes.saleSettings`:**

```jsonc
{
  "mode": "no_sale|sale_with_payment|sale_without_payment",
  "paymentMethod": "infinitepay|mercadopago|pix_manual"
}
```

---

### 1.4 `clientes_sessoes` (Sincronização com Gestão)

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `session_id` | TEXT (PK) | ID textual único (workflow-*) |
| `valor_pago` | NUMERIC | **INCREMENTAL**: Soma de todos pagamentos |
| `regras_congeladas` | JSONB | Regras de precificação congeladas |
| `valor_foto_extra` | NUMERIC | Valor unitário da foto extra |
| `qtd_fotos_extra` | INTEGER | Quantidade de extras vendidas |

**Observação**: O `valor_pago` é **incrementado** tanto pelo webhook quanto pela confirmação manual, podendo acumular múltiplos pagamentos.

---

### 1.5 `webhook_logs` (Auditoria)

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID | ID único |
| `provedor` | TEXT | 'infinitepay' |
| `payload` | JSONB | Payload recebido |
| `headers` | JSONB | Headers da requisição |
| `status` | TEXT | 'received', 'processed', 'error', 'ignored' |
| `order_nsu` | TEXT | Referência para match |
| `error_message` | TEXT | Mensagem de erro (se houver) |
| `processed_at` | TIMESTAMPTZ | Data de processamento |

---

## 2. Edge Functions

### 2.1 `infinitepay-create-link` (Geração de Cobrança)

**Endpoint**: `POST /functions/v1/infinitepay-create-link`

**Chamada por**: 
- `confirm-selection` (quando cliente confirma seleção)
- `gallery-create-payment` (wrapper para criação direta)

**Parâmetros de entrada:**
```typescript
{
  clienteId: string;      // UUID do cliente
  sessionId?: string;     // workflow-* (para sincronização)
  valor: number;          // Valor em REAIS
  descricao: string;      // Descrição da cobrança
  userId: string;         // UUID do fotógrafo
  redirectUrl?: string;   // URL de retorno customizada
  webhookUrl?: string;    // URL de webhook customizada
  galleryToken?: string;  // Token para construir redirect
}
```

**Processo interno:**
1. Busca `handle` em `usuarios_integracoes` pelo `userId`
2. Gera `order_nsu` no formato `gallery-{timestamp}-{random}`
3. Converte valor para centavos: `Math.round(valor * 100)`
4. Chama API InfinitePay: `POST https://api.infinitepay.io/invoices/public/checkout/links`
5. Insere registro na tabela `cobrancas` com status 'pendente'

**Retorno:**
```typescript
{
  success: boolean;
  checkoutUrl: string;    // URL para redirecionar cliente
  cobrancaId: string;     // UUID da cobrança criada
  orderNsu: string;       // NSU para tracking
  provedor: 'infinitepay';
}
```

**Payload para API InfinitePay:**
```typescript
{
  handle: "@handle_do_fotografo",
  items: [{
    quantity: 1,
    price: 2500,  // Em CENTAVOS
    description: "3 fotos extras - Ensaio"
  }],
  order_nsu: "gallery-1769483972062-pj4o1d",
  redirect_url: "https://lunari-gallery.lovable.app/g/{token}?payment=success",
  webhook_url: "https://tlnjspsywycbudhewsfv.supabase.co/functions/v1/infinitepay-webhook"
}
```

---

### 2.2 `infinitepay-webhook` (Recebimento de Notificações)

**Endpoint**: `POST /functions/v1/infinitepay-webhook`

**Chamada por**: InfinitePay (quando pagamento é confirmado)

**Processo interno:**
1. Loga requisição em `webhook_logs` imediatamente
2. Extrai `order_nsu` do payload
3. Busca cobrança por `ip_order_nsu`
4. Se encontrada e não processada:
   - Atualiza `cobrancas.status = 'pago'`
   - Atualiza `galerias.status_pagamento = 'pago'` (via `session_id`)
   - **Incrementa** `clientes_sessoes.valor_pago`
5. Atualiza log para 'processed'

**Payload esperado da InfinitePay:**
```typescript
{
  order_nsu: "gallery-1769483972062-pj4o1d",
  transaction_nsu: "12345678",
  receipt_url: "https://...",
  status: "paid",
  amount: 2500,  // Centavos
  paid_amount: 2500
}
```

---

### 2.3 `check-payment-status` (Verificação de Status)

**Endpoint**: `POST /functions/v1/check-payment-status`

**Chamada por**:
- `ClientGallery.tsx` (quando retorna do checkout com `?payment=success`)
- `GalleryDetail.tsx` (polling a cada 30s)

**Parâmetros:**
```typescript
{
  cobrancaId?: string;   // Busca por ID
  orderNsu?: string;     // Busca por NSU
  sessionId?: string;    // Busca por sessão
  forceUpdate?: boolean; // Se true, marca como pago imediatamente
}
```

**Processo interno (3 camadas):**

1. **Se status já é 'pago'**: Retorna status sem modificar
2. **Se pendente + InfinitePay**: Consulta API InfinitePay via `GET /v2/orders/{nsu}`
   - Se pago na API → Atualiza banco local
3. **Se forceUpdate=true + pendente**: Força atualização para 'pago'

**Retorno:**
```typescript
{
  found: boolean;
  status: 'pago' | 'pendente';
  updated?: boolean;
  source?: 'infinitepay_api' | 'force_update';
  cobranca: { id, status, valor, provedor, ... }
}
```

---

### 2.4 `confirm-selection` (Confirmação de Seleção)

**Endpoint**: `POST /functions/v1/confirm-selection`

**Chamada por**: `ClientGallery.tsx` (quando cliente clica "Confirmar e Pagar")

**Parâmetros:**
```typescript
{
  galleryId: string;
  selectedCount: number;
  extraCount?: number;
  requestPayment?: boolean;  // Se true, cria link de pagamento
}
```

**Processo interno (Payment First):**
1. Busca galeria e verifica se não está finalizada
2. Calcula preço progressivo usando `regras_congeladas`
3. **SE pagamento é necessário:**
   - Busca provedor ativo em `usuarios_integracoes`
   - Invoca `infinitepay-create-link` ou `mercadopago-create-link`
   - **SE falhar: ABORTA toda operação (não finaliza galeria)**
4. **SE pagamento criado com sucesso:**
   - Atualiza `galerias` com status_selecao='confirmado'
   - Atualiza `clientes_sessoes` com qtd_fotos_extra
   - Loga ação em `galeria_acoes`
5. Retorna `checkoutUrl` para redirecionar cliente

---

### 2.5 `gallery-create-payment` (Wrapper para Gestão)

**Endpoint**: `POST /functions/v1/gallery-create-payment`

**Chamada por**: Projeto **Gestão** (externa)

**Parâmetros:**
```typescript
{
  galleryId: string;
  valorTotal: number;
  extraCount: number;
  descricao?: string;
}
```

**Processo interno:**
1. Busca galeria pelo ID
2. Descobre provedor ativo do fotógrafo
3. Normaliza `session_id` para formato workflow-*
4. Invoca `infinitepay-create-link` ou `mercadopago-create-link`
5. Atualiza `galerias.status_pagamento = 'pendente'`

**Observação**: Esta função é um **ponto de conflito** potencial, pois pode ser chamada externamente pelo Gestão.

---

## 3. Frontend Components

### 3.1 `ClientGallery.tsx` (Galeria do Cliente)

**Responsabilidades:**
- Detectar retorno do checkout via `?payment=success`
- Chamar `check-payment-status` com `forceUpdate: true`
- Exibir tela de confirmação após pagamento

**Código relevante (detecção de redirect):**
```typescript
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  if (params.get('payment') === 'success') {
    handlePaymentReturn();
  }
}, []);
```

---

### 3.2 `GalleryDetail.tsx` (Painel do Fotógrafo)

**Responsabilidades:**
- Polling automático a cada 30s para pagamentos pendentes
- Botão "Verificar Status" para forçar checagem
- Botão "Confirmar Pago" para override manual

**Código relevante (polling):**
```typescript
useEffect(() => {
  if (cobranca?.status === 'pendente' && cobranca?.provedor === 'infinitepay') {
    const interval = setInterval(checkPaymentStatus, 30000);
    return () => clearInterval(interval);
  }
}, [cobranca]);
```

---

### 3.3 `SelectionConfirmation.tsx` (Checkout Unificado)

**Responsabilidades:**
- Exibir resumo de fotos selecionadas
- Calcular preço progressivo usando `pricingUtils.ts`
- Chamar `confirm-selection` ao clicar "Confirmar e Pagar"

---

### 3.4 `usePaymentIntegration.ts` (Hook de Configuração)

**Responsabilidades:**
- Gerenciar configurações de pagamento do fotógrafo
- Salvar/atualizar dados em `usuarios_integracoes`
- Definir método padrão

---

## 4. Fluxo de Dados Completo

```text
┌─────────────────────────────────────────────────────────────────────┐
│ FLUXO DE GERAÇÃO DE COBRANÇA (Gallery)                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ClientGallery.tsx                                                  │
│       │                                                             │
│       ▼                                                             │
│  SelectionConfirmation.tsx                                          │
│       │ (usuário clica "Confirmar e Pagar")                         │
│       ▼                                                             │
│  confirm-selection (Edge Function)                                  │
│       │                                                             │
│       ├─► Calcula preço (pricingUtils / regras_congeladas)          │
│       │                                                             │
│       ├─► Busca provedor (usuarios_integracoes)                     │
│       │                                                             │
│       ▼                                                             │
│  infinitepay-create-link (Edge Function)                            │
│       │                                                             │
│       ├─► Busca handle do fotógrafo                                 │
│       ├─► Gera order_nsu: "gallery-{timestamp}-{random}"            │
│       ├─► Converte valor para CENTAVOS                              │
│       ├─► POST para API InfinitePay                                 │
│       ├─► Insere em tabela cobrancas                                │
│       │                                                             │
│       ▼                                                             │
│  confirm-selection (continuação)                                    │
│       │                                                             │
│       ├─► Atualiza galerias (status_pagamento='pendente')           │
│       ├─► Atualiza clientes_sessoes                                 │
│       │                                                             │
│       ▼                                                             │
│  ClientGallery.tsx                                                  │
│       │                                                             │
│       └─► Redireciona para checkoutUrl da InfinitePay               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ FLUXO DE CONFIRMAÇÃO DE PAGAMENTO (3 Camadas)                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  CAMADA 1: WEBHOOK (Passivo)                                        │
│  ───────────────────────────                                        │
│  InfinitePay → POST /infinitepay-webhook                            │
│             → Loga em webhook_logs                                  │
│             → Atualiza cobrancas.status='pago'                      │
│             → Atualiza galerias.status_pagamento='pago'             │
│             → Incrementa clientes_sessoes.valor_pago                │
│                                                                     │
│  CAMADA 2: REDIRECT (Ativo - Cliente)                               │
│  ─────────────────────────────────────                              │
│  Cliente retorna → URL contém ?payment=success                      │
│                 → ClientGallery.tsx detecta                         │
│                 → Chama check-payment-status(forceUpdate=true)      │
│                 → Marca como pago imediatamente                     │
│                                                                     │
│  CAMADA 3: POLLING + API (Fallback - Fotógrafo)                     │
│  ─────────────────────────────────────────────                      │
│  GalleryDetail.tsx → Polling cada 30s                               │
│                    → check-payment-status                           │
│                    → Consulta API InfinitePay (GET /v2/orders/{nsu})│
│                    → Se pago na API, atualiza banco                 │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 5. Pontos de Conflito com Projeto Gestão

### 5.1 Função `gallery-create-payment`

Esta Edge Function foi criada para ser chamada externamente pelo **Gestão**. Ela:
- Recebe `galleryId` do Gestão
- Busca provedor no banco compartilhado
- Invoca `infinitepay-create-link`

**Risco**: Se o Gestão modificar esta função ou passar parâmetros diferentes, pode quebrar o fluxo do Gallery.

### 5.2 Formato do `order_nsu`

O Gallery usa o formato `gallery-{timestamp}-{random}`. Se o Gestão criar cobranças com outro formato, não haverá colisão, **MAS** se usar o mesmo formato, os webhooks podem processar a cobrança errada.

### 5.3 Tabela `cobrancas`

Ambos os projetos escrevem nesta tabela. Campos específicos do Gallery:
- `ip_checkout_url`
- `ip_order_nsu`
- `ip_transaction_nsu`
- `ip_receipt_url`

O Gestão pode ter seus próprios campos ou usar os mesmos.

### 5.4 Tabela `clientes_sessoes`

O campo `valor_pago` é **incrementado** por ambos os projetos:
- Gallery incrementa via webhook e confirmação manual
- Gestão pode incrementar via suas próprias cobranças

---

## 6. Configuração Atual (supabase/config.toml)

```toml
project_id = "tlnjspsywycbudhewsfv"

[functions.infinitepay-create-link]
verify_jwt = false

[functions.infinitepay-webhook]
verify_jwt = false

[functions.check-payment-status]
verify_jwt = false

[functions.confirm-selection]
verify_jwt = false

[functions.gallery-create-payment]
verify_jwt = false
```

**Observação**: Todas as funções de pagamento estão com `verify_jwt = false` para permitir chamadas externas (webhooks, Gestão).

---

## 7. Secrets Necessários

| Secret | Uso | Obrigatório |
|--------|-----|-------------|
| `SUPABASE_URL` | Conexão com banco | Sim |
| `SUPABASE_SERVICE_ROLE_KEY` | Operações admin | Sim |
| `INFINITEPAY_CLIENT_ID` | Consulta API InfinitePay (Camada 3) | Opcional |
| `INFINITEPAY_CLIENT_SECRET` | Consulta API InfinitePay (Camada 3) | Opcional |

---

## 8. Recomendações para Separação

### Opção A: Prefixar `order_nsu`

Alterar o formato para incluir identificador do projeto:
- Gallery: `lunari-gallery-{timestamp}-{random}`
- Gestão: `gestao-{timestamp}-{random}`

Isso permite que o webhook identifique a origem da cobrança.

### Opção B: Criar Edge Functions Separadas

Duplicar as funções para cada projeto:
- `infinitepay-create-link-gallery`
- `infinitepay-create-link-gestao`

Com webhooks separados apontando para endpoints diferentes.

### Opção C: Adicionar Campo `origem` na Tabela `cobrancas`

Adicionar coluna `origem TEXT DEFAULT 'gallery'` e filtrar por ela no webhook.

---

## 9. Resumo dos Arquivos

| Arquivo | Tipo | Responsabilidade |
|---------|------|------------------|
| `supabase/functions/infinitepay-create-link/index.ts` | Edge Function | Gera link de checkout |
| `supabase/functions/infinitepay-webhook/index.ts` | Edge Function | Recebe notificações |
| `supabase/functions/check-payment-status/index.ts` | Edge Function | Verifica/sincroniza status |
| `supabase/functions/confirm-selection/index.ts` | Edge Function | Confirma seleção + cria pagamento |
| `supabase/functions/gallery-create-payment/index.ts` | Edge Function | Wrapper para Gestão |
| `src/pages/ClientGallery.tsx` | React Component | Galeria do cliente + redirect detection |
| `src/pages/GalleryDetail.tsx` | React Component | Painel do fotógrafo + polling |
| `src/components/SelectionConfirmation.tsx` | React Component | Checkout unificado |
| `src/hooks/usePaymentIntegration.ts` | React Hook | Configuração de provedores |
| `src/lib/pricingUtils.ts` | Utility | Cálculo de preços progressivos |
| `supabase/config.toml` | Config | Configuração das Edge Functions |
