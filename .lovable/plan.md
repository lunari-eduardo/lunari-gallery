
# Plano de Correção: Valor Foto Extra Zerado

## Problema Identificado

Na galeria com PIX Manual, o campo "Valor por extra" mostra **R$ 0,00** porque:

1. **Em `pricingUtils.ts`**: Quando `extrasNovas = 0` (todas as extras já foram pagas), a função retorna `valorUnitario: 0` em vez de mostrar o preço real
2. **Em `GalleryCreate.tsx`**: Ao salvar galeria com precificação progressiva, usa `regrasCongeladas.pacote.valorFotoExtra` que é 0 quando o modelo é por tabela

## Solução Proposta

Usar cálculo direto: **valor_já_pago ÷ quantidade_extras_pagas** para exibir o preço médio real pago pelo cliente.

---

## Arquivo 1: `src/lib/pricingUtils.ts`

### Mudança: Linhas 257-270

Substituir o retorno zerado por cálculo do preço unitário real:

```typescript
// ANTES (linhas 257-270):
// Normalize fallback value
const fallbackNormalizado = normalizarValor(valorFotoExtraFixo);

// Default result for no new extras
if (extrasNovas <= 0 || totalExtras <= 0) {
  return {
    valorUnitario: 0,  // ← PROBLEMA: sempre retorna 0
    valorACobrar: 0,
    valorTotalIdeal: valorJaPago,
    economia: 0,
    totalExtras: extrasPagasTotal,
    modeloUsado: 'fixo',
  };
}

// DEPOIS:
// Normalize fallback value
const fallbackNormalizado = normalizarValor(valorFotoExtraFixo);

// Default result for no new extras - but still show correct unit price for display
if (extrasNovas <= 0 || totalExtras <= 0) {
  // Calculate unit price for display even when there's nothing new to charge
  // Use the average price paid (valorJaPago / extrasPagasTotal) for accuracy
  let displayUnitPrice = fallbackNormalizado;
  
  if (extrasPagasTotal > 0 && valorJaPago > 0) {
    // Best approach: use actual average price paid
    displayUnitPrice = valorJaPago / extrasPagasTotal;
  } else if (regrasCongeladas?.precificacaoFotoExtra) {
    // Fallback: look up the tier price for previously paid quantity
    const regras = regrasCongeladas.precificacaoFotoExtra;
    const qtdParaFaixa = extrasPagasTotal > 0 ? extrasPagasTotal : 1;
    
    if (regras.modelo === 'global' && regras.tabelaGlobal?.faixas) {
      const faixa = encontrarFaixaPreco(qtdParaFaixa, regras.tabelaGlobal.faixas);
      if (faixa?.valor) displayUnitPrice = normalizarValor(faixa.valor);
    } else if (regras.modelo === 'categoria' && regras.tabelaCategoria?.faixas && !regras.tabelaCategoria.usar_valor_fixo_pacote) {
      const faixa = encontrarFaixaPreco(qtdParaFaixa, regras.tabelaCategoria.faixas);
      if (faixa?.valor) displayUnitPrice = normalizarValor(faixa.valor);
    } else {
      // Fixed pricing model
      const valorPacote = regrasCongeladas.pacote?.valorFotoExtra;
      if (valorPacote && valorPacote > 0) displayUnitPrice = normalizarValor(valorPacote);
    }
  }
  
  return {
    valorUnitario: displayUnitPrice,  // ← CORRIGIDO: preço médio real
    valorACobrar: 0,
    valorTotalIdeal: valorJaPago,
    economia: 0,
    totalExtras: extrasPagasTotal,
    modeloUsado: 'fixo',
  };
}
```

---

## Arquivo 2: `src/pages/GalleryCreate.tsx`

### Mudança 1: Adicionar helper após imports (após linha 36)

