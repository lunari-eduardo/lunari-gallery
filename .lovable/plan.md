# ✅ Plano Concluído: Correção Valor Foto Extra Zerado

## Problema Corrigido

Na galeria com PIX Manual, o campo "Valor por extra" mostrava **R$ 0,00** por dois motivos:

1. **Em `pricingUtils.ts`**: Quando `extrasNovas = 0` (todas as extras já foram pagas), a função retornava `valorUnitario: 0`
2. **Em `GalleryCreate.tsx`**: Ao salvar galeria com precificação progressiva, usava `regrasCongeladas.pacote.valorFotoExtra` que é 0 quando o modelo é por tabela

## Solução Implementada

### 1. `src/lib/pricingUtils.ts` (linhas 257-294)

Substituído o retorno zerado por cálculo do preço unitário real:

- **Prioridade 1**: Se cliente já pagou extras → `valorJaPago / extrasPagasTotal` (média real)
- **Prioridade 2**: Sem pagamentos, busca o preço da faixa atual baseado na quantidade
- **Fallback**: Usa o preço fixo do pacote

### 2. `src/pages/GalleryCreate.tsx`

- **Adicionado helper `getInitialExtraPrice()`** (linhas 39-70): Extrai o preço da primeira faixa da tabela progressiva
- **Corrigido handleNext** (linha 532): Usa `getInitialExtraPrice()` em vez de `pacote.valorFotoExtra`
- **Corrigido handleSaveDraft update** (linhas 589-593): Mesma correção
- **Corrigido handleSaveDraft create** (linhas 621-625): Mesma correção

## Resultado

| Cenário | Valor Exibido |
|---------|---------------|
| Cliente pagou extras | `valorJaPago ÷ extrasPagasTotal` (média real) |
| Sem pagamentos, modelo tabela | Preço da primeira faixa |
| Sem pagamentos, modelo fixo | `pacote.valorFotoExtra` |
| Fallback | `extraPhotoPrice` da galeria |

## Exemplo Prático

**Galeria "Teste":**
- Cliente pagou R$ 12,00 por 4 extras
- `valorUnitario = 12 / 4 = R$ 3,00` ← Preço médio real

**Nova galeria via Gestão:**
- Tabela categoria: [1-2: R$5, 3-4: R$3, 5+: R$2]
- `valorFotoExtra = R$ 5,00` (primeira faixa) salvo no banco
