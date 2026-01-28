
# Plano: Correção da Lógica de Precificação Progressiva

## Diagnóstico do Problema

### Comportamento Atual (Incorreto)

| Ciclo | Extras | Faixa Usada | Cálculo | Cobrado |
|-------|--------|-------------|---------|---------|
| 1º | 1 foto | 1-2 (R$ 5) | 1 × R$ 5 | R$ 5 |
| 2º | +2 fotos (total 3) | 3-4 (R$ 3) | **2 × R$ 3** | R$ 6 |
| **Total** | 3 fotos | | | **R$ 11** |

### Comportamento Esperado (Correto)

| Ciclo | Extras | Faixa Usada | Cálculo | Cobrado |
|-------|--------|-------------|---------|---------|
| 1º | 1 foto | 1-2 (R$ 5) | 1 × R$ 5 | R$ 5 |
| 2º | +2 fotos (total 3) | 3-4 (R$ 3) | **3 × R$ 3 - R$ 5** | R$ 4 |
| **Total** | 3 fotos | | | **R$ 9** |

### A Diferença

- **ANTES**: Usa faixa do total acumulado, mas cobra apenas `novas_extras × valor_faixa`
- **DEPOIS**: Calcula `total_extras × valor_faixa_nova - valor_já_pago`

Isso garante que o cliente pague o **mesmo valor final** independente de quantas vezes reabrir a galeria.

---

## Fórmula Correta

```text
valor_a_cobrar = (total_extras_acumuladas × valor_faixa_nova) - valor_já_pago_total

Onde:
- total_extras_acumuladas = extras_já_pagas + extras_novas
- valor_faixa_nova = preço unitário da faixa correspondente ao total_extras_acumuladas
- valor_já_pago_total = soma de todos os pagamentos anteriores de extras
```

### Exemplo Prático

Faixas de preço:
| Faixa | Min | Max | Valor/Foto |
|-------|-----|-----|------------|
| 1 | 1 | 2 | R$ 5,00 |
| 2 | 3 | 4 | R$ 3,00 |
| 3 | 5 | ∞ | R$ 2,00 |

Cenário: Cliente com 1 extra paga (R$ 5), seleciona mais 2:
```text
total_extras = 1 + 2 = 3
faixa_nova = faixa 2 (R$ 3,00)
valor_total_ideal = 3 × R$ 3,00 = R$ 9,00
valor_já_pago = R$ 5,00
valor_a_cobrar = R$ 9,00 - R$ 5,00 = R$ 4,00
```

---

## Arquivos a Modificar

| # | Arquivo | Alteração |
|---|---------|-----------|
| 1 | `src/lib/pricingUtils.ts` | Nova função `calcularPrecoProgressivoComCredito()` |
| 2 | `supabase/functions/confirm-selection/index.ts` | Usar nova fórmula de cálculo |
| 3 | `src/pages/ClientGallery.tsx` | Usar nova função para exibição correta |
| 4 | `src/components/SelectionSummary.tsx` | Exibir breakdown detalhado |

---

## Detalhes Técnicos

### 1. Nova Função em `pricingUtils.ts`

```typescript
/**
 * Calculates progressive pricing with credit system
 * 
 * Formula: valor_a_cobrar = (total_extras × valor_faixa) - valor_já_pago
 * 
 * This ensures the client always pays the same total regardless of how many
 * selection cycles they go through.
 */
export function calcularPrecoProgressivoComCredito(
  extrasNovas: number,           // New extras selected in this cycle
  extrasPagasTotal: number,       // Extras already paid from previous cycles
  valorJaPago: number,            // Total amount already paid for extras
  regrasCongeladas: RegrasCongeladas | null | undefined,
  valorFotoExtraFixo: number
): {
  valorUnitario: number;          // Unit price from the tier
  valorACobrar: number;           // Amount to charge this cycle
  valorTotalIdeal: number;        // What total would cost if bought at once
  economia: number;               // Savings vs base price
  totalExtras: number;            // Total accumulated extras
} {
  // Calculate total accumulated extras
  const totalExtras = extrasPagasTotal + extrasNovas;
  
  // If no new extras, nothing to charge
  if (extrasNovas <= 0) {
    return {
      valorUnitario: 0,
      valorACobrar: 0,
      valorTotalIdeal: valorJaPago,
      economia: 0,
      totalExtras: extrasPagasTotal
    };
  }
  
  // Find the tier based on TOTAL accumulated extras
  const valorUnitario = encontrarValorNaFaixa(totalExtras, regras);
  
  // Calculate what the total WOULD cost if bought all at once
  const valorTotalIdeal = totalExtras * valorUnitario;
  
  // Subtract what was already paid
  const valorACobrar = Math.max(0, valorTotalIdeal - valorJaPago);
  
  return {
    valorUnitario,
    valorACobrar,
    valorTotalIdeal,
    economia: /* calculate savings vs base price */,
    totalExtras
  };
}
```

