

## Diagnóstico e Correção da Barra de Desconto Progressivo

### Bugs encontrados

**Bug 1 — `totalExtras` errado passado ao `useDiscountAnalysis`**
Em `SelectionSummary.tsx` linha 59, o `totalExtras` vem de `calcularPrecoProgressivoComCredito`, que na linha 294 retorna `totalExtras: extrasPagasTotal` quando não há novas extras a cobrar. Ou seja, se o cliente já pagou por 10 extras antes, mesmo que agora selecione 0 extras, o `totalExtras` continua 10 → a análise de desconto mostra a faixa máxima.

**Correção**: Passar `extraCount` (extras da seleção atual = `selectedCount - includedPhotos`) ao `useDiscountAnalysis`, não o `totalExtras` de billing.

**Bug 2 — `showDiscountTiers` aparece sem extras**
Linha 65: `selectedCount >= includedPhotos` é true quando `selectedCount === includedPhotos` (0 extras). Deveria ser `>` (estritamente maior).

**Bug 3 — Emojis residuais**
O screenshot mostra emojis 🎉. Pode ser cache do deploy anterior, mas vou confirmar que não há nenhum emoji no código.

### Mudanças

**`src/components/SelectionSummary.tsx`**
- Criar `const currentExtras = Math.max(0, selectedCount - includedPhotos)` 
- Passar `currentExtras` ao `useDiscountAnalysis` em vez de `totalExtras`
- Mudar condição para `showDiscountTiers = discountAnalysis && currentExtras > 0`
- Passar `currentExtras` ao `InlineDiscountTiers` em vez de `totalExtras`

**`src/components/DiscountProgressBar.tsx`**
- Confirmar ausência de emojis
- Nenhuma mudança estrutural necessária (a lógica do hook já recalcula corretamente baseada no `totalExtras` que recebe)

### Resultado
- Cliente com 1/1 selecionada → 0 extras → barra de desconto não aparece
- Cliente com 5/1 selecionadas → 4 extras → barra mostra faixa correta para 4 extras
- Cliente desmarca 1 foto (4/1 → 3 extras) → barra atualiza para faixa de 3 extras
- Sem emojis

