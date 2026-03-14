

# Plano: Suporte a Upload de Vídeos em Galerias Transfer

## Análise de Custo

**R2 não cobra egress (saída de dados)**. O custo por view de vídeo é apenas o custo de operações GET do R2: **$0.36 por milhão de requests**. Mesmo um vídeo de 500MB sendo assistido 1.000 vezes custa ~$0.00036 em operações. O custo real é **armazenamento**: $0.015/GB/mês. Um vídeo de 200MB por galeria = ~$0.003/mês. **Conclusão: custo por view NÃO aumenta drasticamente.** O impacto principal é no storage, que já é controlado pelo sistema de limites existente.

Se no futuro quiser streaming adaptativo (HLS/DASH), aí sim precisaria de Cloudflare Stream ($1/1.000 min de vídeo armazenado + $0.01/1.000 min assistidos). Mas para MVP, servir o arquivo direto do R2 é suficiente e barato.

## Pontos de Impacto Identificados

| Camada | Arquivo | Problema atual |
|---|---|---|
| Validação | `imageCompression.ts` → `isValidImageType()` | Só aceita image/* |
| Input HTML | `PhotoUploader.tsx` → `<input accept>` | Só aceita .jpg/.png/.webp |
| Pipeline | `uploadPipeline.ts` → `processItem()` | Comprime via Canvas (impossível para vídeo) |
| Worker | `gallery-upload/index.ts` → `handleUpload()` | Content-type default `image/jpeg` |
| Edge Function | `r2-upload/index.ts` | Content-type default `image/jpeg` |
| Grid | `DeliverPhotoGrid.tsx` | Só renderiza `<img>` |
| Lightbox | `DeliverLightbox.tsx` | Só renderiza `<img>` |
| Photo Manager | `DeliverPhotoManager.tsx` | Só renderiza `<img>` |
| Thumbnails | Sem geração de thumbnail para vídeo | Vídeo não tem preview estático |
| DB | `galeria_fotos.mime_type` | Já suporta qualquer string — OK |

## Arquitetura da Solução

### Princípio: vídeos em Transfer são tratados como "arquivos grandes sem compressão"

```text
Vídeo selecionado
    │
    ├─ isVideoFile(file) = true
    │
    ├─ Pipeline: SKIP compressão
    │   └─ Upload direto ao Worker (upload-original + r2-upload)
    │   └─ Gerar thumbnail via <video> + Canvas (1º frame)
    │
    ├─ DB: mime_type = "video/mp4", width/height do vídeo
    │
    └─ Display: renderizar <video> no grid e lightbox
```

### Mudanças por Camada

**1. Validação e tipos (`imageCompression.ts` + novo `mediaValidation.ts`)**
- Criar helper `isValidMediaType(file)` que aceita imagens E vídeos (MP4, MOV, WEBM)
- Criar helper `isVideoFile(file)` para distinguir vídeo de imagem
- Limite de tamanho por vídeo: 500MB (vs 20MB para fotos)
- Aceitar: `video/mp4`, `video/quicktime` (.mov), `video/webm`

**2. PhotoUploader (`PhotoUploader.tsx`)**
- Atualizar `<input accept>` para incluir `.mp4,.mov,.webm,video/*` quando `skipCredits=true` (Transfer)
- Atualizar texto do dropzone: "JPG, PNG, WEBP, MP4, MOV"
- Validação de tamanho diferenciada: 500MB para vídeos, 20MB para fotos
- Preview no grid de upload: usar `<video>` com poster frame em vez de `<img>`

**3. Upload Pipeline (`uploadPipeline.ts`)**
- Detectar se arquivo é vídeo via `isVideoFile()`
- Se vídeo: **pular compressão**, ir direto ao upload
- Gerar thumbnail client-side: carregar `<video>`, seekar ao frame 1s, capturar via Canvas → usar como preview
- Upload original via Worker (rota existente `/upload-original`)
- Upload "preview" = o próprio arquivo de vídeo (sem compressão) via `r2-upload`

**4. Worker Cloudflare (`gallery-upload/index.ts`)**
- `handleUpload` e `handleUploadOriginal`: aceitar content-types de vídeo (já dinâmico via `file.type`, sem mudança necessária)
- `handleServe`: ajustar `Cache-Control` para vídeos (não cachear imutável arquivos grandes) e suportar Range requests para streaming

**5. Edge Function `r2-upload`**
- Remover fallback `image/jpeg` — usar `file.type` diretamente
- Sem mudança na lógica de créditos (Transfer já usa `skipCredits=true`)

**6. Display — Grid (`DeliverPhotoGrid.tsx`)**
- Verificar `mime_type` do item: se `video/*`, renderizar `<video>` com `muted autoplay loop playsInline` como preview curto
- Manter overlay de download e click para lightbox

**7. Display — Lightbox (`DeliverLightbox.tsx`)**
- Se item é vídeo: renderizar `<video controls>` em vez de `<img>`
- Manter navegação por setas e download

**8. Photo Manager (`DeliverPhotoManager.tsx`)**
- Thumbnail de vídeo: usar ícone de play sobre a preview ou `<video>` muted
- Funcionalidade de delete já funciona (é por storage_key)

**9. Download (`deliverDownloadUtils.ts`)**
- Sem mudanças necessárias — já trata arquivos genéricos por storage path

**10. Página do cliente (`ClientDeliverGallery.tsx`)**
- Passar `mime_type` na interface `DeliverPhoto` para que grid/lightbox saibam o tipo

## Arquivos a criar/editar

| Arquivo | Ação |
|---|---|
| `src/lib/mediaValidation.ts` | **Criar** — helpers `isVideoFile`, `isValidMediaType`, `generateVideoThumbnail` |
| `src/lib/uploadPipeline.ts` | **Editar** — bypass compressão para vídeos, gerar thumbnail via `<video>` |
| `src/components/PhotoUploader.tsx` | **Editar** — aceitar vídeos no input/dropzone, preview de vídeo |
| `src/components/deliver/DeliverPhotoGrid.tsx` | **Editar** — renderizar `<video>` para mime_type video/* |
| `src/components/deliver/DeliverLightbox.tsx` | **Editar** — player de vídeo com controls |
| `src/components/deliver/DeliverPhotoManager.tsx` | **Editar** — preview de vídeo no grid de gerenciamento |
| `src/pages/ClientDeliverGallery.tsx` | **Editar** — incluir `mimeType` no mapeamento de fotos |
| `cloudflare/workers/gallery-upload/index.ts` | **Editar** — suporte a Range requests em `handleServe` |
| `supabase/functions/r2-upload/index.ts` | **Editar** — remover fallback `image/jpeg` |
| `src/lib/imageCompression.ts` | **Editar** — atualizar `isValidImageType` (manter para Select) |

## Limitações e decisões

- **Sem transcoding**: vídeos são armazenados e servidos como enviados. Se o fotógrafo enviar um .mov de 2GB, será servido assim. Transcoding (ffmpeg) seria caro e complexo.
- **Range requests**: essencial para que o navegador possa fazer seek no vídeo sem baixar tudo. Cloudflare R2 já suporta nativamente; o Worker precisa propagar os headers.
- **Somente Transfer**: galerias Select continuam aceitando apenas imagens (mantém `isValidImageType` existente).
- **Thumbnail de vídeo**: gerado client-side no momento do upload (frame do 1º segundo). Se falhar, usa ícone genérico de vídeo.

