# Pipeline de Pagamento de Galeria — Contrato Atômico

> **LEITURA OBRIGATÓRIA** antes de tocar em qualquer uma das 4 funções abaixo.
> Este arquivo é o contrato canônico do fluxo. Se um plano for gerado
> sem reabrir este documento, o plano está incompleto.

---

## Fluxo em uma imagem

```text
ClientGallery.tsx
      │  action=regenerate_charge | finalize_payment
      ▼
supabase/functions/client-selection/index.ts
      │  POST /gallery-create-payment { galleryId, provider, descricao }
      ▼
supabase/functions/gallery-create-payment/index.ts          ← FONTE ÚNICA
      │  SELECT galerias → deriva cliente_id, session_id, user_id,
      │                     public_token, venda_pagamento_provedor
      │  RPC calculate_gallery_extra_payment → valor, qtd, is_fully_paid
      │  cancela cobranças 'pendente'/'aguardando_confirmacao' antigas
      │
      ├── provedor='asaas'        → devolve { transparentCheckout:true, galleryUrl }
      │
      ├── provedor='infinitepay'  → POST /infinitepay-create-link  ┐
      └── provedor='mercadopago'  → POST /mercadopago-create-link  ┤
                                                                    │
                                    payload OBRIGATÓRIO idêntico ───┘
                                    { clienteId, sessionId, valor,
                                      descricao, userId, galeriaId,
                                      qtdFotos, galleryToken,
                                      redirectUrl? }
```

## Regras invariantes

1. **`gallery-create-payment` é a fonte única** que traduz `galleryId → clienteId / sessionId / qtdFotos / valor`. Nenhum caller a montante monta esses campos manualmente.
2. **Nunca exigir `clienteId` no body de `gallery-create-payment`.** O único campo obrigatório é `galleryId`. O `cliente_id` é lido do banco via `SELECT galerias`; pode ser NULL para galeria pública.
3. **`infinitepay-create-link` e `mercadopago-create-link` aceitam `galeriaId` sem `clienteId`.** A validação é `!clienteId && !galeriaId` (OU exclusivo). Nunca inverter isso.
4. **Códigos de erro estáveis** (front depende deles): `MISSING_GALLERY_ID`, `GALLERY_NOT_FOUND`, `CALC_ERROR`, `CALC_INVALID`, `NO_AMOUNT_DUE`, `NO_PROVIDER`, `GATEWAY_TIMEOUT`, `GATEWAY_UNREACHABLE`, `PAYMENT_CREATE_ERROR`.
5. **`qtdFotos > 0` obrigatório** ao chegar em `infinitepay-create-link`/`mercadopago-create-link` com `finalidade='fotos_extras'`. Se o caller mandar 0, o edge tenta inferir (regex na descrição + divisão pelo `valor_foto_extra` da galeria); se ainda assim ficar 0, **rejeita** — nunca gravar cobrança com `qtd_fotos=0`.
6. **Cancelamento de cobranças antigas** só acontece dentro de `gallery-create-payment` (`step:5 cancel-stale`). Não duplicar essa lógica nas *-create-link.
7. **RPC `calculate_gallery_extra_payment`** é a única fonte de valor/qtd. Trigger `tg_protect_no_overcharge` bloqueia INSERT acima do canônico. Não recalcular preço em nenhum lugar.

## Cenário de drift (o que já aconteceu)

Em 2026-07-09 (20:46 UTC) o repositório estava com `gallery-create-payment` v2.1, mas a Supabase servia uma versão anterior que **exigia `clienteId` no body**. `client-selection` (atualizado) mandava apenas `{ galleryId }`; o edge respondia `400 { error: "clienteId é obrigatório" }`; o front exibia `PAYMENT_CREATE_ERROR` no toast. Confirmação: a string `"clienteId é obrigatório"` **não existe** em nenhum arquivo do HEAD (nem código, nem migrations, nem `pg_proc`), e os logs do edge implantado usavam `[gallery-create-payment] Request:` enquanto o HEAD já usava `[gcp][step:1 request]`. Correção: redeploy explícito. Prevenção: canary abaixo.

## Checklist antes de editar qualquer função do pipeline

```text
[ ] Reli este arquivo inteiro.
[ ] Reli .lovable/gallery-rules.md (R4, R8, R9 tocam este pipeline).
[ ] Se mexi em contrato de request/response, atualizei este arquivo NA MESMA edit.
[ ] Após deploy, rodei o canary abaixo e confirmei os 3 pontos de log.
```

## Canary pós-deploy (sempre executar após alterar qualquer uma das 4 funções)

