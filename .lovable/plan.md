

## Diagnóstico e Correções

### Problema 1: Tela "Confirmando pagamento" trava (InfinitePay)

**Bug encontrado**: Race condition no estado inicial do `ClientGallery.tsx`.

Linha 127-129 inicializa `isProcessingPaymentReturn = true` quando `?payment=success` está na URL.
Linha 131-134 inicializa `paymentReturnStatus = 'verifying'`.

Isso faz a UI renderizar a tela "Confirmando seu pagamento...". Mas o useEffect na linha 599 tem a condição:
```
if (paymentStatus === 'success' && galleryId && !isProcessingPaymentReturn)
```

Como `isProcessingPaymentReturn` já é `true`, `!isProcessingPaymentReturn` é `false`, e o `confirmPaymentReturn()` **nunca executa**. O cliente fica preso na tela de verificação até o webhook atualizar o DB e um reload manual detectar a mudança.

**Correção**: Remover a inicialização eager de `isProcessingPaymentReturn`. Inicializar como `false` e deixar o useEffect setar `true` quando detectar `?payment=success`. O useEffect já faz `setIsProcessingPaymentReturn(true)` na linha 600, que é o fluxo correto.

### Problema 2: Asaas PIX QR Code não funciona

Sem logs de erro no `asaas-gallery-payment`. O QR Code PIX do Asaas Sandbox não é escaneável por apps bancários reais — isso é comportamento esperado do ambiente sandbox. Entretanto, há dois problemas reais no código:

1. **`asaas-gallery-payment` não foi refatorado** para usar a RPC `finalize_gallery_payment`. Linhas 408-456 ainda usam o padrão read-then-write com race conditions (incrementos não atômicos). Precisa ser corrigido para consistência.

2. A cobrança é criada na tabela mas o check-payment-status para Asaas não consulta nenhuma API externa (como faz para InfinitePay). O polling apenas lê o status do DB, que só muda via webhook. Se o webhook Asaas demorar, o cliente fica esperando.

**Correção para o `asaas-gallery-payment`**: Substituir o bloco de finalização imediata (linhas 405-456) por chamada à RPC `finalize_gallery_payment`, igual foi feito nas outras funções.

### Problema 3: Logo pequeno no checkout

A classe `h-12` (48px) está sendo usada em:
- `AsaasCheckout.tsx` linha 438
- `PaymentPendingScreen.tsx` linha 120
- `ClientGallery.tsx` linha 993

**Correção**: Aumentar para `h-16` ou `h-20` para maior visibilidade.

### Arquivos modificados

1. **`src/pages/ClientGallery.tsx`**: Corrigir inicialização de estado para não bloquear o useEffect de verificação de pagamento
2. **`supabase/functions/asaas-gallery-payment/index.ts`**: Substituir bloco de finalização imediata pela RPC `finalize_gallery_payment`
3. **`src/components/AsaasCheckout.tsx`**: Aumentar logo para `h-16`
4. **`src/components/PaymentPendingScreen.tsx`**: Aumentar logo para `h-16`

