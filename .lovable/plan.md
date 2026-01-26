

# Avaliação Técnica Completa: Fluxo de Pagamentos InfinitePay

## Resumo Executivo

Após análise detalhada de todo o fluxo de pagamentos, identifiquei que **o código está correto**, mas existem **3 problemas que impedem o webhook de ser processado**. O principal problema é que **a InfinitePay não está conseguindo entregar o webhook** ao sistema.

---

## 1. Análise do Fluxo Completo de Pagamento

### Diagrama do Fluxo Atual

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ ETAPA 1: GERAÇÃO DA COBRANÇA                                     [OK]      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ClientGallery.tsx                                                          │
│       │                                                                     │
│       ▼                                                                     │
│  confirm-selection Edge Function                                            │
│       │                                                                     │
│       ▼                                                                     │
│  infinitepay-create-link Edge Function                                      │
│       │                                                                     │
│       ├─► Gera order_nsu único: "gallery-{timestamp}-{random}"              │
│       ├─► Envia webhook_url para InfinitePay API                            │
│       ├─► Recebe checkout_url da InfinitePay                                │
│       └─► Cria registro em cobrancas (status: pendente)                     │
│                                                                             │
│  RESULTADO: Cobrança criada corretamente no banco                           │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ ETAPA 2: REDIRECIONAMENTO DO CLIENTE                             [OK]      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ClientGallery.tsx recebe checkoutUrl                                       │
│       │                                                                     │
│       ▼                                                                     │
│  PaymentRedirect.tsx exibe countdown de 3 segundos                          │
│       │                                                                     │
│       ▼                                                                     │
│  window.location.href = checkoutUrl (redireciona para InfinitePay)          │
│                                                                             │
│  RESULTADO: Cliente redirecionado corretamente                              │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ ETAPA 3: PAGAMENTO NO CHECKOUT INFINITEPAY                       [OK]      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Cliente acessa checkout.infinitepay.io/...                                 │
│       │                                                                     │
│       ▼                                                                     │
│  Escolhe PIX ou Cartão de Crédito                                           │
│       │                                                                     │
│       ▼                                                                     │
│  Pagamento processado com sucesso                                           │
│                                                                             │
│  RESULTADO: Pagamento confirmado pela InfinitePay                           │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ ETAPA 4: NOTIFICAÇÃO VIA WEBHOOK                          [PROBLEMA]       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  InfinitePay DEVERIA enviar POST para:                                      │
│  https://tlnjspsywycbudhewsfv.supabase.co/functions/v1/infinitepay-webhook  │
│       │                                                                     │
│       ▼                                                                     │
│  ❌ NENHUM LOG ENCONTRADO - Webhook NUNCA foi recebido                      │
│                                                                             │
│  RESULTADO: Sistema não recebe confirmação do pagamento                     │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ ETAPA 5: ATUALIZAÇÃO NO BANCO                            [NÃO EXECUTADO]   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  infinitepay-webhook Edge Function (NUNCA ACIONADO)                         │
│       │                                                                     │
│       ├─► NÃO atualiza cobrancas.status = 'pago'                            │
│       ├─► NÃO atualiza galerias.status_pagamento = 'pago'                   │
│       └─► NÃO soma valor em clientes_sessoes.valor_pago                     │
│                                                                             │
│  RESULTADO: Galeria permanece com status "pendente" indefinidamente         │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Evidências Encontradas

### 2.1 Cobrança criada corretamente
```
cobrancas:
  id: 8b8e606c-dec0-4622-af43-6743ec4c55f7
  ip_order_nsu: gallery-1769458954558-6lgnpm
  ip_checkout_url: https://checkout.infinitepay.io/lisediehl?lenc=...
  status: pendente  <-- Deveria ser "pago" após pagamento
  data_pagamento: NULL  <-- Nunca foi atualizado
  ip_transaction_nsu: NULL  <-- Webhook nunca processou
  ip_receipt_url: NULL
```

### 2.2 Galeria com status incorreto
```
galerias:
  id: a7ff2dd6-0974-43ad-8185-d0ce9b9fac2a
  status: selecao_completa
  status_pagamento: pendente  <-- Deveria ser "pago"
  finalized_at: 2026-01-26 20:22:32.945
```

### 2.3 Webhook funciona quando testado manualmente
```bash
# Teste manual bem-sucedido:
curl -X POST .../infinitepay-webhook -d '{"order_nsu": "gallery-..."}'

# Resultado:
{"success": true, "message": "Payment processed"}

# Banco atualizado corretamente após teste:
cobrancas.status = 'pago'
galerias.status_pagamento = 'pago'
clientes_sessoes.valor_pago = 120 (foi 100, somou 20)
```

### 2.4 Logs do webhook
```
❌ ZERO logs encontrados para infinitepay-webhook
```

---

## 3. Diagnóstico: Onde a Confirmação Se Perde

### CAUSA RAIZ: InfinitePay não está entregando o webhook

O problema **não está no código do sistema Gallery**. O problema é que a InfinitePay:
1. Não está chamando o webhook configurado, OU
2. Está chamando mas recebendo erro (antes do deploy com verify_jwt=false), OU
3. A URL configurada no checkout link não corresponde à função deployada

---

## 4. Problemas Identificados e Soluções

### PROBLEMA 1: Deploy Recente - Webhooks Anteriores Falharam

**Descrição:** O `verify_jwt = false` para `infinitepay-webhook` foi adicionado há pouco tempo. Pagamentos feitos ANTES dessa correção tiveram webhooks rejeitados com **401 Unauthorized**. A InfinitePay pode ter desistido após N tentativas.

