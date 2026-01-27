
# Plano: Correção de Contagem Cumulativa de Extras

## Diagnóstico Confirmado

### Problema 1: `qtd_fotos_extra` incorreto na sessão

| Tabela | Campo | Valor Atual | Valor Esperado |
|--------|-------|-------------|----------------|
| `galerias` | `total_fotos_extras_vendidas` | 2 | 2 ✅ |
| `clientes_sessoes` | `qtd_fotos_extra` | 1 | 2 ❌ |
| `clientes_sessoes` | `valor_total_foto_extra` | 5 | 10 ❌ |

**Causa**: A edge function `confirm-selection` (linha 448) salva `extrasCount` que representa apenas as extras do ciclo atual, não o total cumulativo.

### Problema 2: Desconto progressivo recomeça do zero

Quando a galeria é reaberta para nova seleção, o cálculo do desconto progressivo considera apenas as novas extras a cobrar (`extrasACobrar`), ignorando as extras já pagas anteriormente.

**Exemplo**:
- Cliente pagou 4 extras no 1º ciclo → entrou na faixa "4-7 fotos" (R$ 4,00/foto)
- Galeria reaberta, cliente seleciona +2 extras
- **Atual**: Cobra 2 fotos na faixa "1-3 fotos" (R$ 5,00/foto)
- **Esperado**: Cobra 2 fotos na faixa "6 fotos" (R$ 4,00/foto) - total 6 extras acumuladas

---

## Solução Proposta

### Correção 1: Atualizar `confirm-selection` para gravar valores cumulativos na sessão

```text
ANTES:
  qtd_fotos_extra: extrasCount  // Apenas ciclo atual
  valor_total_foto_extra: valorTotal  // Apenas ciclo atual

DEPOIS:
  qtd_fotos_extra: gallery.total_fotos_extras_vendidas + extrasACobrar  // Cumulativo
  valor_total_foto_extra: gallery.valor_total_vendido + valorTotal  // Cumulativo
```

### Correção 2: Calcular desconto progressivo baseado no TOTAL acumulado

O desconto progressivo deve usar o TOTAL de extras (já pagas + novas) para encontrar a faixa de preço, mas cobrar apenas as novas extras.

```text
ANTES:
  Faixa de preço = encontrarFaixa(extrasACobrar)  // Apenas novas
  Valor = extrasACobrar × valorFaixa

DEPOIS:
  totalExtrasAcumuladas = extrasPagasTotal + extrasACobrar
  Faixa de preço = encontrarFaixa(totalExtrasAcumuladas)  // Total acumulado
  Valor = extrasACobrar × valorFaixa  // Cobra apenas as novas
```

---

## Arquivos a Modificar

| # | Arquivo | Alteração |
|---|---------|-----------|
| 1 | `supabase/functions/confirm-selection/index.ts` | Usar valores cumulativos para atualizar sessão |
| 2 | `supabase/functions/confirm-selection/index.ts` | Calcular faixa de desconto baseado em total acumulado |
| 3 | `src/pages/ClientGallery.tsx` | Usar total acumulado para calcular faixa de desconto (exibição) |
| 4 | `src/lib/pricingUtils.ts` | Adicionar parâmetro opcional `quantidadeParaFaixa` |

---

## Detalhes Técnicos

### Alteração na Edge Function `confirm-selection`

```typescript
// Linhas 185-196 - Adicionar cálculo de total acumulado
const extrasNecessarias = Math.max(0, selectedCount - gallery.fotos_incluidas);
const extrasPagasTotal = gallery.total_fotos_extras_vendidas || 0;
const extrasACobrar = Math.max(0, extrasNecessarias - extrasPagasTotal);

// NOVO: Total acumulado para desconto progressivo
const totalExtrasAcumuladas = extrasPagasTotal + extrasACobrar;

// Usar totalExtrasAcumuladas para encontrar faixa, mas cobrar extrasACobrar
const resultado = calcularPrecoProgressivo(
  extrasACobrar,         // Quantidade a cobrar
  totalExtrasAcumuladas, // NOVO: Para encontrar faixa de preço
  regras, 
  fallbackPrice
);
```

### Nova Assinatura para `calcularPrecoProgressivo`

```typescript
function calcularPrecoProgressivo(
  quantidadeACobrar: number,           // Quantidade de extras a cobrar neste ciclo
  quantidadeParaFaixa: number,         // NOVO: Quantidade total para encontrar a faixa de desconto
  regrasCongeladas: RegrasCongeladas | null,
  valorFotoExtraFixo: number
): { valorUnitario: number; valorTotal: number }
```

### Alteração na Atualização da Sessão

