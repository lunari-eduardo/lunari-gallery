
## Plano: Opção de ativar/desativar taxa de antecipação no Asaas

### Contexto
Atualmente, quando o fotógrafo escolhe "Cliente paga juros", o sistema inclui automaticamente:
1. **Taxa de processamento** (% por faixa de parcelas + R$0.49 fixo)
2. **Taxa de antecipação** (% mensal × número de parcelas)

O usuário quer controlar se a taxa de antecipação deve ser incluída, já que se ele não for antecipar os recebíveis, não terá esse custo.

### Arquivos a modificar

#### 1. `src/hooks/usePaymentIntegration.ts`
- Adicionar campo `incluirTaxaAntecipacao: boolean` na interface `AsaasData`
- Valor padrão: `true` (comportamento atual mantido)

#### 2. `src/components/settings/PaymentSettings.tsx`
- Adicionar novo estado `asaasIncluirAntecipacao`
- Adicionar toggle na seção de taxas (só visível quando `absorverTaxa = false`)
- Auto-save igual ao toggle de absorver taxa
- Label: "Incluir taxa de antecipação" com descrição explicando quando usar

#### 3. `src/components/AsaasCheckout.tsx`
- Receber `incluirTaxaAntecipacao` via `AsaasCheckoutData`
- No cálculo de parcelas, só adicionar `anticipationFee` se a flag for `true`

#### 4. `supabase/functions/asaas-gallery-payment/index.ts`
- Ler `incluirTaxaAntecipacao` do `dados_extras` da integração
- Só calcular e somar `anticipationCost` se a flag for `true`

### Lógica de cálculo resultante

```text
SE absorverTaxa = true:
  valorFinal = valorOriginal (sem taxas)

SE absorverTaxa = false E incluirTaxaAntecipacao = true:
  valorFinal = valorOriginal + taxaProcessamento + taxaAntecipacao

SE absorverTaxa = false E incluirTaxaAntecipacao = false:
  valorFinal = valorOriginal + taxaProcessamento (sem antecipação)
```

### UX da configuração

```
┌─────────────────────────────────────────────────────┐
│ Taxas de parcelamento                               │
│ [OFF] Cliente paga juros                            │
│                                                     │
│   ┌─────────────────────────────────────────────┐   │
│   │ [ON] Incluir taxa de antecipação            │   │
│   │                                             │   │
│   │ Desative se você não for antecipar os       │   │
│   │ recebíveis no Asaas. Assim o cliente paga   │   │
│   │ apenas a taxa de processamento.             │   │
│   └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### Impacto
- Edge functions de InfinitePay não são alteradas
- Comportamento retrocompatível (default `true` = mantém cálculo atual)
