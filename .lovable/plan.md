# Plano: Estabilizar Pipeline de Upload de Fotos

## Diagnóstico

Após varredura completa do fluxo (cliente → compressão → Worker R2 → Edge Function `r2-upload` → DB), identifiquei **7 causas raiz** que provocam as falhas que exigem clicar em "tentar novamente":

### Evidências analisadas
- Logs do `r2-upload`: todos os POSTs recentes retornaram **200 OK** (892ms a 1942ms). Ou seja: quando a requisição chega ao servidor, ela funciona.
- Logs mostram **uploads em paralelo idênticos** chegando no mesmo milissegundo → indica que as falhas ocorrem **antes** do request chegar (compressão, sessão, ou Worker do Cloudflare).
- A função `compressImage` cria URL.createObjectURL mas **só revoga em caso de sucesso** (não no `catch`) → vazamento de memória que degrada lotes grandes.
- O `uploadOriginal` (Cloudflare Worker) não tem **retry**, ao contrário do `uploadPreview`. Se falhar 1x, o item inteiro vai para erro.
- O `getSession()` é chamado **a cada upload de original** dentro do pipeline. Em galerias com download habilitado e muitas fotos, pode disparar refresh de token concorrente.
- `maxUpload` padrão é 4-5 (4G), mas o Cloudflare Worker tem limite de CPU/memória. Sob concorrência alta, pode retornar 503/520.
- O `cleanupItem` zera `_compressed` no `catch`, **impossibilitando o retry** (precisa recomprimir tudo do zero, mas o status já está em `error` então `retry()` não recompõe o estado).
- `loadImage` não chama `URL.revokeObjectURL` se `img.onerror` dispara → vaza objeto.

---

## Correções propostas

### 1. Retry do upload do original (Worker Cloudflare) — **CRÍTICO**
**Arquivo:** `src/lib/uploadPipeline.ts` → método `uploadOriginal`.
Hoje uma falha transitória no Worker (timeout, 502, 503) mata o item inteiro. Vamos envolver com `retryWithBackoff` (3 tentativas, baseDelay 2s), mesmo padrão do `uploadPreview`. Adicionar tratamento explícito para `5xx` e `network error`.

### 2. Cache de session token + refresh proativo
**Arquivo:** `src/lib/uploadPipeline.ts`.
Cachear `session.access_token` no construtor do pipeline e revalidar apenas se faltarem <60s para expirar. Evita race conditions de refresh quando múltiplos uploads acontecem em paralelo.

### 3. Retry resiliente — preservar `_compressed` em caso de erro de upload
**Arquivo:** `src/lib/uploadPipeline.ts` → métodos `processItem` e `retry`.
Hoje, se a compressão funciona mas o upload falha, `cleanupItem` apaga o blob comprimido. No retry, o item recomprime do zero (gasto duplo de CPU + risco de OOM). Solução: só limpar `_compressed` quando o status final for `done`. No `retry()`, se `_compressed` ainda existe, pular direto para a fase de upload.

### 4. Reduzir concorrência padrão de upload (de 5 para 3)
**Arquivo:** `src/lib/uploadPipeline.ts` → `getDefaultUploadSlots`.
5 uploads simultâneos sobrecarregam o Worker e o navegador (especialmente com originais + previews = 10 conexões). Reduzir para `3` em 4G, `2` em 3G, `1` em 2G. Mantém vazão e reduz drasticamente erros transitórios.

### 5. Cleanup robusto de URL.createObjectURL
**Arquivo:** `src/lib/imageCompression.ts` → `loadImage` e `compressImage`.
Mover `URL.revokeObjectURL` para `finally` (em `compressImage`) e revogar também em `img.onerror` (em `loadImage`). Previne vazamento de memória que degrada lotes grandes (>50 fotos).

### 6. Timeout explícito no fetch do `uploadOriginal`
**Arquivo:** `src/lib/uploadPipeline.ts`.
Adicionar `AbortSignal.timeout(60000)` combinado com o signal existente via `AbortSignal.any([signal, AbortSignal.timeout(60000)])`. Hoje, um fetch travado no Worker pode ficar pendurado até o navegador desistir (~5min), bloqueando slots e forçando o usuário a esperar/cancelar.

### 7. Telemetria estruturada de erros
**Arquivo:** `src/lib/uploadPipeline.ts`.
Adicionar `console.warn` estruturado quando uma tentativa falha (com `attempt`, `phase`, `errorName`, `httpStatus` se disponível). Facilita diagnóstico futuro sem precisar de novo deploy.

---

## O que NÃO será alterado

- Edge Function `r2-upload` (logs confirmam que está saudável — todos 200).
- Worker Cloudflare (`gallery-upload/index.ts`) — não há sinais de bug; o problema é o cliente não retentar adequadamente.
- Lógica de créditos, idempotência (`upload_key`), e ownership da galeria.
- Lógica de pagamentos InfinitePay/Asaas/MercadoPago (intocada).
- Validação e fluxo de cobranças.
- Comportamento visual do `PhotoUploader` (apenas internamente mais resiliente).

---

## Resultado esperado

- Redução estimada de **80-90%** dos cliques manuais em "tentar novamente".
- Uploads em lotes grandes (>100 fotos) ficam estáveis sem degradação de memória.
- Retry automático cobre todas as falhas transitórias (Worker, R2, rede).
- Sem alteração visual perceptível para o usuário — apenas mais robusto.

---

## Arquivos modificados

- `src/lib/uploadPipeline.ts` (correções 1, 2, 3, 4, 6, 7)
- `src/lib/imageCompression.ts` (correção 5)

Nenhuma migração de banco. Nenhuma edge function alterada. Nenhum impacto em integrações de pagamento ou no projeto Lunari Studio.
