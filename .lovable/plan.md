

## Configuração de Taxas de Antecipação do Asaas

### Situação atual
A interface já tem um toggle de "Taxa de antecipação" com um único campo percentual (`taxaAntecipacaoPercentual`). A `AsaasData` no hook tem `taxaAntecipacao: boolean` e `taxaAntecipacaoPercentual: number`.

### O que muda
Substituir o campo único por dois campos separados e adicionar função utilitária de cálculo.

### Alterações

#### 1. `src/hooks/usePaymentIntegration.ts` — Atualizar `AsaasData`
- Remover `taxaAntecipacaoPercentual: number`
- Adicionar:
  - `taxaAntecipacaoCreditoAvista: number` — taxa mensal para crédito 1x
  - `taxaAntecipacaoCreditoParcelado: number` — taxa mensal para crédito parcelado
- Atualizar defaults em `updateAsaasSettings` e `saveAsaas`

#### 2. `src/lib/anticipationUtils.ts` — NOVO arquivo de cálculo
```typescript
export function calcularAntecipacao(
  valorTotal: number,
  parcelas: number,
  taxaMensal: number // ex: 1.25 para 1.25%
): { valorLiquido: number; totalTaxa: number; detalheParcelas: Array<{ parcela: number; meses: number; taxa: number; liquido: number }> }
```
Lógica:
- `valor_parcela = valorTotal / parcelas`
- Para cada parcela i (1..n): `taxa_total = taxaMensal * i`, `liquido = valor_parcela * (1 - taxa_total/100)`
- Soma dos líquidos = `valorLiquido`
- Para crédito à vista (1x): mesma fórmula com parcelas=1

#### 3. `src/components/settings/PaymentSettings.tsx` — UI
- Substituir o campo único "Percentual de antecipação" por dois campos:
  - "Taxa mensal — Crédito à vista (%)" 
  - "Taxa mensal — Crédito parcelado (%)"
- Adicionar simulador inline: ao preencher os campos, mostrar exemplo de cálculo (R$ 1000, 3x = valor líquido X)
- Atualizar states: `asaasTaxaAntecipacaoPercentual` → `asaasTaxaAvista` + `asaasTaxaParcelado`
- Atualizar handlers `handleSaveAsaas` e `handleSaveAsaasSettings`

#### 4. `supabase/functions/asaas-gallery-payment/index.ts` — Aplicar cálculo
- Quando `taxaAntecipacao === true`:
  - Para billingType `CREDIT_CARD` com 1 parcela: aplicar `taxaAntecipacaoCreditoAvista`
  - Para `CREDIT_CARD` com >1 parcela: aplicar `taxaAntecipacaoCreditoParcelado`
  - Calcular valor final usando a mesma fórmula de antecipação
  - O valor cobrado ao cliente = `valorTotal + (valorTotal - valorLiquido)` → ou seja, o custo da antecipação é adicionado ao valor
- **Não** exibir detalhamento no checkout (conforme regra)

#### 5. Edge functions existentes — Segurança
- `infinitepay-create-link` e `mercadopago-create-link`: **sem alteração**
- `gallery-create-payment` e `confirm-selection`: **sem alteração** (já roteiam para asaas-gallery-payment)
- `asaas-gallery-webhook`: **sem alteração**

### Compatibilidade
- Dados existentes com `taxaAntecipacaoPercentual` serão migrados: se existir valor antigo, será usado como fallback para ambos os campos até o usuário reconfigurare