Usar uma galeria de teste com `venda_pagamento_provedor='infinitepay'` (ou o provedor tocado) e cobrança de extras pendente:

1. `POST /gallery-create-payment { galleryId: '<galeria-teste>' }`
2. Resposta esperada quando há saldo:
   - HTTP 200
   - `success: true`
   - `checkoutUrl` **não-vazio**
   - `provedor` bate com o esperado
   - `cobrancaId` **não-nulo**
3. Log esperado (`supabase--edge_function_logs`):
   - `[gcp][step:1 request]`
   - `[gcp][step:3 calc-ok] valor=... extras=... fullyPaid=false`
   - `[gcp][step:6 calling] infinitepay-create-link ...`
   - `[gcp][step:7 done] provedor=infinitepay cobrancaId=...`

Se qualquer um dos itens diferir, o deploy **não pegou** — abrir imediatamente
a função no dashboard e forçar novo deploy. Não continuar o plano.

## Superfície do front que consome esta cadeia

- `src/pages/ClientGallery.tsx` → `handleRegenerateCharge` (linha ~1369) e `handleResume` (linha ~1427).
- `src/components/PaymentPendingScreen.tsx` → botão "Ir para pagamento" / "Gerar novo link".
- `src/components/AsaasCheckout.tsx` → só é aberto se `provedor='asaas'` + `asaasCheckoutData` presente.

Nunca chamar `infinitepay-create-link` / `mercadopago-create-link` / `asaas-gallery-payment` diretamente pelo front. **Sempre passar por `client-selection` (para fluxo público) ou `gallery-create-payment` (para fluxo interno)**.

---

## Fonte de verdade do modo de venda (2026-07-10)

Duas fontes coexistem no banco para o modo de venda:

- **Colunas canônicas** — `galerias.venda_modo`, `galerias.venda_pagamento_provedor`, `galerias.venda_tipo_cobranca`.
- **JSON legado** — `galerias.configuracoes.saleSettings.{mode, paymentMethod, chargeType}`.

Regras invariantes:

1. **Colunas vencem sempre.** Qualquer edge function que decide fluxo de pagamento
   (`gallery-access`, `confirm-selection`, `client-selection`, `gallery-create-payment`)
   deve tratar as colunas como source of truth e o JSON apenas como fallback para
   registros legados.
2. **Trigger `tg_sync_gallery_sale_settings_json`** mantém o JSON alinhado com as
   colunas em todo INSERT/UPDATE. Não remover.
3. **`gallery-access` projeta `saleSettings` normalizado** no payload devolvido ao
   frontend (colunas > JSON > default `no_sale`) e loga `SALE_MODE_DIVERGENCE` se
   detectar drift.
4. **Frontend NUNCA aplica default silencioso** para `mode`. Se a resposta da
   função vier sem `saleSettings.mode`, cair em `'no_sale'` conscientemente e
   registrar no console — mas nunca em `'sale_without_payment'` (que faria o cliente
   confirmar sem pagar).
5. **Contract guard no `confirmMutation.onSuccess`**: se
   `saleSettings.mode==='sale_with_payment'` e `extrasACobrar>0`, mas o backend
   respondeu `requiresPayment=false`, **jamais** setar `isConfirmed=true`.
   Refetch e cair na `PaymentPendingScreen`. Isso torna impossível a tela
   "Seleção Confirmada" aparecer sem pagamento processado.

## Etapa "Dados de cobrança" pré-checkout

Componente: `src/components/gallery/PreCheckoutContactStep.tsx` (step
`pre_checkout_contact` em `ClientGallery.tsx`).

- Renderiza SEMPRE que `sale_with_payment` + valor a cobrar > 0 e faltar algum
  campo em `payerHints` (Nome, E-mail, WhatsApp, CPF/CNPJ), **regardless do
  provedor**.
- Persiste via RPC `upsert_visitor_contact`, que:
  - Atualiza `galeria_visitantes` (incluindo `cpf_cnpj`).
  - Atualiza a tabela unificada `clientes` (Gestão) preservando dados não vazios
    (`UPDATE ... WHERE campo IS NULL`) — não sobrescreve dados curados pelo
    fotógrafo.
- Após submit, `confirmMutation` é retomada com o payload guardado
  (`pendingConfirmPayload`) e o payerHints atualizado.

Novos provedores devem honrar esta etapa antes de qualquer redirect/inline
checkout — a decisão fica em `handleConfirm`, provedor-agnóstica.

---
Última atualização: 2026-07-10 (unificação fonte-de-verdade saleSettings + step pré-checkout universal).

