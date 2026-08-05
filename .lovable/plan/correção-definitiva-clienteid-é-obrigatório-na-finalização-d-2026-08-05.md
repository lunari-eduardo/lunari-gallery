# Correção definitiva: "clienteId é obrigatório" na finalização de galerias

## Diagnóstico (confirmado nos logs de agora, não é hipótese)

Galeria testada: `4wGectzJcJxE` (`gallery-access` logou `Fetching gallery with token: 4wGectzJcJxE` às 04:14 UTC).

Evidências desta sessão:

1. `confirm-selection` está **na versão do HEAD** — logou exatamente
   `[confirm-selection] Delegating to gallery-create-payment (provider=infinitepay) with preloaded…`,
   que é o formato atual do repositório.
2. `gallery-create-payment` está **numa versão antiga** — logou
   `[gallery-create-payment] Request: {"galleryId":"5212813d-…"}`.
   O HEAD (`v2.2.1-final`, linha 95 do arquivo) loga `[gcp][step:1 request] {...}`.
3. Resposta recebida: `gcp response (status 400): {"success":false,"error":"clienteId é obrigatório"}`
   → `❌ CRITICAL: gcp failed: [PAYMENT_CREATE_ERROR]` → rollback correto para `selecao_iniciada`.
4. A string `clienteId é obrigatório` **não existe em nenhum arquivo do repositório**
   (busca no projeto inteiro retornou zero ocorrências). Ela só pode vir do binário
   publicado antigo.

Conclusão: o código está certo. O ambiente Supabase está servindo uma build antiga
de **uma única função** do pipeline (`gallery-create-payment`). É a 4ª reincidência
do mesmo drift já documentado em `.lovable/pipeline-galeria-pagamento.md`.

Efeito no cliente: a seleção é revertida (rollback funciona, sem dado corrompido),
mas o cliente vê erro e não consegue pagar.

## Correção imediata

### 1. Redeploy atômico do pipeline

Redeploy conjunto (nunca isolado) de:

- `gallery-create-payment`
- `confirm-selection`
- `client-selection`
- `infinitepay-create-link`
- `mercadopago-create-link`

### 2. Canary obrigatório na galeria real

Contra a galeria `5212813d-6d35-4a61-8c8f-7002a89143c4` (token `4wGectzJcJxE`),
confirmar nos logs, em ordem:

- `[gcp][step:1 request]`
- `[gcp][step:3 calc-ok]` (ou `calc-preloaded`)
- `[gcp][step:6 calling] infinitepay-create-link`
- `[gcp][step:7 done] provedor=infinitepay cobrancaId=…`

E no banco: nova linha em `cobrancas` com `galeria_id` correto,
`finalidade='fotos_extras'`, `qtd_fotos=4`, `valor=100`, `status='pendente'`,
`ip_checkout_url` preenchido; cobranças antigas em `pendente` movidas para
`cancelado` pelo `step:5 cancel-stale`.

Se qualquer log divergir, o deploy não pegou — forçar de novo antes de seguir.

## Prevenção (o que faltou nas 3 vezes anteriores)

O contrato atual só descreve *como diagnosticar* o drift depois que o cliente
já quebrou. As três medidas abaixo fazem o sistema detectar e contornar sozinho.

### A. Version handshake entre caller e callee

- Constante `GCP_VERSION = 'v2.2.1'` exportada no topo de `gallery-create-payment`,
  devolvida em **toda** resposta (campo `version`) e no header `x-gcp-version`.
- `confirm-selection` e `client-selection` passam a enviar
  `expectedVersion: 'v2.2.1'` no body e comparar com o retorno.
- Divergência → log `⚠️ PIPELINE_VERSION_DRIFT expected=… got=…` (ou `got=unknown`
  quando a resposta não traz o campo, que é exatamente o caso da build antiga).
  Isso transforma um erro opaco de negócio num sinal inequívoco de deploy.

### B. Shim de compatibilidade (o cliente nunca mais vê o erro)

Em `confirm-selection` e `client-selection`, quando a chamada ao gcp falhar com
status 400 **e** a mensagem contiver `clienteId`:

1. Logar `⚠️ GCP_LEGACY_FALLBACK — build antiga detectada`.
2. Repetir a chamada **uma única vez** incluindo no body os campos que a build
   antiga exige: `clienteId` (de `gallery.cliente_id`, que o caller já tem em mãos
   — `confirm-selection` linha 573 e o bloco `preloaded` linha 638), `sessionId`,
   `valorTotal`, `extraCount`, `descricao`.
3. Se a repetição funcionar, o pagamento segue normalmente e o drift fica
   registrado no log em vez de virar incidente.
4. Se falhar de novo, mantém o rollback atual.

Isso é retrocompatibilidade explícita e barata: nenhum caminho do HEAD é alterado
(o gcp atual simplesmente ignora campos extras), e a galeria pública continua
funcionando quando `cliente_id` é `NULL` — o shim só preenche o que existir.

### C. Health check de versão do pipeline

- `gallery-create-payment` passa a aceitar `{ ping: true }` e responder
  `200 { ok: true, version: GCP_VERSION }` sem tocar em banco.
  Mesmo tratamento em `infinitepay-create-link` e `mercadopago-create-link`.
- Nova aba/cartão em `src/pages/Admin.tsx`: "Saúde do pipeline de pagamento",
  com botão que dispara os 3 pings e mostra, por função, a versão publicada
  contra a versão esperada — verde quando bate, vermelho com instrução de
  redeploy quando não bate.
- Ganho prático: dá para verificar em 2 segundos, antes de qualquer teste com
  cliente real, se o deploy pegou.

### D. Atualização do contrato

`.lovable/pipeline-galeria-pagamento.md` recebe, na mesma edição do código:

- Registro do incidente de 05/08/2026 (só o `gallery-create-payment` estava velho,
  o `confirm-selection` estava novo — prova de que o drift pode ser parcial e que
  redeploy isolado de uma função não é seguro).
- Descrição do handshake de versão, do shim legado e do endpoint de ping.
- Regra: ao subir versão do gcp, incrementar `GCP_VERSION` **e** o
  `expectedVersion` dos dois callers na mesma edição.

## Arquivos tocados

| Arquivo | Mudança |
| --- | --- |
| `supabase/functions/gallery-create-payment/index.ts` | `GCP_VERSION`, `version` na resposta + header, suporte a `{ping:true}` |
| `supabase/functions/confirm-selection/index.ts` | `expectedVersion`, detecção de drift, shim de retry legado |
| `supabase/functions/client-selection/index.ts` | idem, no caminho `regenerate_charge` |
| `supabase/functions/infinitepay-create-link/index.ts` | suporte a `{ping:true}` + versão |
| `supabase/functions/mercadopago-create-link/index.ts` | idem |
| `src/pages/Admin.tsx` | cartão "Saúde do pipeline de pagamento" |
| `.lovable/pipeline-galeria-pagamento.md` | incidente + novo contrato de versão |

## Ordem de execução

1. Aplicar as mudanças de código (A, B, C, D).
2. Redeploy atômico das 5 funções.
3. Ping das 3 funções pelo cartão do Admin — todas devem reportar a versão nova.
4. Canary na galeria `4wGectzJcJxE` com os 4 logs esperados.
5. Conferência no banco (`cobrancas` / `galerias.status_pagamento`).

Nada é declarado resolvido antes dos passos 3 e 4 passarem.
