

## Análise: Inconsistências nas taxas Asaas

### O que a API realmente retorna

```text
payment.creditCard:
  operationValue: 0.49
  oneInstallmentPercentage: 2.99
  upToSixInstallmentsPercentage: 3.49        ← campo real
  upToTwelveInstallmentsPercentage: 3.99
  upToTwentyOneInstallmentsPercentage: 4.29
  hasValidDiscount: true
  discountOneInstallmentPercentage: 1.99      ← desconto ativo
  discountUpToSixInstallmentsPercentage: 2.49
  discountUpToTwelveInstallmentsPercentage: 2.99
  discountUpToTwentyOneInstallmentsPercentage: 3.29

anticipation.creditCard:                      ← seção SEPARADA
  detachedMonthlyFeeValue: 1.25
  installmentMonthlyFeeValue: 1.70
```

### Bugs encontrados

**Bug 1 — Nomes de campos errados para tiers de processamento**
O código procura `upToSixInstallmentsPercentageFee` mas a API retorna `upToSixInstallmentsPercentage` (sem "Fee" no final). Como não encontra, cai no fallback e usa **2.99% para TODAS as parcelas** ao invés de 3.49% para 2-6x, 3.99% para 7-12x, etc.

**Bug 2 — Antecipação lida do local errado**
O código busca `detachedMonthlyFeeValue` dentro de `payment.creditCard`, mas essa informação está em `anticipation.creditCard`. Funciona por coincidência porque o fallback hardcoded (1.25/1.70) bate com os valores reais dessa conta.

**Bug 3 — Desconto promocional ignorado**
A conta tem desconto ativo (`hasValidDiscount: true`) com taxas menores (ex: 1.99% à vista ao invés de 2.99%), válido até 2026-05-24. O sistema ignora completamente essas taxas promocionais.

### Exemplo de cálculo errado vs correto (2x, R$100)

```text
ATUAL (bugado):
  Processing: 100 × 2.99% + 0.49 = 3.48   ← usa 2.99% ao invés de 3.49%
  Anticipation: 2.55
  Total: R$ 106.03

CORRETO (sem desconto):
  Processing: 100 × 3.49% + 0.49 = 3.98
  Anticipation: 2.55
  Total: R$ 106.53

CORRETO (com desconto ativo):
  Processing: 100 × 2.49% + 0.49 = 2.98
  Anticipation: 2.55
  Total: R$ 105.53
```

### Correções

#### 1. `supabase/functions/asaas-fetch-fees/index.ts`
Reescrever o parsing para usar os campos corretos da API:
- Ler tiers de `payment.creditCard.oneInstallmentPercentage`, `upToSixInstallmentsPercentage`, `upToTwelveInstallmentsPercentage`, `upToTwentyOneInstallmentsPercentage`
- Quando `hasValidDiscount === true` e `discountExpiration` > agora, usar os campos `discount*`
- Ler antecipação de `anticipation.creditCard.detachedMonthlyFeeValue` e `installmentMonthlyFeeValue`
- Remover todos os fallbacks genéricos e guessing de nomes

#### 2. `src/components/settings/PaymentSettings.tsx`
- Exibir indicador de desconto ativo quando `hasValidDiscount` (com data de expiração)
- Mostrar taxas com/sem desconto na tabela

#### 3. `src/components/AsaasCheckout.tsx` e `supabase/functions/asaas-gallery-payment/index.ts`
- Sem mudanças na lógica de cálculo — os tiers e valores de antecipação já são usados corretamente, o problema está apenas no parsing da edge function

### Arquivos modificados
1. `supabase/functions/asaas-fetch-fees/index.ts` — fix parsing (principal)
2. `src/components/settings/PaymentSettings.tsx` — indicador de desconto
