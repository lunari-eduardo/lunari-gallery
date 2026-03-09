

## Plano: Taxas Asaas em tempo real no checkout (IMPLEMENTADO ✅)

### Problema resolvido
As taxas eram configuradas manualmente pelo fotógrafo. Agora são buscadas em tempo real da API Asaas (`GET /v3/myAccount/fees/`).

### Arquitetura implementada

```text
Cliente abre checkout
  → AsaasCheckout monta
  → Chama asaas-fetch-fees (userId)
  → API Asaas retorna taxas reais (processamento por faixa + antecipação + valor fixo)
  → Frontend calcula: processamento (tier%) + R$0.49 + antecipação
  → Exibe parcelas com valores corretos

Cliente paga
  → asaas-gallery-payment recalcula server-side com mesma API
  → Cobra valor correto no Asaas
```

### Cálculo combinado por parcela
```
Total = Valor + (Valor × taxa_faixa% + R$0.49) + antecipação(taxa_mensal × parcela)
```

### Fix v2 — Correção de parsing da API Asaas (2026-03-09) ✅

**Bugs corrigidos:**
1. ✅ Nomes de campos errados (`upToSixInstallmentsPercentageFee` → `upToSixInstallmentsPercentage`)
2. ✅ Antecipação lida de `payment.creditCard` → corrigido para `anticipation.creditCard`
3. ✅ Desconto promocional (`hasValidDiscount`) agora é respeitado em todos os cálculos

**Arquivos modificados:**
1. ✅ `supabase/functions/asaas-fetch-fees/index.ts` — parsing corrigido + suporte a discount tiers
2. ✅ `supabase/functions/asaas-gallery-payment/index.ts` — mesma correção server-side
3. ✅ `src/components/AsaasCheckout.tsx` — usa discount tiers quando ativos
4. ✅ `src/components/settings/PaymentSettings.tsx` — indicador de desconto ativo + tabela com taxas promocionais

### Arquivos originais modificados
1. ✅ `supabase/functions/asaas-fetch-fees/index.ts`
2. ✅ `supabase/config.toml` — registro da nova função
3. ✅ `src/components/AsaasCheckout.tsx` — fetch de taxas + cálculo combinado
4. ✅ `supabase/functions/asaas-gallery-payment/index.ts` — validação server-side com API real
5. ✅ `src/components/settings/PaymentSettings.tsx` — removidos campos manuais, botão "Ver taxas" read-only
6. ✅ `src/hooks/usePaymentIntegration.ts` — interface AsaasData atualizada
