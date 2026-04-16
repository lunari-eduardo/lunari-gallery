

# Plano: Corrigir redirecionamento pós-pagamento em galerias públicas

## Problema identificado

Após pagamento em galeria pública, o visitante volta à tela de seleção em vez de ver suas fotos pagas. Causa raiz em 3 pontos:

### 1. `finalize_gallery_payment` nunca atualiza `galeria_visitantes`
A RPC marca `galerias.status_selecao = 'selecao_completa'` e `finalized_at`, mas ignora completamente `galeria_visitantes`. O visitante permanece com `status = 'em_andamento'` e `status_selecao = 'aguardando_pagamento'` mesmo após pagamento confirmado.

### 2. `gallery-access` não verifica status do visitante para `aguardando_pagamento`
A verificação de `aguardando_pagamento` (linha 273) só checa o status da galeria. Para galerias públicas, `confirm-selection` atualiza o visitante mas NÃO a galeria. Resultado: o fluxo de "pagamento pendente" nunca é ativado para visitantes.

Quando o pagamento é confirmado e `finalize_gallery_payment` marca a galeria como `selecao_completa`, o bloco `isFinalized` (linha 614) verifica o visitante e encontra `status !== 'finalizado'` → cai no fallback da galeria ativa, mostrando a tela de seleção novamente.

### 3. Retorno de pagamento (`?payment=success`) usa `sessionId` que pode ser nulo
Para galerias públicas standalone (sem sessão), `check-payment-status` não encontra cobrança porque usa `sessionId` como chave primária.

## Correções

### Arquivo 1: `supabase/migrations/...fix_visitor_payment_finalization.sql`
Recriar `finalize_gallery_payment` para, quando `cobrancas.visitor_id` estiver preenchido, também finalizar o visitante:
```sql
-- Dentro do bloco de finalização:
IF v_cobranca.visitor_id IS NOT NULL THEN
  UPDATE galeria_visitantes
  SET status = 'finalizado',
      status_selecao = 'selecao_completa',
      finalized_at = p_paid_at,
      updated_at = now()
  WHERE id = v_cobranca.visitor_id;
END IF;
```
Isso se aplica em todos os 3 caminhos de finalização da RPC (já pago + sync, parcelas resolvidas, pagamento novo).

### Arquivo 2: `supabase/functions/gallery-access/index.ts`
Após resolver o visitante (linha ~270), adicionar verificação de `aguardando_pagamento` a nível de visitante ANTES do check a nível de galeria:
```
Se isPublicGallery && resolvedVisitorId:
  - Buscar visitor.status_selecao
  - Se 'aguardando_pagamento': auto-heal (verificar cobrança paga com visitor_id) e retornar pendingPayment ou finalized
  - Se 'selecao_completa' / status='finalizado': retornar finalized com fotos selecionadas
```
Isso garante que o visitante com pagamento pendente veja a tela de pagamento, e com pagamento confirmado veja as fotos.

### Arquivo 3: `src/pages/ClientGallery.tsx`
No handler de `?payment=success` (linha 677+), quando `sessionId` for nulo, usar `galleryId` + `visitorId` para buscar a cobrança no `check-payment-status`. Enviar também `visitorId` no payload.

### Arquivo 4: `supabase/functions/check-payment-status/index.ts`
Aceitar `visitorId` como parâmetro alternativo para localizar cobrança pendente. Fallback: `cobrancas.visitor_id = visitorId` quando `sessionId` e `orderNsu` não existirem.

## Detalhes técnicos

### Migração SQL
- `finalize_gallery_payment`: Adicionar `UPDATE galeria_visitantes SET status='finalizado', status_selecao='selecao_completa'` nos 3 caminhos de pagamento confirmado.
- Backfill: Atualizar visitantes com cobrança `pago`/`pago_manual` que ainda estão `em_andamento`.

### gallery-access — novo bloco para visitante
Inserir entre a resolução de visitante (linha ~270) e o check de `aguardando_pagamento` da galeria (linha 273):
1. Se `isPublicGallery && resolvedVisitorId`, buscar `galeria_visitantes.status_selecao`
2. Se `aguardando_pagamento` → auto-heal com `cobrancas.visitor_id`, retornar `pendingPayment` ou `finalized`
3. Se `selecao_completa` / `finalizado` → retornar `finalized` com fotos do `visitante_selecoes`
4. Se nenhum dos dois, cair no fluxo normal da galeria

### check-payment-status
Adicionar `visitorId` ao `RequestBody`. Na busca de cobrança, incluir filtro por `visitor_id` quando `sessionId` estiver vazio.

### ClientGallery.tsx
Na detecção de `?payment=success`, incluir `visitorId` no payload para `check-payment-status`.

## Resultado esperado
- Pagamento confirmado → visitante vê tela finalizada com fotos selecionadas
- Pagamento pendente → visitante vê tela de pagamento
- Sem pagamento (pulou) → visitante pode reabrir e refazer seleção
- Fluxo privado continua inalterado
- Webhooks de todos os provedores sincronizam visitante automaticamente

