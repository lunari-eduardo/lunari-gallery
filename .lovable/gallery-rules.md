# Regras Canônicas do Fluxo de Galeria

> **Consulta obrigatória** antes de qualquer plano/correção envolvendo
> `galerias`, `cobrancas`, `gallery-access`, `confirm-selection`,
> `client-selection`, `PaymentPendingScreen`, `ClientGallery`,
> `infinitepay-create-link`, `mercadopago-create-link` ou
> `asaas-gallery-payment`.
>
> Toda regra abaixo é invariante do sistema. Se um novo requisito colidir
> com uma regra, o requisito precisa ser reescrito — nunca a regra.

---

## R1 — Fonte única de finalização
- `galerias.finalized_at` (privada) ou `galeria_visitantes.finalized_at`
  (pública) é a fonte de verdade absoluta.
- Uma vez gravado, **só** a RPC `reopen_gallery_selection` (ou eventual
  `reactivate_gallery_selection`) pode limpá-lo.
- Nenhum edge function, trigger ou UPDATE direto pode zerar `finalized_at`.

## R2 — `selectionLocked` é decidido no servidor
- `gallery-access` calcula `selectionLocked` a partir de `finalized_at`
  e `status_selecao ∈ (aguardando_pagamento, selecao_completa,
  processando_selecao)`.
- Cliente **consome** `selectionLocked`, `hasPaid`, `blockedReason` e
  `finalizedAt`. Nunca recalcula com regras próprias.

## R3 — Grid de seleção some quando travada
- Se `selectionLocked && !hasPaid`, `gallery-access` retorna
  `photos: []` e `blockedReason ∈ (awaiting_payment,
  awaiting_charge_regeneration)`.
- Se `selectionLocked && hasPaid`, retorna **apenas** as selecionadas e
  `blockedReason: 'finalized_paid'`.
- `ClientGallery` faz early-return em `PaymentPendingScreen` ou
  `FinalizedPreviewScreen` — nunca renderiza `SelectionScreen` quando
  `selectionLocked=true`.

## R4 — Cobrança de galeria tem contrato rígido
- Sempre `finalidade = 'fotos_extras'` **e** `galeria_id NOT NULL`.
- Trigger `tg_classify_cobranca_finalidade`:
  - `galeria_id` presente ⇒ força `finalidade='fotos_extras'` (nunca
    rebaixa).
  - `finalidade='fotos_extras'` sem `galeria_id` ⇒ auto-vincula pela
    galeria finalizada mais recente com o mesmo `session_id` e `user_id`.
- Qualquer edge function que crie link para o Gallery (InfinitePay, MP,
  Asaas) obedece a esse contrato no INSERT.

## R5 — Reativação/reabertura é RPC-only
- Apenas `reopen_gallery_selection(p_gallery_id, p_days)` pode remover a
  finalização de uma galeria. Ela roda `SECURITY DEFINER`, valida
  `auth.uid()`, e registra em `galeria_acoes` com tipo
  `selecao_reaberta`.
- Cobranças pagas são **preservadas** (nunca deletadas) — o crédito
  segue via `total_fotos_extras_vendidas` / `valor_total_vendido`.
- Cobranças pendentes do ciclo anterior são canceladas.

## R6 — Rollback nunca apaga finalização
- `confirm-selection.rollbackGalleryStatus` verifica `finalized_at`
  antes de resetar `status_selecao`. Se já finalizada, aborta o rollback
  silenciosamente.

## R7 — Concorrência e locks
- `try_lock_gallery_selection` / `try_lock_visitor_selection` são
  atômicos. `ALREADY_FINALIZED` (guard determinístico antes do lock)
  retorna HTTP 409 com `code='ALREADY_FINALIZED'`; o cliente força
  `refetchGallery()` sem toast de erro.
- `ALREADY_PROCESSING` (lock concorrente TTL) também retorna 409 e o
  cliente re-tenta apenas via UI de retry.

## R8 — Cálculo canônico
- `calculate_gallery_extra_payment(p_gallery_id)` é a única fonte de
  valor de extras. Nem front, nem edge function recalculam preços
  independentemente.
- Trigger `tg_protect_no_overcharge` bloqueia INSERT de cobrança com
  valor acima do canônico.

## R9 — Fluxo de pagamento pendente
- `PaymentPendingScreen` cobre 3 estados exclusivos:
  1. Cobrança viva com `checkoutUrl` (InfinitePay/MercadoPago) → botão
     "Ir para pagamento".
  2. `pix_manual` com `pixDados` → tela PIX transparente.
  3. `awaitingCharge=true` (sem cobrança viva) → botão "Gerar novo
     link" que dispara `client-selection` action `regenerate_charge`.
- `AsaasCheckout` é chamado quando `paymentMethod='asaas'` +
  `asaasCheckoutData` presente.

## R10 — Ciclo de vida
- Galerias expiram em 12 meses (`expires_at`), deletadas por
  `pg_cron`. Metadados de sessão vão para `galerias_sessao_historico`.
- `session_id` é liberado no delete físico — permite recriar a galeria.

---

## Checklist obrigatória para planos futuros

Todo plano que toque neste fluxo deve começar com:

```text
[ ] R1  finalized_at preservado (nenhum UPDATE direto)?
[ ] R2  selectionLocked lido do servidor?
[ ] R3  grid nunca renderiza quando travada e não paga?
[ ] R4  toda nova cobrança tem finalidade e galeria_id corretos?
[ ] R5  reabertura passa pela RPC oficial?
[ ] R6  rollback respeita finalized_at?
[ ] R7  guards de lock/finalização retornam código próprio (409)?
[ ] R8  cálculo usa RPC canônica?
[ ] R9  PaymentPendingScreen cobre todos os providers?
[ ] R10 delete físico respeita histórico de sessão?
```

Última atualização: 2026-07-01 (bug JFkdA0svNBN4 — cobrança órfã +
grid renderizado após reabertura).
