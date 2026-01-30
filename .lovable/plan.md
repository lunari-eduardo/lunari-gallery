
# Plano: Corrigir Redirecionamento para Checkout do Mercado Pago

## Problema Identificado

A galeria é finalizada sem redirecionar para o checkout porque a função `confirm-selection` espera campos com nomes diferentes dos que `mercadopago-create-link` retorna.

### Mapeamento Atual (Incorreto)

| O que `confirm-selection` busca | O que `mercadopago-create-link` retorna | Resultado |
|--------------------------------|----------------------------------------|-----------|
| `paymentData.paymentLink` | `checkout_url` | **undefined** |
| `paymentData.cobranca?.id` | `cobranca_id` | **undefined** |

### Consequência

O código na linha 370-372 resulta em:
```javascript
const checkoutUrl = undefined;  // Campo errado lido!
paymentResponse = { checkoutUrl: undefined, ... }
```

E na resposta final (linha 541-543):
```javascript
requiresPayment: true,           // há pagamento pendente
checkoutUrl: undefined,          // mas a URL é undefined!
```

O frontend em `ClientGallery.tsx` (linha 421) verifica:
```javascript
if (data.requiresPayment && data.checkoutUrl) {
  // Nunca entra aqui porque checkoutUrl é undefined!
}
```

E cai direto no else (linha 434-438):
```javascript
// Sem pagamento - vai para 'confirmed' ao invés de 'payment'
setCurrentStep('confirmed');
```

---

## Solução

Existem duas opções:

### Opção A: Alterar `mercadopago-create-link` (Recomendada)
Padronizar a resposta para usar camelCase igual ao `infinitepay-create-link`:
- `checkout_url` → `checkoutUrl`
- `cobranca_id` → `cobrancaId`
- Adicionar campo `paymentLink` como alias

### Opção B: Alterar `confirm-selection`
Corrigir os campos que são lidos para usar os nomes corretos:
- `paymentData.paymentLink` → `paymentData.checkout_url`
- `paymentData.cobranca?.id` → `paymentData.cobranca_id`

**Escolha: Opção A** - Padroniza as respostas entre provedores e é mais fácil de manter.

---

## Mudanças Técnicas

### Arquivo: `supabase/functions/mercadopago-create-link/index.ts`

Alterar a resposta de sucesso do checkout (linhas 351-360):

```text
ANTES:
┌─────────────────────────────────────────────────────────────┐
│ return new Response(JSON.stringify({                        │
│   success: true,                                            │
│   preference_id: preferenceData.id,                         │
│   payment_method: paymentMethod || 'checkout',              │
│   checkout_url: preferenceData.init_point,                  │ ← snake_case
│   sandbox_url: preferenceData.sandbox_init_point,           │
│   cobranca_id: cobrancaId,                                  │ ← snake_case
│ }))                                                         │
└─────────────────────────────────────────────────────────────┘

DEPOIS:
┌─────────────────────────────────────────────────────────────┐
│ return new Response(JSON.stringify({                        │
│   success: true,                                            │
│   preference_id: preferenceData.id,                         │
│   payment_method: paymentMethod || 'checkout',              │
│   checkoutUrl: preferenceData.init_point,                   │ ← camelCase
│   paymentLink: preferenceData.init_point,                   │ ← alias (compatibilidade)
│   sandbox_url: preferenceData.sandbox_init_point,           │
│   cobrancaId: cobrancaId,                                   │ ← camelCase
│   cobranca: { id: cobrancaId },                             │ ← alias (compatibilidade)
│   provedor: 'mercadopago',                                  │ ← identificação clara
│ }))                                                         │
└─────────────────────────────────────────────────────────────┘
```

Também alterar a resposta PIX (linhas 264-275) para seguir o mesmo padrão:
- Adicionar `cobrancaId` e `cobranca: { id: ... }` como aliases
- Adicionar `provedor: 'mercadopago'`

---

## Validação do Fluxo Completo

Após a correção, o fluxo será:

```text
1. Cliente confirma seleção
          ↓
2. ClientGallery.tsx → confirmMutation
          ↓
3. confirm-selection → mercadopago-create-link
          ↓
4. mercadopago-create-link retorna:
   {
     success: true,
     checkoutUrl: "https://mercadopago.com.br/checkout/...",
     paymentLink: "https://mercadopago.com.br/checkout/...",
     cobrancaId: "uuid...",
     cobranca: { id: "uuid..." },
     provedor: "mercadopago"
   }
          ↓
5. confirm-selection (linha 372):
   paymentData.paymentLink = "https://..." ✓
   paymentData.cobranca?.id = "uuid..." ✓
          ↓
6. confirm-selection retorna:
   {
     requiresPayment: true,
     checkoutUrl: "https://mercadopago.com.br/checkout/...",
     ...
   }
          ↓
7. ClientGallery.tsx (linha 421):
   if (data.requiresPayment && data.checkoutUrl) { ✓
     setPaymentInfo({ checkoutUrl: ... })
     setCurrentStep('payment')  ← Mostra tela de redirecionamento!
   }
          ↓
8. PaymentRedirect → Redireciona para Mercado Pago
```

---

## Arquivos a Modificar

1. **`supabase/functions/mercadopago-create-link/index.ts`**:
   - Linhas 351-360: Padronizar campos da resposta de checkout para camelCase
   - Linhas 264-275: Padronizar campos da resposta PIX para camelCase
   - Adicionar aliases para compatibilidade retroativa

---

## Benefícios

1. **Correção imediata**: O checkout redirecionará corretamente
2. **Compatibilidade retroativa**: Aliases mantêm código legado funcionando
3. **Consistência**: Mesma estrutura de resposta entre InfinitePay e Mercado Pago
4. **Facilidade de debug**: Campo `provedor` explícito na resposta
