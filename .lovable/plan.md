# Estabilização do Pipeline de Upload — Concluído

## Correções implementadas (26/04/2026)

### `src/lib/uploadPipeline.ts`
1. **Retry no upload do original**: `uploadOriginal` agora usa `retryWithBackoff` (3 tentativas, 2s base) com tratamento de 5xx e network errors. Antes uma única falha do Worker matava o item.
2. **Cache de access token**: novo método `getAccessToken()` cacheia o token e só re-busca quando faltam <60s para expirar. Coalesce promises concorrentes para evitar refresh duplicado.
3. **Retry resumível**: `processItem` reaproveita `_compressed` e `_originalPath` quando existem, evitando recomprimir/re-uploadar ao retentar. `cleanupItem` agora aceita `keepResumeState`.
4. **Concorrência reduzida**: `getDefaultUploadSlots` retorna 3 (era 5) em 4G, evitando saturar o Worker e o connection pool do navegador.
5. **Timeout de 90s** no fetch do upload do original via `combineSignals([signal, AbortSignal.timeout(90000)])` (com polyfill).
6. **Telemetria estruturada**: `logUploadWarn(phase, item, err, extra)` registra falhas com fase, contador de retry, estado de compressão/original.

### `src/lib/imageCompression.ts`
7. **Cleanup robusto de URL.createObjectURL**: `loadImage`, `compressImage` e `compressCover` agora revogam o object URL em `finally` (mesmo em erro). Adicionado `canvas.width = 0; canvas.height = 0` para liberar memória do canvas mais agressivamente.

## Resultado
- TypeScript build limpo (`bunx tsc --noEmit`).
- Sem alteração visual.
- Edge Function `r2-upload` e Worker Cloudflare intocados (já estavam saudáveis).
- Integrações de pagamento (InfinitePay/Asaas/MercadoPago) intocadas.
