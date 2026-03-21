

# Fix: `confirm-payment-manual` retorna 500 sem logs

## Causa raiz

A função usa `supabaseAuth.auth.getClaims(token)` — um método introduzido em `auth-js` v2.69.0 (fev 2025). O import `@supabase/supabase-js@2` via esm.sh pode resolver para uma versão que não tem esse método, ou o método falha silenciosamente no runtime Deno, causando crash sem logs.

Zero logs (nem boot) confirma que a função crasheia antes de qualquer `console.log`.

## Plano

### 1. Substituir `getClaims` por `getUser()` — abordagem universal

**Arquivo**: `supabase/functions/confirm-payment-manual/index.ts`

Trocar o bloco de autenticação JWT:

```typescript
// ANTES (crasheia):
const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
const authenticatedUserId = claimsData.claims.sub as string;

// DEPOIS (funciona em qualquer versão):
const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);
if (userError || !user) {
  return Response 401...
}
const authenticatedUserId = user.id;
```

### 2. Adicionar logs detalhados em cada etapa

Envolver toda a lógica com logs granulares:
- `🚀 confirm-payment-manual started` com body recebido
- `🔐 Auth validated: userId`
- `📝 Creating manual cobrança` ou `📋 Fetching cobrança: id`
- `🔄 Calling RPC finalize_gallery_payment`
- `✅ RPC result: ...`
- No catch final: retornar `error.message` e `error.stack` no JSON de resposta

### 3. Melhorar o catch do frontend

**Arquivo**: `src/components/PaymentStatusCard.tsx`

Quando `response.error` existe, o SDK do Supabase encapsula o corpo. Extrair a mensagem real:

```typescript
// O supabase.functions.invoke retorna error como FunctionsHttpError
// que tem .context com o body JSON da response
const errorBody = response.error?.context;
const errorMessage = errorBody?.error || response.error?.message || 'Erro desconhecido';
```

## Arquivos a editar

| Arquivo | Mudança |
|---|---|
| `supabase/functions/confirm-payment-manual/index.ts` | Trocar `getClaims` por `getUser`; adicionar logs detalhados em cada etapa; retornar erro real no catch |
| `src/components/PaymentStatusCard.tsx` | Extrair mensagem de erro real do context da response |

