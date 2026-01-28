
# Plano: Correção do SelectionConfirmation para usar Sistema de Crédito

## Diagnóstico do Problema

A tela do fotógrafo (`GalleryDetail.tsx`) está mostrando os valores corretos porque usa `calcularPrecoProgressivoComCredito`. Porém, a tela do cliente (`SelectionConfirmation.tsx`) ainda usa a função antiga `calcularPrecoProgressivo`, resultando em:

| Componente | Função Usada | Valor Calculado |
|------------|--------------|-----------------|
| GalleryDetail.tsx (fotógrafo) | `calcularPrecoProgressivoComCredito` | R$ 4,00 ✅ |
| SelectionConfirmation.tsx (cliente) | `calcularPrecoProgressivo` | R$ 10,00 ❌ |

### Problema Específico no Código

```typescript
// SelectionConfirmation.tsx - Linha 45-49 (INCORRETO)
const { valorUnitario, valorTotal, economia } = calcularPrecoProgressivo(
  extrasACobrar,           // Usa apenas novas extras
  regrasCongeladas,
  gallery.extraPhotoPrice
);
// Resultado: 2 fotos × R$ 5,00 = R$ 10,00 (ERRADO)
```

**Falta:**
1. O import da função `calcularPrecoProgressivoComCredito`
2. A prop `valorJaPago` (valor já pago anteriormente)
3. A chamada correta da nova função com sistema de crédito

---

## Solução

### Alterações em `SelectionConfirmation.tsx`

#### 1. Adicionar nova prop `valorJaPago`

```typescript
interface SelectionConfirmationProps {
  // ... props existentes
  valorJaPago: number; // NOVO: Valor já pago anteriormente (R$)
}
```

#### 2. Trocar import e usar função correta

```typescript
// ANTES
import { calcularPrecoProgressivo, RegrasCongeladas } from '@/lib/pricingUtils';

// DEPOIS
import { calcularPrecoProgressivoComCredito, RegrasCongeladas } from '@/lib/pricingUtils';
```

#### 3. Atualizar cálculo para usar sistema de crédito

```typescript
// ANTES (linha 45-49)
const { valorUnitario, valorTotal, economia } = calcularPrecoProgressivo(
  extrasACobrar,
  regrasCongeladas,
  gallery.extraPhotoPrice
);

// DEPOIS
const { 
  valorUnitario, 
  valorACobrar,      // Valor a cobrar com crédito descontado
  valorTotalIdeal,   // Valor total ideal (sem crédito)
  economia,
  totalExtras 
} = calcularPrecoProgressivoComCredito(
  extrasACobrar,              // Novas extras neste ciclo
  extrasPagasAnteriormente,   // Extras já pagas
  valorJaPago,                // Valor já pago (R$)
  regrasCongeladas,
  gallery.extraPhotoPrice
);
```

#### 4. Atualizar priceInfo para usar valores corretos

```typescript
const priceInfo = {
  chargeableCount: extrasACobrar,
  total: valorACobrar,         // Usar valorACobrar (com crédito)
  pricePerPhoto: valorUnitario,
  valorTotalIdeal,             // Para exibir breakdown
  valorJaPago,                 // Para exibir breakdown
  totalExtras,                 // Total acumulado
};
```

### Alterações em `ClientGallery.tsx`

Passar a nova prop `valorJaPago`:

```typescript
<SelectionConfirmation
  gallery={gallery}
  photos={localPhotos}
  selectedCount={selectedCount}
  extraCount={extraCount}
  extrasACobrar={extrasACobrar}
  extrasPagasAnteriormente={extrasPagasTotal}
  valorJaPago={valorJaPago}   // NOVO: Passar valor já pago
  regrasCongeladas={regrasCongeladas}
  // ... outras props
/>
```

---

## UI Atualizada (Opcional)

Mostrar breakdown detalhado quando houver valor já pago:

```typescript
{valorJaPago > 0 && (
  <>
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">Valor total ({totalExtras} fotos)</span>
      <span className="font-medium">R$ {valorTotalIdeal.toFixed(2)}</span>
    </div>
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">Já pago</span>
      <span className="font-medium text-muted-foreground">-R$ {valorJaPago.toFixed(2)}</span>
    </div>
  </>
)}
```

---

## Arquivos a Modificar

| # | Arquivo | Alteração |
|---|---------|-----------|
| 1 | `src/components/SelectionConfirmation.tsx` | Adicionar prop `valorJaPago`, trocar para `calcularPrecoProgressivoComCredito`, atualizar exibição |
| 2 | `src/pages/ClientGallery.tsx` | Passar prop `valorJaPago` |

---

## Resultado Esperado

### Cenário: 3 extras totais, 1 já paga (R$ 5), 2 novas a cobrar

| Campo | Antes (Incorreto) | Depois (Correto) |
|-------|-------------------|------------------|
| Valor por foto | R$ 5,00 | R$ 3,00 |
| Cálculo | 2 × R$ 5 | (3 × R$ 3) - R$ 5 |
| Valor Adicional | R$ 10,00 | R$ 4,00 |

A tela do cliente agora mostrará o mesmo valor que a tela do fotógrafo: **R$ 4,00**
