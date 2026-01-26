
## Plano de Correção: Fluxo InfinitePay no Gallery

### Diagnóstico Completo

Após análise detalhada dos logs e código, identifiquei **3 problemas críticos**:

---

### PROBLEMA 1: Interface de Resposta InfinitePay Incorreta

**Localização:** `supabase/functions/infinitepay-create-link/index.ts` (linhas 37-41, 162-163)

**Evidência nos logs:**
```
💳 InfinitePay API response body: {"url":"https://checkout.infinitepay.io/..."}
ERROR No checkout_url in InfinitePay response: { url: "https://checkout.infinitepay.io/..." }
```

**Causa:** A API InfinitePay retorna o campo `url`, mas o código (linha 162) procura `checkout_url`:

```typescript
// ATUAL (linha 37-41) - INCORRETO
interface InfinitePayResponse {
  checkout_url?: string;  // ❌ API retorna 'url'
  slug?: string;
  error?: string;
}

// ATUAL (linha 162) - INCORRETO
const checkoutUrl = infinitePayData.checkout_url;  // ❌ Deveria ser .url
```

**Correção:**
```typescript
// CORRIGIDO
interface InfinitePayResponse {
  url?: string;           // ✅ Campo correto da API
  checkout_url?: string;  // Fallback para compatibilidade
  slug?: string;
  error?: string;
}

// CORRIGIDO (linha 162)
const checkoutUrl = infinitePayData.url || infinitePayData.checkout_url;
```

---

### PROBLEMA 2: `paymentMethod` Não Incluído no saleSettings

**Localização:** `src/pages/ClientGallery.tsx` (linhas 275-281)

**Causa:** O campo `paymentMethod` não é extraído do `rawSettings`, fazendo com que a lógica de confirmação não saiba qual método de pagamento usar.

**Código atual:**
```typescript
return {
  mode: (rawSettings?.mode as ...) || 'sale_without_payment',
  pricingModel: (rawSettings?.pricingModel as ...) || 'fixed',
  chargeType: (rawSettings?.chargeType as ...) || 'only_extras',
  fixedPrice: (rawSettings?.fixedPrice as number) || ...,
  discountPackages: (rawSettings?.discountPackages as ...) || [],
  // ❌ paymentMethod NÃO ESTÁ AQUI
};
```

**Correção:**
```typescript
return {
  mode: (rawSettings?.mode as ...) || 'sale_without_payment',
  pricingModel: (rawSettings?.pricingModel as ...) || 'fixed',
  chargeType: (rawSettings?.chargeType as ...) || 'only_extras',
  fixedPrice: (rawSettings?.fixedPrice as number) || ...,
  discountPackages: (rawSettings?.discountPackages as ...) || [],
  paymentMethod: (rawSettings?.paymentMethod as 'pix_manual' | 'infinitepay' | 'mercadopago' | undefined),  // ✅ ADICIONAR
};
```

---

### PROBLEMA 3: Arquitetura de Chamada Alternativa (Opcional)

**Contexto do diagnóstico do usuário:**
O `confirm-selection` chama `infinitepay-create-link` diretamente passando `userId` no body. Isso funciona desde que:
1. O `userId` seja passado corretamente (linha 381 do `confirm-selection`)
2. A interface de resposta esteja correta (Problema 1)

A função `gallery-create-payment` existe como alternativa mas não está sendo utilizada pelo `confirm-selection`. O fluxo atual é:

```
ClientGallery → confirm-selection → infinitepay-create-link → InfinitePay API
```

**Verificação:** O `confirm-selection` (linha 381) já passa `userId: gallery.user_id`, então a arquitetura atual pode funcionar após corrigir o Problema 1.

---

## Arquivos a Modificar

| # | Arquivo | Problema | Correção |
|---|---------|----------|----------|
| 1 | `supabase/functions/infinitepay-create-link/index.ts` | Interface espera `checkout_url`, API retorna `url` | Atualizar interface (linhas 37-41) e uso (linha 162) |
| 2 | `src/pages/ClientGallery.tsx` | `paymentMethod` não incluído no saleSettings | Adicionar campo (linhas 275-281) |

---

## Detalhes das Correções

### Correção 1: `infinitepay-create-link/index.ts`

**Linhas 37-41 - Atualizar interface:**
```typescript
interface InfinitePayResponse {
  url?: string;           // Campo retornado pela API InfinitePay
  checkout_url?: string;  // Fallback para compatibilidade
  slug?: string;
  error?: string;
}
```

**Linhas 162-163 - Usar campo correto:**
```typescript
const checkoutUrl = infinitePayData.url || infinitePayData.checkout_url;
const invoiceSlug = infinitePayData.slug;
```

### Correção 2: `ClientGallery.tsx`

**Linhas 275-282 - Adicionar paymentMethod:**
```typescript
return {
  mode: (rawSettings?.mode as 'no_sale' | 'sale_with_payment' | 'sale_without_payment') || 'sale_without_payment',
  pricingModel: (rawSettings?.pricingModel as 'fixed' | 'packages') || 'fixed',
  chargeType: (rawSettings?.chargeType as 'all_selected' | 'only_extras') || 'only_extras',
  fixedPrice: (rawSettings?.fixedPrice as number) || (isEdgeFunctionFormat ? supabaseGallery.extraPhotoPrice : supabaseGallery.valor_foto_extra) || 25,
  discountPackages: (rawSettings?.discountPackages as DiscountPackage[]) || [],
  paymentMethod: (rawSettings?.paymentMethod as 'pix_manual' | 'infinitepay' | 'mercadopago' | undefined),
};
```

---

## Deploy Necessário

Após as correções, realizar deploy da Edge Function:
- `infinitepay-create-link`

---

## Fluxo Esperado Após Correções

```text
1. Cliente clica "Confirmar e Pagar"
2. ClientGallery chama confirm-selection
3. confirm-selection detecta saleMode = "sale_with_payment"
4. confirm-selection invoca infinitepay-create-link com userId
5. infinitepay-create-link busca handle do fotógrafo
6. infinitepay-create-link chama API InfinitePay
7. API retorna { "url": "https://checkout.infinitepay.io/..." }
8. infinitepay-create-link extrai checkoutUrl = response.url ✅
9. confirm-selection retorna { success: true, checkoutUrl: "..." }
10. ClientGallery recebe checkoutUrl → setPaymentInfo()
11. ClientGallery muda para step "payment" → PaymentRedirect
12. PaymentRedirect redireciona cliente para checkout InfinitePay
```

---

## Resumo

| Problema | Causa Raiz | Solução |
|----------|------------|---------|
| Sem redirecionamento | API retorna `url`, código busca `checkout_url` | Atualizar interface e uso |
| paymentMethod perdido | Campo não extraído no saleSettings | Adicionar ao objeto retornado |
