# Plano — Correção de inconsistência InfinitePay (galeria pendente, sessão paga, sem redirect)

## Diagnóstico (galeria `cf82ec44`, cobrança `b3865b29`)

Estado atual no banco:
- `cobrancas`: `status='pago'`, `valor=5`, `qtd_fotos=0`, `tipo_cobranca='link'`, `descricao='1 foto extra - Teste'`, `galeria_id` correto, `extras_contabilizados=false`.
- `galerias`: `fotos_selecionadas=2`, `fotos_incluidas=1`, `status_pagamento='pago'`, **`total_fotos_extras_vendidas=0`**, **`valor_total_vendido=0`**.
- `clientes_sessoes`: `qtd_fotos_extra=1`, `valor_total_foto_extra=5`, `status_pagamento_fotos_extra='pago'` (correto).
- `webhook_logs`: 1 registro `status='processed'`, **`processed_at=NULL`** (anomalia — código atualiza para `processed` e `processed_at` juntos no fim).

### Causas-raiz identificadas

**1. RPC `finalize_gallery_payment` atualizou só parcialmente a galeria.**
O trigger `sync_gallery_on_cobranca_paid` (BEFORE UPDATE em `cobrancas`) marca `galerias.status_pagamento='pago'` ANTES da RPC fechar a cobrança. Quando a RPC depois entra em **BRANCH 1** (já pago) ela recalcula `sum_qtd` e `sum_val` e dispara `UPDATE galerias`. Mas:
- `extras_contabilizados` continua `false` → indica que o `UPDATE` não chegou a executar até o fim **ou** foi revertido/abortado.
- `processed_at=NULL` no `webhook_logs` confirma que o handler do webhook **não chegou ao bloco final** que atualiza o log para `processed_at=now()`. Logo **a função interrompeu/retornou cedo** — provavelmente exceção silenciosa entre o `update` da galeria e o `update` do log.

**2. Conflito entre dois caminhos de sincronização.**
- Trigger `sync_gallery_on_cobranca_paid` (em `cobrancas`) propaga para galeria/sessão **sem** valor/qtd — só status.
- RPC `finalize_gallery_payment` propaga **com** valor/qtd.
Quando o trigger roda primeiro e altera o status, o `OLD.status='pago'` na próxima reentrada faz a RPC entrar em BRANCH 1. Tudo bem. Mas a RPC ainda assim faz o UPDATE — só que `extras_contabilizados=false` indica que `UPDATE cobrancas SET extras_contabilizados=true` não aconteceu, ou seja, a RPC abortou na propagação para `clientes_sessoes` (que é o passo entre o `UPDATE galerias` e o `UPDATE cobrancas SET extras_contabilizados`). Possíveis disparadores: **trigger `protect_gallery_extras_downgrade` aborta a transação se algum recálculo intermediário tentar gravar `0` antes do valor correto** — por exemplo, se durante a mesma transação houve um UPDATE com `total=0` (vindo do trigger `cobrancas`?) e outro com `total=1`, o segundo dispara o trigger comparando `OLD=1 → NEW=0` em alguma reentrada e bloqueia.

A telemetria que comprova: `audit_log` não tem `blocked_extras_downgrade`, mas `processed_at` ficou `NULL` e `extras_contabilizados=false`. Sintoma típico de retorno cedo por exceção engolida pelo bloco `try/catch` do webhook.

**3. Sem redirecionamento à tela final.**
Após o checkout InfinitePay, o usuário volta à URL de retorno e a galeria fica em "Confirmada / Pendente" porque o `useGallery`/Edge `gallery-access` está lendo `valor_total_vendido=0` (o estado quebrado acima). Não há polling atual no `ClientGallery` quando o usuário volta do checkout — exibe direto o estado do banco.

## Mudanças propostas

