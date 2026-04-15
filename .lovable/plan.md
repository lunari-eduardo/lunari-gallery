

# Fix: Pagamentos manuais não contabilizados no perfil do cliente

## Problema

A query de pagamentos em `useClientProfile.ts` filtra apenas `status = 'pago'`. Pagamentos confirmados manualmente têm status `pago_manual` — portanto são excluídos das métricas (Total pago, Fotos extras) e da aba Pagamentos.

Dados confirmados no banco:
- `ccd34b88...` → R$138, 6 fotos, status=`pago_manual` (galeria circulada em vermelho)
- `2e63ba6f...` → R$115, 5 fotos, status=`pago` (galeria circulada em verde — única contabilizada)

## Solução

No `useClientProfile.ts`, trocar `.eq('status', 'pago')` por `.in('status', ['pago', 'pago_manual'])` na query de cobrancas.

## Mudança

| Arquivo | O que muda |
|---|---|
| `src/hooks/useClientProfile.ts` | Linha 108: `.eq('status', 'pago')` → `.in('status', ['pago', 'pago_manual'])` |

Alteração de 1 linha. Nenhuma migração necessária.

## Resultado
- Métricas do cliente passam a somar R$253 (115+138) e 11 fotos extras (5+6)
- Aba Pagamentos mostra ambas as transações
- Provider label para `pago_manual` já funciona (mapeia pelo campo `provedor`)

