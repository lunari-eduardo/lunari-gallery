
# Correcao do Fluxo de Checkout Asaas

## Problema Principal

A API do Asaas **nao retorna `invoiceUrl` na resposta de criacao de assinatura**. O `invoiceUrl` existe apenas no objeto de **pagamento** (payment) gerado pela assinatura. Por isso `asaasData.invoiceUrl` e sempre `undefined`, e o modal exibe o toast "Assinatura criada!" sem redirecionar.

## Problema Secundario

Todas as 3 Edge Functions autenticadas usam `supabase.auth.getClaims()`, que **nao existe** na API do Supabase JS. O metodo correto e `supabase.auth.getUser()`. Isso provavelmente funciona no sandbox por coincidencia mas vai falhar em producao.

---

## Correcoes Necessarias

### 1. Edge Function `asaas-create-subscription/index.ts`

Apos criar a assinatura, buscar o primeiro pagamento gerado para obter o `invoiceUrl`:

```text
1. Criar assinatura via POST /v3/subscriptions
2. Buscar pagamentos da assinatura via GET /v3/subscriptions/{id}/payments
3. Pegar invoiceUrl do primeiro pagamento retornado
4. Retornar invoiceUrl na resposta
```

Tambem corrigir autenticacao: trocar `getClaims()` por `getUser()`.

### 2. Edge Function `asaas-create-customer/index.ts`

Corrigir autenticacao: trocar `getClaims()` por `getUser()`.

### 3. Edge Function `asaas-cancel-subscription/index.ts`

Corrigir autenticacao: trocar `getClaims()` por `getUser()`.

### 4. Frontend `AsaasCheckoutModal.tsx`

Ajustar o fluxo para redirecionar automaticamente quando `invoiceUrl` existir (abrir direto em nova aba), sem exigir um segundo clique. O step "redirect" serve como fallback caso o popup seja bloqueado.

---

## Detalhes Tecnicos

### Correcao de Auth (todas as 3 Edge Functions)

Substituir:
```typescript
const { data: claims, error: claimsError } = await supabase.auth.getClaims(
  authHeader.replace("Bearer ", "")
);
if (claimsError || !claims?.claims) { ... }
const userId = claims.claims.sub as string;
```

Por:
```typescript
const { data: { user }, error: userError } = await supabase.auth.getUser();
if (userError || !user) { ... }
const userId = user.id;
```

### Correcao do invoiceUrl (asaas-create-subscription)

Apos `const asaasData = await asaasResponse.json()`, adicionar:

```typescript
// Buscar o primeiro pagamento gerado para obter invoiceUrl
let invoiceUrl = null;
try {
  const paymentsResponse = await fetch(
    `${ASAAS_BASE_URL}/v3/subscriptions/${asaasData.id}/payments?limit=1`,
    {
      headers: { access_token: ASAAS_API_KEY },
    }
  );
  const paymentsData = await paymentsResponse.json();
  if (paymentsData.data && paymentsData.data.length > 0) {
    invoiceUrl = paymentsData.data[0].invoiceUrl;
  }
} catch (e) {
  console.error("Error fetching payment invoiceUrl:", e);
}
```

E retornar `invoiceUrl` em vez de `asaasData.invoiceUrl`.

### Correcao do Frontend (AsaasCheckoutModal)

Quando `invoiceUrl` existir, abrir automaticamente:

```typescript
if (result.invoiceUrl) {
  window.open(result.invoiceUrl, '_blank');
  setInvoiceUrl(result.invoiceUrl);
  setStep('redirect');
} else {
  toast.success('Assinatura criada! Aguardando confirmação de pagamento.');
  onOpenChange(false);
}
```

---

## Arquivos Modificados

| Arquivo | Mudanca |
|---|---|
| `supabase/functions/asaas-create-subscription/index.ts` | Buscar invoiceUrl do payment + corrigir auth |
| `supabase/functions/asaas-create-customer/index.ts` | Corrigir auth (getClaims -> getUser) |
| `supabase/functions/asaas-cancel-subscription/index.ts` | Corrigir auth (getClaims -> getUser) |
| `src/components/credits/AsaasCheckoutModal.tsx` | Auto-redirect com window.open |
