

# Diagnóstico: Pagamento Asaas não finaliza — múltiplas falhas identificadas

## Evidências do banco

A cobrança `06a37968` (R$ 14, cartão 2x) está com `status: parcialmente_pago`:
- Parcela 1 (`pay_0wbyoglv6q161t6m`, R$ 7) — webhook recebido e processado
- Parcela 2 — webhook **nunca será encontrado** porque o `asaas_installment_id` não foi salvo

A galeria `8373d391` está com `status_pagamento: pendente` e `status_selecao: aguardando_pagamento`.

## 5 problemas encontrados

### 1. `asaas_installment_id` não é salvo na criação da cobrança

**Arquivo**: `supabase/functions/asaas-gallery-payment/index.ts` (linhas 424-440)

O campo `asaas_installment_id` **não é incluído** no INSERT de `cobrancas`. Quando o Asaas envia webhook para parcelas 2+, o `payment.id` é diferente. O webhook tenta fallback por `asaas_installment_id` (linha 106), mas esse campo está NULL.

**Resultado**: parcelas 2+ de pagamentos parcelados **nunca são processadas**.

**Correção**: Salvar `paymentData.installment` em `asaas_installment_id` no INSERT da cobrança.

### 2. `parcialmente_pago` não existe no `statusConfig` do frontend

**Arquivo**: `src/components/PaymentStatusCard.tsx` (linhas 57-63)

O status `parcialmente_pago` não está mapeado. O fallback é `sem_vendas` → mostra "Sem cobrança".

**Correção**: Adicionar `parcialmente_pago` ao `statusConfig` com label "Parcialmente pago".

### 3. `cobrancasPagas` só busca `status = 'pago'`

**Arquivo**: `src/pages/GalleryDetail.tsx` (linhas 134 e 146)

A query que alimenta o histórico de pagamentos filtra apenas `status = 'pago'`. Cobranças `pago_manual` não aparecem no histórico.

**Correção**: Usar `.in('status', ['pago', 'pago_manual'])` nas duas queries.

### 4. Polling não roda para Asaas

**Arquivo**: `src/pages/GalleryDetail.tsx` (linhas 233-235)

O polling automático só ativa para `infinitepay` ou `mercadopago`. Pagamentos Asaas pendentes não são verificados periodicamente.

**Correção**: Incluir `asaas` na condição de polling.

### 5. Condição do Detalhes tab não considera `pago_manual` nem `parcialmente_pago`

**Arquivo**: `src/pages/GalleryDetail.tsx` (linha 875)

`cobrancaData.status !== 'pago'` deve também excluir `pago_manual`.

**Correção**: Usar `!['pago', 'pago_manual'].includes(cobrancaData.status)`.

## Correção imediata para a cobrança existente

Migração SQL para salvar o `asaas_installment_id` na cobrança `06a37968` usando o valor do webhook (`8bf21696-9ed0-4f28-b800-c289b6a764eb`), permitindo que a parcela 2 seja processada quando o webhook chegar.

## Arquivos a editar

| Arquivo | Mudança |
|---|---|
| `supabase/functions/asaas-gallery-payment/index.ts` | Salvar `asaas_installment_id` no INSERT |
| `src/components/PaymentStatusCard.tsx` | Adicionar `parcialmente_pago` ao statusConfig |
| `src/pages/GalleryDetail.tsx` | cobrancasPagas incluir `pago_manual`; polling incluir `asaas`; condição detalhes incluir `pago_manual` |
| Nova migração SQL | Corrigir cobrança `06a37968` com `asaas_installment_id` |

