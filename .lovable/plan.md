

## Auditoria Técnica — Etapa 1: Segurança Crítica (IMPLEMENTADO ✅)

### 1.1 ✅ Autenticação em `confirm-payment-manual`
- Edge Function agora exige `Authorization: Bearer <JWT>` válido
- Verifica ownership: `cobranca.user_id === authenticatedUserId`
- Retorna 401 (sem token) ou 403 (sem permissão) para acessos não autorizados
- `verify_jwt = true` no `config.toml`
- Frontend já envia JWT via `supabase.functions.invoke()` — sem breaking change

### 1.2 ✅ Contagem server-side de fotos selecionadas no `confirm-selection`
- `selectedCount` do frontend agora é IGNORADO para cálculos
- Servidor faz `SELECT COUNT(*) FROM galeria_fotos WHERE galeria_id = X AND is_selected = true`
- Valor do frontend é logado para auditoria, mas não usado
- Elimina risco de manipulação de preço via parâmetro adulterado

### Arquivos modificados
1. ✅ `supabase/functions/confirm-payment-manual/index.ts` — auth check + ownership
2. ✅ `supabase/functions/confirm-selection/index.ts` — server-side COUNT(*)
3. ✅ `supabase/config.toml` — `verify_jwt = true` para confirm-payment-manual

---


## Plano: UX pagamento silenciosa + Asaas rebill interno + Fix nome cliente (IMPLEMENTADO ✅)

### Problema 1: Tela intermediária removida ✅
- Removido render condicional da tela "Confirmando seu pagamento..." (92 linhas de UI)
- `check-payment-status` agora executa silenciosamente em background
- URL limpa imediatamente ao detectar `?payment=success`
- Polling silencioso (30s × 10min) se webhook não chegou ainda
- Galeria renderiza normalmente durante verificação

### Problema 2: "Cobrar novamente" Asaas usa link da galeria ✅
- `gallery-create-payment` agora retorna `galleryUrl` junto com `checkoutUrl`
- `PaymentStatusCard` para Asaas prioriza `galleryUrl` (checkout transparente interno)
- Cliente acessa galeria → `gallery-access` detecta pendente → mostra AsaasCheckout

### Problema 3: Bug nome cliente Asaas ✅
- Busca agora prioriza `externalReference` (clienteId) sobre email
- Se encontrado por email, verifica e atualiza nome + externalReference se divergentes
- Garante que cada cliente Lunari mapeia corretamente para customer Asaas

### Arquivos modificados
1. ✅ `src/pages/ClientGallery.tsx` — verificação silenciosa, sem tela bloqueante
2. ✅ `supabase/functions/gallery-create-payment/index.ts` — retorna `galleryUrl`
3. ✅ `src/components/PaymentStatusCard.tsx` — Asaas usa `galleryUrl`
4. ✅ `supabase/functions/asaas-gallery-payment/index.ts` — busca por externalReference + update nome


## Plano: Taxas Asaas em tempo real no checkout (IMPLEMENTADO ✅)

### Problema resolvido
As taxas eram configuradas manualmente pelo fotógrafo. Agora são buscadas em tempo real da API Asaas (`GET /v3/myAccount/fees/`).

### Arquitetura implementada

```text
Cliente abre checkout
  → AsaasCheckout monta
  → Chama asaas-fetch-fees (userId)
  → API Asaas retorna taxas reais (processamento por faixa + antecipação + valor fixo)
  → Frontend calcula: processamento (tier%) + R$0.49 + antecipação (se incluirTaxaAntecipacao = true)
  → Exibe parcelas com valores corretos

Cliente paga
  → asaas-gallery-payment recalcula server-side com mesma API
  → Cobra valor correto no Asaas
```