### 2.1 — RPC `finalize_gallery_payment`: tornar atômica e idempotente
- Reordenar para que o **`UPDATE cobrancas SET extras_contabilizados=true`** seja a **última** operação, dentro do mesmo bloco. Se algo abortar antes, a próxima rodada (auto-heal) refaz tudo.
- Em **BRANCH 1 (já pago)**, sempre rodar a sincronização mesmo que `extras_contabilizados=true` quando `total_fotos_extras_vendidas` divergir de `GREATEST(selecionadas - incluidas, 0)` — recálculo defensivo.
- Adicionar `EXCEPTION WHEN OTHERS THEN INSERT INTO audit_log(...) ... RAISE;` no fim para capturar qualquer falha silenciosa.

### 2.2 — Trigger `sync_gallery_on_cobranca_paid`: parar de duplicar trabalho
- Remover o `UPDATE galerias` desse trigger. Toda a sincronização galeria/sessão passa a ser **responsabilidade exclusiva** da RPC `finalize_gallery_payment`. O trigger só fica para garantir `galeria_id` quando vier `NULL`.
- Elimina race condition entre dois caminhos.

### 2.3 — Trigger `protect_gallery_extras_downgrade`: tolerar update consistente
- Já permite `NEW.total = v_extras_selecionados`. Adicionar também: **permitir** quando `NEW.total >= GREATEST(selecionadas - incluidas, 0)` (nunca bloquear ajuste para o valor correto da seleção). Mantém bloqueio só para downgrades reais sem cobertura de seleção.

### 2.4 — Webhook InfinitePay: garantir `processed_at` em todos os caminhos
- Em `infinitepay-webhook/index.ts`, mover `update webhook_logs` para um `finally` real (helper) garantindo que `processed_at` sempre seja gravado, e logar o `rpcResult.gallery_synced` no campo `error_message` quando `false` para visibilidade.

### 2.5 — Backfill desta galeria + reconcile global
- Migration que chama `reconcile_gallery_extras_counters()` e força `extras_contabilizados=true` para cobranças `pago/pago_manual` cuja galeria já está sincronizada.

### 2.6 — Tela final pós-checkout: polling de sincronização
- No `ClientGallery.tsx`, quando o usuário retorna com `?paid=1` (ou flag equivalente do retorno InfinitePay), exibir overlay "Confirmando pagamento…" e fazer polling em `gallery-access` (ou `check-payment-status` quando houver `cobrancaId` na URL) por até **20s / 10 tentativas a cada 2s**, até `status_pagamento ∈ {pago, pago_manual}` **e** `valor_total_vendido > 0`. Só então renderizar a tela final "Galeria finalizada com sucesso".
- Garantir que `infinitepay-create-link` esteja gerando `redirect_url` com a flag de retorno (verificar e ajustar se faltar — sem quebrar contrato).

### 2.7 — Prevenção (regressão futura)
- Adicionar teste Deno em `infinitepay-webhook` simulando: cobrança pendente → webhook `paid` → asserts em `galerias.total_fotos_extras_vendidas`, `valor_total_vendido`, `clientes_sessoes`, `extras_contabilizados=true`, `webhook_logs.processed_at NOT NULL`.

## Arquivos afetados

- `supabase/migrations/<nova>.sql` — refatorar `finalize_gallery_payment`, simplificar `sync_gallery_on_cobranca_paid`, ajustar `protect_gallery_extras_downgrade`, backfill + reconcile.
- `supabase/functions/infinitepay-webhook/index.ts` — `finally` real para `webhook_logs`. **Sem alterar contrato compartilhado** (busca por `ip_order_nsu` → `id`, sem JWT).
- `src/pages/ClientGallery.tsx` — polling pós-retorno + overlay de sincronização.
- `supabase/functions/infinitepay-webhook/*_test.ts` — novo teste de regressão.

## Riscos & mitigação
- **Contrato webhook InfinitePay**: nenhuma mudança em headers, ordem de busca ou campos de `cobrancas` — só em `webhook_logs` e logs.
- **Triggers em produção**: a remoção do `UPDATE galerias` em `sync_gallery_on_cobranca_paid` poderia atrasar o status para clientes que dependem só do trigger; a RPC `finalize_gallery_payment` é chamada **em todos** os caminhos (webhook InfinitePay, Asaas, MP, manual), então é seguro.
- **Backfill** rodado em transação separada; sem risco para dados financeiros.

Aprovar para eu aplicar.