**Solução:** Para cobranças antigas, é necessário um mecanismo de reconciliação manual ou polling.

---

### PROBLEMA 2: Ausência de Polling/Fallback

**Descrição:** O sistema depende 100% do webhook. Se o webhook falhar, não há forma alternativa de verificar o status do pagamento.

**Solução:** Implementar polling como fallback - verificar status periodicamente na API InfinitePay ou permitir consulta manual.

---

### PROBLEMA 3: Cliente Não Retorna à Galeria

**Descrição:** Após pagamento, o cliente permanece no checkout InfinitePay ou é redirecionado para página genérica. Não há `redirect_url` configurada para trazer o cliente de volta.

**Solução:** Configurar `redirect_url` no payload do checkout link apontando de volta para a galeria com parâmetro de status.

---

## 5. Correções Propostas

### 5.1 Adicionar redirect_url no Checkout Link

**Arquivo:** `supabase/functions/infinitepay-create-link/index.ts`

Modificar o payload para incluir redirect_url após pagamento:

```typescript
// Linha ~101-124
const infinitePayload: InfinitePayPayload = {
  handle: handle,
  items: [...],
  order_nsu: orderNsu,
  webhook_url: `${supabaseUrl}/functions/v1/infinitepay-webhook`,
  // ADICIONAR: redirect após pagamento
  redirect_url: redirectUrl || `${supabaseUrl.replace('.supabase.co', '')}/gallery/${galleryToken}?payment=success`,
};
```

---

### 5.2 Criar Endpoint de Verificação de Status (Polling)

**Novo Arquivo:** `supabase/functions/check-payment-status/index.ts`

Edge Function que permite verificar manualmente o status de uma cobrança:

```typescript
// Lógica:
// 1. Recebe order_nsu ou cobranca_id
// 2. Consulta status atual na tabela cobrancas
// 3. Se ainda pendente e existe ip_checkout_url, 
//    pode tentar consultar API InfinitePay (se disponível)
// 4. Retorna status atual
```

---

### 5.3 Botão de Verificação Manual na Galeria do Fotógrafo

**Arquivo:** `src/pages/GalleryDetail.tsx`

No PaymentStatusCard, adicionar botão para forçar verificação:

```typescript
// Adicionar botão "Verificar Status" que:
// 1. Chama check-payment-status
// 2. Se InfinitePay confirmar pagamento, atualiza banco
// 3. Atualiza UI em tempo real
```

---

### 5.4 Adicionar Log de Auditoria no Webhook

**Arquivo:** `supabase/functions/infinitepay-webhook/index.ts`

Melhorar logging para debug futuro:

```typescript
// Logo após receber requisição:
console.log('📥 WEBHOOK RECEBIDO - Headers:', JSON.stringify(Object.fromEntries(req.headers)));
console.log('📥 WEBHOOK RECEBIDO - Body:', JSON.stringify(payload));

// Criar registro em tabela de auditoria (opcional):
await supabase.from('webhook_logs').insert({
  provedor: 'infinitepay',
  payload: payload,
  status: 'received',
  timestamp: new Date().toISOString()
});
```

---

### 5.5 Reconciliação de Pagamentos Pendentes

**Novo Arquivo:** `supabase/functions/reconcile-payments/index.ts`

Edge Function para reconciliar pagamentos antigos que falharam:

```typescript
// Lógica:
// 1. Busca cobranças com status='pendente' e provedor='infinitepay'
// 2. Para cada uma, verifica se passou tempo suficiente
// 3. Marca como 'expirado' ou permite reprocessamento
```

---

## 6. Resumo das Modificações

| # | Arquivo | Tipo | Descrição |
|---|---------|------|-----------|
| 1 | `supabase/functions/infinitepay-create-link/index.ts` | Modificar | Adicionar redirect_url no payload |
| 2 | `supabase/functions/check-payment-status/index.ts` | Criar | Endpoint para verificar status de pagamento |
| 3 | `supabase/functions/infinitepay-webhook/index.ts` | Modificar | Melhorar logging e auditoria |
| 4 | `src/pages/GalleryDetail.tsx` | Modificar | Adicionar botão "Verificar Status" |
| 5 | `supabase/config.toml` | Modificar | Registrar nova função check-payment-status |

---

## 7. Ações Imediatas Recomendadas

### Para Pagamentos Já Realizados:

O usuário pode usar o teste manual do webhook para marcar pagamentos como confirmados:

```bash
# Substituir ORDER_NSU pelo valor real da cobrança
curl -X POST https://tlnjspsywycbudhewsfv.supabase.co/functions/v1/infinitepay-webhook \
  -H "Content-Type: application/json" \
  -d '{"order_nsu": "gallery-TIMESTAMP-RANDOM"}'
```

### Para Debug Futuro:

Verificar no painel InfinitePay:
1. Histórico de webhooks enviados
2. Status de entrega (sucesso/falha)
3. Logs de erro de entrega

---

## 8. Conclusão

O fluxo de pagamento está **corretamente implementado**, mas depende exclusivamente de webhooks para confirmação. A correção do `verify_jwt = false` foi aplicada recentemente, então pagamentos anteriores não foram atualizados. A solução ideal envolve:

1. **Curto prazo:** Reconciliação manual dos pagamentos pendentes
2. **Médio prazo:** Implementar redirect_url e polling de fallback
3. **Longo prazo:** Criar sistema robusto de auditoria de webhooks

