

# Correcao: Desacoplar finalizacao da galeria do pagamento

## Resumo das regras

| Modo | Quando finaliza |
|------|----------------|
| Sem vendas (`no_sale`) | Imediatamente ao confirmar selecao (comportamento atual, sem mudanca) |
| Com venda SEM pagamento (`sale_without_payment`) | Imediatamente ao confirmar selecao (comportamento atual, sem mudanca) |
| PIX Manual | Quando o cliente clica "Informar pagamento" na tela de PIX |
| InfinitePay / MercadoPago | Somente quando o webhook ou `check-payment-status` confirma pagamento |

## Problema atual

A Edge Function `confirm-selection` define `status_selecao = 'confirmado'` e `finalized_at = now()` para TODOS os casos, incluindo pagamentos com InfinitePay/MercadoPago. Se o cliente fechar a aba durante o redirect ou checkout, a galeria fica "finalizada" sem pagamento, e ele nao consegue retornar para pagar.

## Mudancas

### 1. Edge Function `confirm-selection/index.ts`

**Logica de finalizacao condicional** (linhas 437-445):

- Se `no_sale` ou `sale_without_payment` ou sem extras a cobrar: finalizar imediatamente (status_selecao = 'confirmado', finalized_at = now()) -- comportamento atual mantido
- Se PIX Manual: **NAO finalizar**. Definir `status_selecao = 'aguardando_pagamento'`, `finalized_at = null`. A finalizacao ocorrera quando o cliente clicar "Informar pagamento"
- Se InfinitePay / MercadoPago: **NAO finalizar**. Definir `status_selecao = 'aguardando_pagamento'`, `finalized_at = null`. A finalizacao ocorrera via webhook ou check-payment-status

Tambem nao sincronizar `clientes_sessoes.status_galeria = 'concluida'` quando `aguardando_pagamento` -- manter como `em_selecao` ate confirmacao.

### 2. Edge Function `gallery-access/index.ts`

Atualmente, verifica `isFinalized = status_selecao === 'confirmado' || finalized_at` (linha 157). Adicionar tratamento para `aguardando_pagamento`:

- Se `status_selecao === 'aguardando_pagamento'`: retornar dados necessarios para o cliente ver a tela de pagamento:
  - Para PIX Manual: retornar `pixDados` das `configuracoes` da galeria
  - Para InfinitePay/MercadoPago: retornar o `checkoutUrl` da cobranca pendente buscando na tabela `cobrancas`
  - Incluir `pendingPayment: true` na resposta com os dados de pagamento

### 3. Edge Function `infinitepay-webhook/index.ts`

Apos atualizar `status_pagamento = 'pago'` e incrementar creditos (que ja faz), **adicionar**:
- Atualizar `status_selecao = 'confirmado'` e `finalized_at = now()` na galeria
- Atualizar `clientes_sessoes.status_galeria = 'concluida'` se houver `session_id`

### 4. Edge Function `check-payment-status/index.ts`

Na funcao `updateToPaid()`, alem do que ja faz, **adicionar**:
- Atualizar `status_selecao = 'confirmado'` e `finalized_at = now()` na galeria
- Atualizar `clientes_sessoes.status_galeria = 'concluida'` se houver `session_id`

### 5. Edge Function `mercadopago-webhook/index.ts`

Mesma logica: ao confirmar pagamento, adicionar finalizacao da galeria (`status_selecao = 'confirmado'`, `finalized_at = now()`).

### 6. Frontend: `ClientGallery.tsx`

**Detectar `aguardando_pagamento` ao acessar galeria:**

Na query inicial (useEffect que verifica `isAlreadyConfirmed`), tratar `status_selecao === 'aguardando_pagamento'` como estado especial:
- Nao marcar `isConfirmed = true`
- Verificar se `galleryResponse` contem `pendingPayment: true`
- Se sim, exibir a tela de pagamento (PIX ou redirect) em vez da galeria ou tela finalizada

**Callback `onPaymentConfirmed` do PIX Manual:**

Quando cliente clica "Informar pagamento" e confirma no modal:
1. Chamar endpoint para atualizar `status_selecao = 'confirmado'`, `finalized_at = now()` e `status_pagamento = 'aguardando_confirmacao'`
2. Mostrar tela de selecao confirmada

Pode ser via nova chamada ao `confirm-selection` com flag `finalizeOnly: true`, ou diretamente via `client-selection` com acao especifica.

### 7. Frontend: `PixPaymentScreen.tsx`

Substituir o botao "Ja realizei o pagamento" por:

**Botao em destaque:**
- Texto: "Informar pagamento"
- Subtexto: "Este pagamento possui confirmacao manual. Clique aqui apos realizar o Pix."

**Modal de confirmacao (AlertDialog):**
- Titulo: "Confirmar pagamento"
- Mensagem: "Ao confirmar, o fotografo sera notificado para verificar o pagamento manualmente. Se possivel, envie o comprovante para agilizar a validacao."
- Botoes: "Cancelar" e "Confirmar"

Ao confirmar: chamar `onPaymentConfirmed()` que finaliza a galeria.

### 8. Edge Function `client-selection/index.ts`

Adicionar acao `finalize_payment` que:
- Valida que `status_selecao === 'aguardando_pagamento'`
- Atualiza `status_selecao = 'confirmado'`, `finalized_at = now()`, `status_pagamento = 'aguardando_confirmacao'`
- Retorna sucesso

Isso sera chamado pelo frontend quando o cliente clicar "Informar pagamento" no PIX Manual.

---

## Arquivos modificados

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/confirm-selection/index.ts` | Nao finalizar quando pagamento e InfinitePay/MercadoPago/PIX Manual |
| `supabase/functions/gallery-access/index.ts` | Retornar dados de pagamento para `aguardando_pagamento` |
| `supabase/functions/infinitepay-webhook/index.ts` | Finalizar galeria ao confirmar pagamento |
| `supabase/functions/mercadopago-webhook/index.ts` | Finalizar galeria ao confirmar pagamento |
| `supabase/functions/check-payment-status/index.ts` | Finalizar galeria ao confirmar pagamento |
| `supabase/functions/client-selection/index.ts` | Nova acao `finalize_payment` para PIX manual |
| `src/pages/ClientGallery.tsx` | Tratar `aguardando_pagamento` e retomar pagamento |
| `src/components/PixPaymentScreen.tsx` | Novo botao "Informar pagamento" com modal de confirmacao |

## Fluxo revisado

```text
Cliente confirma selecao:

SEM VENDAS / SEM PAGAMENTO / SEM EXTRAS:
  -> Finaliza imediatamente (sem mudanca)

PIX MANUAL:
  -> status_selecao = 'aguardando_pagamento'
  -> Tela PIX com QR Code
  -> Cliente clica "Informar pagamento" -> Modal de confirmacao
  -> Ao confirmar: status_selecao = 'confirmado', finalized_at = now()
  -> Tela "Selecao confirmada"

INFINITEPAY / MERCADOPAGO:
  -> status_selecao = 'aguardando_pagamento'
  -> Redirect para checkout externo
  -> Se fechar aba: ao voltar, gallery-access detecta e mostra checkout novamente
  -> Webhook confirma: status_selecao = 'confirmado', finalized_at = now()
```
