

# Fix: Antecipação de recebíveis deve ser independente de repasse de taxas

## Problema

Na linha 968 de `PaymentSettings.tsx`, o bloco de antecipação está condicionado a `{!asaasAbsorverTaxa && (...)}`. Quando o fotógrafo marca "Eu absorvo a taxa", os toggles de antecipação desaparecem completamente.

Isso é incorreto porque:
- **Absorver taxa** = o fotógrafo paga a taxa de processamento (o cliente não vê juros)
- **Antecipar recebíveis** = o fotógrafo pede ao Asaas para receber antecipado (decisão financeira independente)

O fotógrafo pode querer absorver as taxas do cliente E ao mesmo tempo antecipar seus recebíveis.

## Conceitos separados

| Configuração | O que controla | Depende de quê? |
|---|---|---|
| `absorverTaxa` | Se o cliente vê taxa de processamento no checkout | Nada |
| `ireiAntecipar` | Se o fotógrafo vai antecipar no Asaas | Nada |
| `repassarTaxaAntecipacao` | Se o custo da antecipação é repassado ao cliente | Só faz sentido quando `!absorverTaxa` E `ireiAntecipar` |

## Correção

### `src/components/settings/PaymentSettings.tsx`

1. **Mover o bloco de antecipação para fora** do condicional `!asaasAbsorverTaxa`
2. O toggle "Vou antecipar meus recebíveis" fica sempre visível quando cartão está habilitado
3. O toggle "Repassar taxa de antecipação ao cliente" fica visível apenas quando:
   - `ireiAntecipar === true` **E** `absorverTaxa === false`
   - Se `absorverTaxa === true`, o repasse é automaticamente `false` (não faz sentido repassar se já absorve tudo)
4. Quando `absorverTaxa` muda para `true`: forçar `repassarTaxaAntecipacao = false` no save

### Estrutura visual resultante

```text
Parcelamento
├── Máximo de parcelas: [Até 6x ▼]
├── Taxas de parcelamento: [● Eu absorvo a taxa]
│
├── Antecipação de recebíveis
│   ├── Vou antecipar meus recebíveis: [●]     ← SEMPRE VISÍVEL
│   └── Repassar ao cliente: [○]                ← SÓ quando !absorverTaxa
│
└── Taxas do Asaas: [Ver taxas]
```

### Lógica no checkout (já correta)

O `AsaasCheckout.tsx` (linha 294-296) já resolve corretamente:
- Se `ireiAntecipar` + `repassarAntecipacao`: soma taxa de antecipação ao cliente
- Se `ireiAntecipar` + `!repassarAntecipacao`: antecipa mas absorve o custo
- Se `absorverTaxa`: não mostra taxas ao cliente

Nenhuma mudança necessária no checkout.

## Arquivo a editar

| Arquivo | Mudança |
|---|---|
| `src/components/settings/PaymentSettings.tsx` | Mover bloco de antecipação (L968-1042) para fora do `!asaasAbsorverTaxa`; condicionar "Repassar" a `!absorverTaxa && ireiAntecipar`; forçar `repassarAntecipacao=false` quando `absorverTaxa=true` |

