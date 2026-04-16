

# Plano: Corrigir pagamento em galerias públicas multiusuário

## Problema raiz

O `visitor_id` nunca chega à tabela `cobrancas`. Sem ele, `finalize_gallery_payment` não consegue finalizar o visitante correto, e `gallery-access` não consegue encontrar a cobrança certa para cada visitante.

**Evidência direta do banco:**
- Galeria `941a498d`: 2 cobranças com status `pago`, ambas com `visitor_id = NULL`
- 2 visitantes (Lise e Edu) presos em `status_selecao = 'aguardando_pagamento'`

### 3 pontos de falha identificados:

1. **`AsaasCheckout.tsx`** — interface `AsaasCheckoutData` não tem campo `visitorId`, e os fetch para `asaas-gallery-payment` nunca enviam `visitorId` no body (PIX e Cartão)
2. **`infinitepay-create-link` e `mercadopago-create-link`** — recebem `visitorId` no body mas ignoram na hora do INSERT na `cobrancas`
3. **`finalize_gallery_payment` RPC** — a migração anterior (que adiciona visitor update) não foi aplicada ao banco; a versão em produção não tem nenhum bloco de visitor update
4. **`gallery-access` pending payment** — busca cobrança pendente por `galeria_id` sem filtrar `visitor_id`, retornando a cobrança do visitante errado em cenários multiusuário

### Resposta à pergunta sobre login de clientes

**Não é necessário criar um sistema de login.** O sistema de visitantes (`galeria_visitantes`) já isola corretamente cada usuário. O problema é puramente de propagação do `visitor_id` na cadeia de pagamento. O identificador do visitante já existe e funciona — só precisa fluir até a cobrança.

## Correções

### 1. Frontend: `AsaasCheckout.tsx`
- Adicionar `visitorId?: string` à interface `AsaasCheckoutData`
- Incluir `visitorId: data.visitorId` nos 2 fetch para `asaas-gallery-payment` (PIX linha 229 e Cartão linha 372)

### 2. Edge Function: `infinitepay-create-link`
- Extrair `visitorId` do body da request
- Incluir `visitor_id: visitorId || null` no INSERT de `cobrancas` (linha 210-223)

### 3. Edge Function: `mercadopago-create-link`
- Extrair `visitorId` do body da request
- Incluir `visitor_id: body.visitorId || null` no INSERT de `cobrancas` (linha 114-125)

### 4. Migração SQL: Recriar `finalize_gallery_payment`
- A migração `20260416140746` já tem o código correto mas não foi aplicada
- Criar nova migração que force a recriação da RPC com os 3 blocos de visitor update
- Incluir backfill para os 2 visitantes presos: buscar cobranças pagas pela `galeria_id`, cruzar com `galeria_visitantes` da mesma galeria, e finalizar

### 5. Edge Function: `gallery-access` — filtrar cobrança por visitor
- No bloco `aguardando_pagamento` (linha 414-432): quando `resolvedVisitorId` existir, adicionar `.eq('visitor_id', resolvedVisitorId)` na query de cobrança pendente
- Isso evita que um visitante veja a cobrança do outro

### 6. Backfill dos visitantes presos
- Na migração: atualizar `galeria_visitantes` onde existe cobrança `pago` na mesma `galeria_id` mas sem `visitor_id` (caso atual)
- Para a galeria de teste específica: tentar inferir o visitante pela ordem temporal (cobrança R$50 = Lise com 2 fotos, R$75 = Edu com 3 fotos)

## Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `src/components/AsaasCheckout.tsx` | Adicionar `visitorId` à interface e aos 2 fetch |
| `supabase/functions/infinitepay-create-link/index.ts` | Salvar `visitor_id` no INSERT |
| `supabase/functions/mercadopago-create-link/index.ts` | Salvar `visitor_id` no INSERT |
| `supabase/functions/gallery-access/index.ts` | Filtrar cobrança por `visitor_id` |
| `supabase/migrations/...sql` | Recriar RPC + backfill |

## Resultado esperado
- Cada visitante tem sua própria cobrança com `visitor_id` preenchido
- Pagamento confirmado → visitante finalizado automaticamente
- Visitantes simultâneos não interferem entre si
- Sem necessidade de login — o sistema de visitantes é suficiente