```typescript
// Helper to extract the initial extra photo price from frozen rules
// Handles progressive pricing by getting the first tier price
function getInitialExtraPrice(regras: RegrasCongeladas | null): number {
  if (!regras) return 0;
  
  const precificacao = regras.precificacaoFotoExtra;
  
  // Fixed model: use package price
  if (!precificacao || precificacao.modelo === 'fixo') {
    return regras.pacote?.valorFotoExtra || 0;
  }
  
  // Global model: get first tier price
  if (precificacao.modelo === 'global' && precificacao.tabelaGlobal?.faixas?.length) {
    const sortedFaixas = [...precificacao.tabelaGlobal.faixas].sort((a, b) => a.min - b.min);
    return sortedFaixas[0]?.valor || regras.pacote?.valorFotoExtra || 0;
  }
  
  // Category model: check if should use fixed price
  if (precificacao.modelo === 'categoria') {
    if (precificacao.tabelaCategoria?.usar_valor_fixo_pacote) {
      return regras.pacote?.valorFotoExtra || 0;
    }
    if (precificacao.tabelaCategoria?.faixas?.length) {
      const sortedFaixas = [...precificacao.tabelaCategoria.faixas].sort((a, b) => a.min - b.min);
      return sortedFaixas[0]?.valor || regras.pacote?.valorFotoExtra || 0;
    }
  }
  
  // Fallback
  return regras.pacote?.valorFotoExtra || 0;
}
```

### Mudança 2: Linha ~500-504 (handleNext - criar galeria)

```typescript
// ANTES:
valorFotoExtra: saleMode !== 'no_sale' 
  ? (isAssistedMode && regrasCongeladas && !overridePricing 
      ? regrasCongeladas.pacote?.valorFotoExtra || 0  // ← PROBLEMA
      : fixedPrice)
  : 0,

// DEPOIS:
valorFotoExtra: saleMode !== 'no_sale' 
  ? (isAssistedMode && regrasCongeladas && !overridePricing 
      ? getInitialExtraPrice(regrasCongeladas)  // ← CORRIGIDO
      : fixedPrice)
  : 0,
```

### Mudança 3: Linha ~557 (handleSaveDraft)

```typescript
// ANTES:
valorFotoExtra: saleMode !== 'no_sale' ? fixedPrice : 0,

// DEPOIS:
valorFotoExtra: saleMode !== 'no_sale' 
  ? (isAssistedMode && regrasCongeladas && !overridePricing 
      ? getInitialExtraPrice(regrasCongeladas) 
      : fixedPrice)
  : 0,
```

### Mudança 4: Linha ~589 (handleSaveDraft - criar novo)

```typescript
// ANTES:
valorFotoExtra: saleMode !== 'no_sale' ? fixedPrice : 0,

// DEPOIS:
valorFotoExtra: saleMode !== 'no_sale' 
  ? (isAssistedMode && regrasCongeladas && !overridePricing 
      ? getInitialExtraPrice(regrasCongeladas) 
      : fixedPrice)
  : 0,
```

---

## Lógica de Prioridade para Exibição

| Cenário | Valor Exibido |
|---------|---------------|
| Cliente pagou extras | `valorJaPago ÷ extrasPagasTotal` (média real) |
| Sem pagamentos, modelo tabela | Preço da faixa atual baseado na quantidade |
| Sem pagamentos, modelo fixo | `pacote.valorFotoExtra` |
| Fallback | `extraPhotoPrice` da galeria |

## Exemplo Prático

**Galeria "Teste":**
- Cliente pagou R$ 12,00 por 4 extras
- `valorUnitario = 12 / 4 = R$ 3,00` ← Preço médio real

**Nova galeria via Gestão:**
- Tabela categoria: [1-2: R$5, 3-4: R$3, 5+: R$2]
- `valorFotoExtra = R$ 5,00` (primeira faixa) salvo no banco

---

## Resumo das Correções

| Problema | Arquivo | Solução |
|----------|---------|---------|
| valorUnitario = 0 quando sem novas extras | pricingUtils.ts | Calcular média (valor_pago / qtd) |
| valor_foto_extra = 0 ao criar galeria | GalleryCreate.tsx | Usar primeira faixa da tabela |