### Cálculo combinado por parcela
```
IF incluirTaxaAntecipacao = true:
  Total = Valor + (Valor × taxa_faixa% + R$0.49) + antecipação(taxa_mensal × parcela)
ELSE:
  Total = Valor + (Valor × taxa_faixa% + R$0.49)
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

### Fix v3 — Toggle de taxa de antecipação (2026-03-09) ✅

**Funcionalidade adicionada:**
1. ✅ Novo campo `incluirTaxaAntecipacao: boolean` na interface `AsaasData` (default `true` para retrocompatibilidade)
2. ✅ Toggle na UI "Incluir taxa de antecipação" visível apenas quando `absorverTaxa = false`
3. ✅ Auto-save imediato ao alterar o toggle
4. ✅ Frontend (`AsaasCheckout.tsx`) calcula antecipação apenas se flag = `true`
5. ✅ Backend (`asaas-gallery-payment`) respeita a flag server-side para segurança

**Arquivos modificados:**
1. ✅ `src/hooks/usePaymentIntegration.ts` — interface atualizada + persistência
2. ✅ `src/components/settings/PaymentSettings.tsx` — toggle com auto-save + loading indicator
3. ✅ `src/components/AsaasCheckout.tsx` — condicional `incluirAntecipacao` no cálculo
4. ✅ `supabase/functions/asaas-gallery-payment/index.ts` — validação server-side

### Arquivos originais modificados
1. ✅ `supabase/functions/asaas-fetch-fees/index.ts`
2. ✅ `supabase/config.toml` — registro da nova função
3. ✅ `src/components/AsaasCheckout.tsx` — fetch de taxas + cálculo combinado + toggle antecipação
4. ✅ `supabase/functions/asaas-gallery-payment/index.ts` — validação server-side com API real + toggle antecipação
5. ✅ `src/components/settings/PaymentSettings.tsx` — removidos campos manuais, botão "Ver taxas" read-only, toggle antecipação
6. ✅ `src/hooks/usePaymentIntegration.ts` — interface AsaasData atualizada

## Plano: Validação de Assinatura em Webhooks de Pagamento (IMPLEMENTADO ✅)

### Situação anterior
Nenhum webhook validava a origem da requisição — qualquer POST forjado poderia marcar cobranças como pagas.

### Implementação

| Gateway | Mecanismo | Arquivo | Status |
|---------|-----------|---------|--------|
| **InfinitePay** | HMAC-SHA256 (`X-Infinia-Signature`) | `infinitepay-webhook/index.ts` | ✅ |
| **Asaas** | Token fixo (`asaas-access-token`) | `asaas-webhook/index.ts` + `asaas-gallery-webhook/index.ts` | ✅ |
| **Mercado Pago** | HMAC-SHA256 (`x-signature`) | `mercadopago-webhook/index.ts` | ✅ |

### Graceful degradation
Todos usam o padrão: se o secret não estiver configurado, a validação é pulada com warning. Quando configurado, é obrigatória.

### Secrets necessários (adicionar no Supabase)
1. `INFINITEPAY_WEBHOOK_SECRET` — shared secret do painel InfinitePay
2. `ASAAS_WEBHOOK_TOKEN` — token de autenticação do painel Asaas
3. `MERCADOPAGO_WEBHOOK_SECRET` — secret signature do painel Mercado Pago

## Plano: RPC `finalize_gallery_payment` (IMPLEMENTADO ✅)

### Problema resolvido
Lógica de finalização de pagamento duplicada em 5 Edge Functions com race conditions e incrementos não-atômicos.

### Implementação
- RPC PostgreSQL `SECURITY DEFINER` com advisory lock + `SELECT FOR UPDATE`
- Incrementos atômicos (`SET x = x + N`)
- Idempotente (verifica status antes de atualizar)
- Triggers existentes (`ensure_transaction_on_cobranca_paid`, `trigger_recompute_session_paid`) continuam funcionando

### Edge Functions refatoradas
| Função | Mudança |
|--------|---------|
| `infinitepay-webhook` | Substituído bloco read-then-write por `supabase.rpc('finalize_gallery_payment')` |
| `asaas-gallery-webhook` | Idem |
| `mercadopago-webhook` | Idem |
| `confirm-payment-manual` | Idem |
| `check-payment-status` | `updateToPaid()` refatorado para usar RPC |

## Plano: Correção de Race Conditions e Controle de Concorrência (IMPLEMENTADO ✅)

### Problema 1: Execução concorrente em `confirm-selection` ✅
- RPC `try_lock_gallery_selection` criada com `pg_advisory_xact_lock` + `SELECT FOR UPDATE`
- Estado transitório `processando_selecao` impede duplo clique
- Edge Function retorna 409 se lock já adquirido

### Problema 2: Read-then-write na sessão ✅
- RPC `atomic_update_session_extras` criada com incrementos atômicos (`COALESCE + direct increment`)
- `confirm-selection` usa RPC em vez de calcular totais no JS

### Problema 3: Dupla escrita em `check-payment-status` ✅
- Removido `status: 'pago'` e `data_pagamento` do UPDATE manual (agora só salva metadados do gateway)
- RPC `finalize_gallery_payment` é o único responsável por marcar como pago

### RPCs criadas
| RPC | Propósito |
|-----|-----------|
| `try_lock_gallery_selection` | Lock atômico + validação + estado transitório |
| `atomic_update_session_extras` | Incrementos atômicos em `clientes_sessoes` |

### Arquivos modificados
1. ✅ Nova migration SQL — `try_lock_gallery_selection` + `atomic_update_session_extras`
2. ✅ `supabase/functions/confirm-selection/index.ts` — lock RPC + incrementos atômicos
3. ✅ `supabase/functions/check-payment-status/index.ts` — removida dupla escrita de status
