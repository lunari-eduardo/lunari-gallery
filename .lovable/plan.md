# Correção: erro "clienteId é obrigatório" ao finalizar seleção

## Diagnóstico (confirmado nos logs, não é hipótese)

O código do repositório está correto. O que está errado é a **versão publicada** das
funções na Supabase — é exatamente o cenário de drift já documentado em
`.lovable/pipeline-galeria-pagamento.md` (seção "Cenário de drift").

Evidências coletadas agora:

1. Logs de borda (01/08 02:33 UTC): `POST /confirm-selection → 500` precedido de
   `POST /gallery-create-payment → 400`. O 500 do `confirm-selection` é apenas o
   repasse do erro do gcp (ele devolve `paymentData.error` com status 500).
2. Log da função `gallery-create-payment` publicada:
   `INFO [gallery-create-payment] Request: {"galleryId":"1e3b9dea-..."}`.
   O HEAD do repositório (v2.2) loga `[gcp][step:1 request] {...}` — ou seja, a
   Supabase está servindo uma versão **anterior**, que exige `clienteId` no body
   e responde `400 { error: "clienteId é obrigatório" }`.
3. A string "clienteId é obrigatório" **não existe** em nenhum arquivo do
   repositório nem em nenhuma função do Postgres (`pg_proc` verificado) —
   confirma que vem do binário publicado antigo.
4. O mesmo log mostra que o body recebido foi só `{ galleryId }`, sem
   `provider`/`context`/`preloaded` — logo o `confirm-selection` publicado
   **também** é uma versão antiga (o HEAD envia o payload completo com fast-path).

Conclusão: nenhuma linha de código precisa mudar para resolver o erro. É preciso
forçar o redeploy atômico do pipeline e validar com canary.

## O que será feito

### 1. Redeploy atômico das 4 funções do pipeline (obrigatório em conjunto)

- `gallery-create-payment`
- `confirm-selection`
- `infinitepay-create-link`
- `mercadopago-create-link`

Mais `client-selection` (mesmo contrato, chama o gcp no fluxo de reabertura/
"gerar novo link") e o shared `_shared/session-sync.ts` / `_shared/payer-hints.ts`
que sobem junto com elas.

### 2. Canary pós-deploy (conforme o contrato do pipeline)

Executar contra a galeria real usada no teste (`1e3b9dea-b657-4def-9bb4-6da3cf8896e0`):

- Confirmar nos logs a presença de `[gcp][step:1 request]`,
  `[gcp][step:3 calc-ok ...]` ou `calc-preloaded`, `[gcp][step:6 calling]
  infinitepay-create-link` e `[gcp][step:7 done] cobrancaId=...`.
- Se qualquer um desses logs não aparecer, o deploy não pegou → forçar novamente
  antes de declarar resolvido.

### 3. Verificação de estado no banco após o canary

- `cobrancas`: nova linha com `galeria_id` correto, `finalidade='fotos_extras'`,
  `qtd_fotos > 0`, `status='pendente'`, `ip_checkout_url` preenchido.
- `galerias`: `status_pagamento='pendente'`.
- Conferir se sobraram cobranças antigas em `pendente` não canceladas (o
  `step:5 cancel-stale` deve tê-las movido para `cancelado`).

### 4. Guarda contra reincidência (baixo custo)

O drift já aconteceu 3 vezes. Além do redeploy, será adicionado ao
`.lovable/pipeline-galeria-pagamento.md`:

- Um **marcador de versão** explícito no primeiro log de cada uma das 4 funções
  (`[gcp v2.2]`, `[cs v?]`, etc.) e a regra: antes de investigar qualquer erro do
  pipeline, ler o primeiro log da função e comparar com a versão do HEAD. Se
  divergir, o diagnóstico é drift — redeploy antes de qualquer outra hipótese.
- Registro deste incidente (01/08/2026) na seção "Cenário de drift".

## Observação sobre a função `gestao-infinitepay-create-link`

Os logs mostram uma função `gestao-infinitepay-create-link` respondendo 200 pouco
antes do teste. Ela pertence ao projeto Gestão e não faz parte deste pipeline —
não será tocada, apenas registrada no contrato para evitar confusão futura entre
as duas funções de mesmo propósito.

## Detalhes técnicos

- O 500 no `confirm-selection` não é bug próprio: em `index.ts` (bloco do gcp) ele
  faz `rollbackGalleryStatus()` e devolve `500` com a mensagem vinda do gcp. Como o
  gcp antigo devolve `400 "clienteId é obrigatório"`, é essa string que chega no
  toast. Após o redeploy, esse caminho deixa de ser acionado.
- O rollback funcionou corretamente (a galeria não ficou finalizada indevidamente),
  então não há dado corrompido a limpar — a ser confirmado na etapa 3.
