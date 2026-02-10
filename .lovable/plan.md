

# Separacao Definitiva: Download Deliver vs Select

## Diagnostico

O Worker tem o bypass `isDeliver` (linha 377), mas a rota `/download/` compartilha o mesmo fluxo para ambos os produtos. Isso causa fragilidade: qualquer mudanca no Select pode quebrar o Deliver e vice-versa.

A solucao e criar uma **rota dedicada no Worker** e um **modulo dedicado no frontend** para downloads Deliver.

## Arquitetura proposta

```text
Gallery Select:
  Frontend: downloadUtils.ts → /download/{path}
  Worker: handleDownload() → verifica finalized_at + allowDownload

Gallery Deliver:
  Frontend: deliverDownloadUtils.ts → /deliver-download/{path}
  Worker: handleDeliverDownload() → verifica APENAS tipo=entrega + foto pertence a galeria
```

## Mudancas

### 1. Worker: `cloudflare/workers/gallery-upload/index.ts`

**Nova funcao `handleDeliverDownload`** (separada de `handleDownload`):

- Extrai galleryId do path
- Consulta galeria com `tipo=entrega` (rejeita se nao for entrega)
- Verifica que a foto pertence a galeria (seguranca)
- Serve o arquivo com `Content-Disposition: attachment`
- SEM verificar `finalized_at`
- SEM verificar `allowDownload`
- SEM qualquer referencia a logica de selecao

**Nova rota no handler principal**:

```text
GET /deliver-download/{path} → handleDeliverDownload()
```

**Manter `handleDownload` intacto** para Select (remover o bypass `isDeliver` que nao pertence ali):

```text
GET /download/{path} → handleDownload() (apenas Select, sempre exige finalized_at + allowDownload)
```

### 2. Frontend: `src/lib/deliverDownloadUtils.ts` (NOVO)

Modulo dedicado para downloads Deliver, independente de `downloadUtils.ts`:

- `buildDeliverDownloadUrl(path, filename)` → usa rota `/deliver-download/`
- `downloadDeliverPhoto(galleryId, storagePath, filename)` → download individual via `<a>` direto
- `downloadAllDeliverPhotos(galleryId, photos, zipFilename, onProgress)` → Desktop: ZIP via JSZip / Mobile: sequencial com delay
- Reutiliza logica de ZIP e deteccao mobile (codigo proprio, sem importar de downloadUtils)

### 3. Frontend: `src/pages/ClientDeliverGallery.tsx`

- Trocar imports de `downloadUtils` para `deliverDownloadUtils`
- `handleDownloadSingle` → chamar `downloadDeliverPhoto`
- `handleDownloadAll` → chamar `downloadAllDeliverPhotos`

### 4. Frontend: `src/components/deliver/DeliverLightbox.tsx`

- Verificar se o lightbox tambem usa download. Se sim, garantir que usa o modulo Deliver.

### 5. Worker: Limpar `handleDownload`

- Remover o bloco `isDeliver` (linhas 377-394) pois agora o Deliver tem rota propria
- `handleDownload` volta a ser exclusivo para Select: sempre exige `finalized_at` + `allowDownload`
- Isso elimina qualquer risco de interferencia cruzada

## Arquivos

| Arquivo | Acao |
|---------|------|
| `cloudflare/workers/gallery-upload/index.ts` | Nova rota `/deliver-download/` + funcao `handleDeliverDownload` + limpar bypass isDeliver do handleDownload |
| `src/lib/deliverDownloadUtils.ts` | NOVO: modulo dedicado de download para Deliver |
| `src/pages/ClientDeliverGallery.tsx` | Trocar imports para deliverDownloadUtils |
| `src/components/deliver/DeliverLightbox.tsx` | Verificar e ajustar imports se necessario |

## Resultado

- Deliver NUNCA passa pelo fluxo de Select
- Erro "Gallery not finalized" impossivel em Deliver (rota diferente)
- Mudancas futuras no Select nao afetam Deliver
- Mudancas futuras no Deliver nao afetam Select
- Apos mudanca no Worker, deploy manual via `wrangler deploy`