```typescript
// Linhas 444-461 - Usar valores cumulativos
if (gallery.session_id) {
  // Calcular novo total de extras pagas (será atualizado quando pagamento confirmar)
  const novoQtdFotosExtra = (gallery.total_fotos_extras_vendidas || 0) + extrasACobrar;
  const novoValorTotalFotoExtra = (gallery.valor_total_vendido || 0) + valorTotal;

  const { error: sessionError } = await supabase
    .from('clientes_sessoes')
    .update({
      qtd_fotos_extra: novoQtdFotosExtra,       // Total acumulado
      valor_foto_extra: valorUnitario,           // Último valor unitário
      valor_total_foto_extra: novoValorTotalFotoExtra,  // Total acumulado
      status_galeria: 'concluida',
      updated_at: new Date().toISOString(),
    })
    .eq('session_id', gallery.session_id);
}
```

### Alteração no Frontend (ClientGallery.tsx)

```typescript
// Linhas 688-693 - Usar total acumulado para faixa de desconto
const totalExtrasAcumuladas = extrasPagasTotal + extrasACobrar;

const { valorUnitario, valorTotal: extraTotal, economia } = calcularPrecoProgressivo(
  extrasACobrar,           // Cobra apenas as novas
  totalExtrasAcumuladas,   // Usa total para encontrar faixa
  regrasCongeladas,
  gallery.extraPhotoPrice
);
```

### Alteração em `src/lib/pricingUtils.ts`

Adicionar parâmetro opcional para manter compatibilidade:

```typescript
export function calcularPrecoProgressivo(
  quantidadeFotosExtras: number,
  regrasCongeladas: RegrasCongeladas | null | undefined,
  valorFotoExtraFixo: number,
  quantidadeParaFaixa?: number  // NOVO: Opcional - se não fornecido, usa quantidadeFotosExtras
): CalculoPrecoResult {
  // Usar quantidadeParaFaixa para encontrar a faixa, ou fallback para quantidade a cobrar
  const qtdParaBuscarFaixa = quantidadeParaFaixa ?? quantidadeFotosExtras;
  
  // ... lógica existente, mas usando qtdParaBuscarFaixa para encontrar faixa
  // ... e quantidadeFotosExtras para calcular valorTotal
}
```

---

## Fluxo Corrigido

```text
┌───────────────────────────────────────────────────────────────────────────┐
│ CENÁRIO: Cliente com 4 extras pagas, seleciona +2 novas                   │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│ 1. Dados Iniciais:                                                        │
│    ├── total_fotos_extras_vendidas = 4                                    │
│    ├── valor_total_vendido = R$ 16 (4 × R$ 4,00 da faixa 4-7)            │
│    └── Cliente seleciona mais 2 extras                                    │
│                                                                           │
│ 2. Cálculo (ANTES - Incorreto):                                          │
│    ├── extrasACobrar = 2                                                  │
│    ├── Faixa encontrada = "1-3 fotos" (R$ 5,00)  ❌                       │
│    └── Valor cobrado = 2 × R$ 5,00 = R$ 10,00                            │
│                                                                           │
│ 3. Cálculo (DEPOIS - Correto):                                           │
│    ├── extrasACobrar = 2                                                  │
│    ├── totalAcumulado = 4 + 2 = 6 fotos                                   │
│    ├── Faixa encontrada = "4-7 fotos" (R$ 4,00)  ✅                       │
│    └── Valor cobrado = 2 × R$ 4,00 = R$ 8,00                             │
│                                                                           │
│ 4. Atualização na sessão:                                                 │
│    ├── qtd_fotos_extra = 6 (acumulado)                                    │
│    └── valor_total_foto_extra = R$ 24 (acumulado)                         │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## Comportamento Final

| Cenário | Antes | Depois |
|---------|-------|--------|
| 1º ciclo: 4 extras, faixa 4-7 (R$ 4/foto) | qtd_fotos_extra = 4 | qtd_fotos_extra = 4 |
| 2º ciclo: +2 extras | Faixa 1-3 (R$ 5/foto) | Faixa 4-7 (R$ 4/foto) |
| Valor cobrado no 2º ciclo | R$ 10 (2 × R$ 5) | R$ 8 (2 × R$ 4) |
| qtd_fotos_extra na sessão | 2 (só ciclo atual) | 6 (acumulado) |
| valor_total_foto_extra | R$ 10 (só ciclo atual) | R$ 24 (acumulado) |

---

## Resumo das Alterações

1. **Edge Function**: Usar `totalExtrasAcumuladas` para encontrar faixa de desconto
2. **Edge Function**: Gravar valores cumulativos na sessão
3. **Frontend**: Exibir faixa de desconto baseada no total acumulado
4. **pricingUtils**: Adicionar parâmetro opcional `quantidadeParaFaixa`
