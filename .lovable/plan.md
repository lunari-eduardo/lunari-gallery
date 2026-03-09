

## Diagnóstico: `incluirTaxaAntecipacao` não chega ao checkout

### Causa raiz

As duas edge functions que montam o `asaasCheckoutData` para o frontend **não incluem** o campo `incluirTaxaAntecipacao`:

1. **`supabase/functions/confirm-selection/index.ts`** (linha 382-402) — monta o objeto com campos legados (`taxaAntecipacao`, `taxaAntecipacaoPercentual`, etc.) mas **não inclui** `incluirTaxaAntecipacao`.

2. **`supabase/functions/gallery-access/index.ts`** (linha 255-275) — mesmo problema.

O frontend (`AsaasCheckout.tsx` linha 289) faz:
```typescript
const incluirAntecipacao = data.incluirTaxaAntecipacao !== false;
```
Como o valor chega como `undefined`, a condição resulta em `true` — **sempre inclui antecipação**, independente da configuração.

### Correção

Adicionar `incluirTaxaAntecipacao: s.incluirTaxaAntecipacao ?? true` nos dois locais:

#### 1. `supabase/functions/confirm-selection/index.ts` (~linha 397)
Adicionar ao objeto `asaasCheckoutData`:
```typescript
incluirTaxaAntecipacao: asaasSettings.incluirTaxaAntecipacao ?? true,
```

#### 2. `supabase/functions/gallery-access/index.ts` (~linha 270)
Adicionar ao objeto `asaasCheckoutData`:
```typescript
incluirTaxaAntecipacao: s.incluirTaxaAntecipacao ?? true,
```

### Impacto
- Correção cirúrgica — 1 linha adicionada em cada função
- Edge functions de InfinitePay não são tocadas
- `asaas-gallery-payment` já lê corretamente de `settings.incluirTaxaAntecipacao` (linha 201) — sem mudanças necessárias
- Retrocompatível: default `true` mantém comportamento atual para quem não configurou

