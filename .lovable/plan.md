

# Sincronizar Configurações de Taxas Asaas: Gallery ↔ Gestão

## Contexto

O Gestão introduziu dois campos mais granulares no `dados_extras` do Asaas:
- `ireiAntecipar` — "Vou antecipar recebíveis?"
- `repassarTaxaAntecipacao` — "Repassar custo ao cliente?"

O Gallery usa apenas `incluirTaxaAntecipacao` (legacy). Precisa ler os campos novos com fallback.

## Alterações

### 1. Interface `AsaasData` — `usePaymentIntegration.ts`

Adicionar os dois novos campos opcionais:
```typescript
ireiAntecipar?: boolean;
repassarTaxaAntecipacao?: boolean;
```

### 2. Interface `AsaasCheckoutData` — `AsaasCheckout.tsx`

Adicionar os mesmos dois campos opcionais à interface do checkout.

### 3. Lógica de antecipação — `AsaasCheckout.tsx` (linha ~290)

Substituir:
```typescript
const incluirAntecipacao = data.incluirTaxaAntecipacao !== false;
```
Por:
```typescript
const ireiAntecipar = data.ireiAntecipar ?? data.incluirTaxaAntecipacao ?? false;
const repassarAntecipacao = ireiAntecipar
  ? (data.repassarTaxaAntecipacao ?? data.incluirTaxaAntecipacao ?? false)
  : false;
const incluirAntecipacao = repassarAntecipacao;
```

### 4. Edge Functions — `gallery-access/index.ts` e `confirm-selection/index.ts`

Nos dois blocos `asaasCheckoutData`, adicionar:
```typescript
ireiAntecipar: s.ireiAntecipar ?? s.incluirTaxaAntecipacao ?? false,
repassarTaxaAntecipacao: s.repassarTaxaAntecipacao ?? s.incluirTaxaAntecipacao ?? false,
```

### 5. PaymentSettings.tsx — Toggles de antecipação Asaas

Substituir o toggle único "Incluir taxa de antecipação" por dois toggles hierárquicos:

1. **"Vou antecipar meus recebíveis"** (`ireiAntecipar`) — sempre visível quando `absorverTaxa = false`
2. **"Repassar taxa de antecipação ao cliente"** (`repassarTaxaAntecipacao`) — visível apenas quando `ireiAntecipar = true`

Ambos com auto-save (mesmo padrão do toggle existente). O campo legacy `incluirTaxaAntecipacao` continua sendo gravado como fallback.

Estado local: trocar `asaasIncluirAntecipacao` por `asaasIreiAntecipar` + `asaasRepassarAntecipacao`. Na leitura inicial, resolver hierarquia: `ireiAntecipar ?? incluirTaxaAntecipacao ?? false`.

### 6. `usePaymentIntegration.ts` — `updateAsaasSettings`

Já aceita `Partial<AsaasData>`, sem mudança necessária na mutation. Os novos campos serão enviados automaticamente.

## Arquivos a editar

| Arquivo | Mudança |
|---|---|
| `src/hooks/usePaymentIntegration.ts` | +2 campos na interface `AsaasData` |
| `src/components/AsaasCheckout.tsx` | +2 campos na interface + lógica de resolução |
| `src/components/settings/PaymentSettings.tsx` | Trocar toggle único por 2 toggles hierárquicos |
| `supabase/functions/gallery-access/index.ts` | +2 campos no `asaasCheckoutData` |
| `supabase/functions/confirm-selection/index.ts` | +2 campos no `asaasCheckoutData` |

