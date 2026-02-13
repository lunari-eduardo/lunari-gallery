
# Pipeline de Upload Contínuo — Implementado

## Status: ✅ Implementado (sem Web Worker)

## O que mudou

### 1. `src/lib/uploadPipeline.ts` (NOVO)
- Classe `UploadPipeline` com fila contínua de dois estágios (Compressão → Upload)
- Cada foto flui individualmente — uploads começam em ~2s após seleção
- Concorrência controlada: max 2 compressões, 4-5 uploads (adaptável via Network API)
- `AbortController` por item para cancelamento real
- Liberação agressiva de memória: blobs e referências nullificados após upload
- Fallback: se compressão falha (e watermark não é obrigatório), envia original
- Auto-retry integrado via `retryWithBackoff`

### 2. `src/lib/retryFetch.ts` (MODIFICADO)
- Adicionado suporte a `AbortSignal` em `RetryOptions`
- Check de `signal.aborted` antes de cada tentativa

### 3. `src/components/PhotoUploader.tsx` (REFATORADO)
- Substituído lógica de lotes `Promise.all` pela classe `UploadPipeline`
- Adicionado botão "Cancelar tudo" durante upload
- Barra de progresso geral quando múltiplas fotos
- Estados mais granulares: `uploading-original`, `uploading-preview`
- Pipeline criado lazy e destruído no unmount

## Pendente (Fase 2)
- Web Worker com `OffscreenCanvas` para compressão off-main-thread
