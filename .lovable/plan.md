

# Plano de Correção: Retorno de Pagamento InfinitePay

## Diagnóstico

### Problemas Encontrados

| # | Problema | Localização | Impacto |
|---|----------|-------------|---------|
| 1 | Endpoint de verificação incorreto | `check-payment-status/index.ts` L29 | API não encontra pagamento |
| 2 | Não captura parâmetros do redirect | `ClientGallery.tsx` L458-476 | Perde dados cruciais |
| 3 | Usa OAuth ao invés de endpoint público | `check-payment-status/index.ts` L16-59 | Falha sem credenciais |
| 4 | Falta handle para verificação | `check-payment-status/index.ts` | Impossibilita consulta pública |

### Como Deveria Funcionar (Documentação InfinitePay)

**URL de Retorno**:
```
https://seusite.com/galeria?payment=success&receipt_url=...&order_nsu=...&slug=...&capture_method=...&transaction_nsu=...
```

**Endpoint de Verificação (Público, sem OAuth)**:
```typescript
POST https://api.infinitepay.io/invoices/public/checkout/payment_check
{
  "handle": "@fotografo",
  "order_nsu": "gallery-123-abc",
  "transaction_nsu": "uuid-da-transacao",
  "slug": "codigo-fatura"
}
```

**Resposta**:
```json
{
  "success": true,
  "paid": true,
  "amount": 1500,
  "paid_amount": 1510,
  "capture_method": "pix"
}
```

---

## Correções Necessárias

### 1. `ClientGallery.tsx` - Capturar Parâmetros do Redirect

**Linhas afetadas**: 455-501

**Antes**:
```typescript
const params = new URLSearchParams(window.location.search);
const paymentStatus = params.get('payment');

if (paymentStatus === 'success' && galleryId) {
  // Chama check-payment-status só com sessionId
  body: JSON.stringify({ 
    sessionId: sessionId,
    forceUpdate: true 
  }),
}
```

**Depois**:
```typescript
const params = new URLSearchParams(window.location.search);
const paymentStatus = params.get('payment');

// Capturar TODOS os parâmetros que InfinitePay envia no redirect
const orderNsu = params.get('order_nsu');
const transactionNsu = params.get('transaction_nsu');
const slug = params.get('slug');
const receiptUrl = params.get('receipt_url');
const captureMethod = params.get('capture_method');

if (paymentStatus === 'success' && galleryId) {
  // Passar parâmetros para verificação
  body: JSON.stringify({ 
    sessionId: sessionId,
    orderNsu: orderNsu,           // Novo
    transactionNsu: transactionNsu, // Novo  
    slug: slug,                   // Novo
    receiptUrl: receiptUrl,       // Novo
    forceUpdate: true 
  }),
}
```

---

### 2. `check-payment-status/index.ts` - Usar Endpoint Público Correto

**Linhas afetadas**: 8-59

**Adicionar novos parâmetros na interface**:
```typescript
interface RequestBody {
  cobrancaId?: string;
  orderNsu?: string;
  sessionId?: string;
  forceUpdate?: boolean;
  // Novos parâmetros do redirect InfinitePay
  transactionNsu?: string;
  slug?: string;
  receiptUrl?: string;
}
```

**Substituir função de verificação para usar endpoint PÚBLICO**:
```typescript
async function checkInfinitePayStatusPublic(
  supabase: any,
  userId: string,
  orderNsu: string,
  transactionNsu?: string,
  slug?: string
): Promise<{ status: 'paid' | 'pending' | 'error'; receiptUrl?: string }> {
  
  // Buscar handle do fotógrafo
  const { data: integracao } = await supabase
    .from('usuarios_integracoes')
    .select('dados_extras')
    .eq('user_id', userId)
    .eq('provedor', 'infinitepay')
    .eq('status', 'ativo')
    .maybeSingle();

  const handle = integracao?.dados_extras?.handle;
  
  if (!handle) {
    console.log('⚠️ Handle InfinitePay não encontrado');
    return { status: 'error' };
  }

  try {
    console.log('🔍 Consultando status via endpoint público InfinitePay');
    
    // ENDPOINT CORRETO: Público, não requer OAuth
    const response = await fetch('https://api.infinitepay.io/invoices/public/checkout/payment_check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        handle: handle,
        order_nsu: orderNsu,
        transaction_nsu: transactionNsu,
        slug: slug,
      }),
    });

    if (!response.ok) {
      console.log('⚠️ Erro na consulta:', response.status);
      return { status: 'error' };
    }

    const data = await response.json();
    console.log('📊 Resposta InfinitePay:', JSON.stringify(data));

    if (data.success && data.paid) {
      return { status: 'paid', receiptUrl: data.receipt_url };
    }

    return { status: 'pending' };
  } catch (error) {
    console.error('❌ Erro ao consultar InfinitePay:', error);
    return { status: 'error' };
  }
}
```