### 2. Edge Function `confirm-selection/index.ts`

```typescript
// BEFORE (incorrect):
const resultado = calcularPrecoProgressivo(
  extrasACobrar,           // Only new extras
  regras, 
  fallbackPrice,
  totalExtrasAcumuladas    // For tier lookup
);
valorTotal = resultado.valorTotal; // = extrasACobrar × valorFaixa

// AFTER (correct):
const resultado = calcularPrecoProgressivoComCredito(
  extrasACobrar,                    // New extras to add
  extrasPagasTotal,                 // Previously paid extras count
  gallery.valor_total_vendido || 0, // Previously paid amount
  regras,
  fallbackPrice
);
valorTotal = resultado.valorACobrar; // = (total × valorFaixa) - valorJaPago
```

### 3. Frontend `ClientGallery.tsx`

```typescript
// Use new function for display
const { 
  valorUnitario, 
  valorACobrar, 
  valorTotalIdeal,
  totalExtras 
} = calcularPrecoProgressivoComCredito(
  extrasACobrar,
  extrasPagasTotal,
  supabaseGallery?.valor_total_vendido || 0,
  regrasCongeladas,
  gallery.extraPhotoPrice
);

// Pass to SelectionSummary
<SelectionSummary
  valorACobrar={valorACobrar}        // What to charge now
  valorTotalIdeal={valorTotalIdeal}  // Total if bought at once
  valorJaPago={supabaseGallery?.valor_total_vendido || 0}
  // ...
/>
```

---

## Fluxo Visual Corrigido

```text
┌────────────────────────────────────────────────────────────────────┐
│ CENÁRIO: Faixas 1-2=R$5, 3-4=R$3, 5+=R$2                           │
│          Cliente com 1 extra paga (R$5), seleciona +2              │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│ 1. Dados Iniciais:                                                 │
│    ├── extrasPagasTotal = 1                                        │
│    ├── valorJaPago = R$ 5,00                                       │
│    └── extrasNovas = 2                                             │
│                                                                    │
│ 2. Cálculo ANTES (Incorreto):                                      │
│    ├── totalExtras = 3                                             │
│    ├── Faixa = 3-4 (R$ 3,00)                                       │
│    ├── Cobrança = 2 × R$ 3,00 = R$ 6,00  ❌                        │
│    └── Total final = R$ 5 + R$ 6 = R$ 11,00                        │
│                                                                    │
│ 3. Cálculo DEPOIS (Correto):                                       │
│    ├── totalExtras = 3                                             │
│    ├── Faixa = 3-4 (R$ 3,00)                                       │
│    ├── valorTotalIdeal = 3 × R$ 3,00 = R$ 9,00                     │
│    ├── valorJaPago = R$ 5,00                                       │
│    ├── Cobrança = R$ 9,00 - R$ 5,00 = R$ 4,00  ✅                  │
│    └── Total final = R$ 9,00 (mesmo que comprando tudo de uma vez) │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## Cenários de Teste

| Cenário | 1º Ciclo | 2º Ciclo | Total Extras | Valor Correto |
|---------|----------|----------|--------------|---------------|
| 1 + 2 = 3 extras | 1 × R$5 = R$5 | (3×R$3) - R$5 = R$4 | 3 | R$ 9 |
| 2 + 2 = 4 extras | 2 × R$5 = R$10 | (4×R$3) - R$10 = R$2 | 4 | R$ 12 |
| 2 + 3 = 5 extras | 2 × R$5 = R$10 | (5×R$2) - R$10 = R$0 | 5 | R$ 10 |
| 1 + 1 + 1 = 3 extras | R$5 → R$10 → (3×R$3)-R$10 = -R$1 = R$0 | | 3 | R$ 10 |

**Nota**: No último cenário, o cliente pagou mais do que deveria (R$10 vs R$9), então na 3ª seleção não paga nada (crédito excedente).

---

## Consideração Importante

O valor "economia" mostrado ao cliente deve ser calculado comparando com o preço base (primeira faixa), não com o que ele pagou anteriormente. Isso mostra quanto ele economizou comprando em volume.

```typescript
const precoBase = regrasCongeladas?.pacote?.valorFotoExtra || valorFotoExtraFixo;
const valorSemDesconto = totalExtras * precoBase; // Ex: 3 × R$5 = R$15
const economia = valorSemDesconto - valorTotalIdeal; // Ex: R$15 - R$9 = R$6
```

---

## Resumo das Alterações

1. **pricingUtils.ts**: Criar função `calcularPrecoProgressivoComCredito()` com lógica correta
2. **confirm-selection Edge Function**: Usar nova fórmula: `(total × faixa) - já_pago`
3. **ClientGallery.tsx**: Passar `valor_total_vendido` para cálculo correto
4. **SelectionSummary.tsx**: Exibir breakdown: "Valor total: R$9 - Já pago: R$5 = A pagar: R$4"