---

### 3. Atualizar Lógica de Verificação com Dados do Redirect

**Quando o cliente retorna do checkout com os parâmetros da InfinitePay**:
1. Se `transactionNsu` e `slug` estão presentes → usar endpoint público para confirmar
2. Se confirmado → atualizar `cobrancas` com `ip_transaction_nsu` e `ip_receipt_url`
3. Atualizar galeria e sessão

---

## Arquivos a Modificar

| Arquivo | Alteração | Prioridade |
|---------|-----------|------------|
| `src/pages/ClientGallery.tsx` | Capturar parâmetros do redirect | Alta |
| `supabase/functions/check-payment-status/index.ts` | Usar endpoint público correto | Alta |

---

## Fluxo Corrigido

```text
┌─────────────────────────────────────────────────────────────────────┐
│ FLUXO DE RETORNO DE PAGAMENTO (Corrigido)                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. Cliente finaliza pagamento na InfinitePay                       │
│     │                                                               │
│     ▼                                                               │
│  2. InfinitePay redireciona para:                                   │
│     /g/{token}?payment=success                                      │
│              &order_nsu=gallery-123                                 │
│              &transaction_nsu=abc-def                               │
│              &slug=fatura-xyz                                       │
│              &receipt_url=https://...                               │
│              &capture_method=pix                                    │
│     │                                                               │
│     ▼                                                               │
│  3. ClientGallery.tsx captura TODOS os parâmetros                   │
│     │                                                               │
│     ▼                                                               │
│  4. Chama check-payment-status com:                                 │
│     { orderNsu, transactionNsu, slug, receiptUrl, forceUpdate }     │
│     │                                                               │
│     ▼                                                               │
│  5. check-payment-status:                                           │
│     ├─► Busca cobrança por order_nsu                                │
│     ├─► Busca handle do fotógrafo                                   │
│     └─► POST /invoices/public/checkout/payment_check                │
│         │                                                           │
│         ├─► paid: true → Atualiza banco + retorna sucesso           │
│         └─► paid: false → Retorna pendente                          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Compatibilidade

| Cenário | Comportamento |
|---------|---------------|
| Webhook funciona | Pagamento já confirmado antes do redirect |
| Webhook falha + redirect com parâmetros | Verifica via endpoint público |
| Redirect sem parâmetros (fallback) | Usa forceUpdate se necessário |
| Fotógrafo verifica manualmente | Polling via cobrancaId funciona |

---

## Sem Necessidade de Secrets

O endpoint `POST /invoices/public/checkout/payment_check` é **público** e não requer OAuth!
- Não precisa de `INFINITEPAY_CLIENT_ID`
- Não precisa de `INFINITEPAY_CLIENT_SECRET`
- Só precisa do `handle` do fotógrafo (já está no banco)

---

## Validações Pós-Deploy

1. **Teste com redirect completo**:
   - Criar cobrança
   - Pagar via InfinitePay
   - Verificar se retorno captura todos os parâmetros
   - Verificar se status é atualizado para "pago"

2. **Teste sem parâmetros (fallback)**:
   - Simular redirect só com `?payment=success`
   - Verificar se forceUpdate funciona como backup

3. **Logs esperados**:
   ```
   🔍 Consultando status via endpoint público InfinitePay
   📊 Resposta InfinitePay: {"success": true, "paid": true, ...}
   ✅ Pagamento confirmado via endpoint público
   ```

