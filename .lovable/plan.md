

# Plano: Correção Definitiva do Download

## Problemas Identificados (2 bugs concretos)

### Bug 1: "Baixar Todas" retorna 400 (Bad Request)

**Causa raiz**: Quando a galeria esta finalizada, a Edge Function `gallery-access` retorna `{ finalized: true, photos: [...] }` -- sem o campo `gallery.id`. O codigo do frontend calcula `galleryId` assim:

```text
supabaseGallery = galleryResponse.gallery  --> undefined (nao existe no response finalized)
galleryId = supabaseGallery?.id || ...     --> null
FinalizedPreviewScreen recebe galleryId=""  --> Edge Function rejeita com 400
```

**Correcao**: Incluir o `galleryId` na resposta da Edge Function `gallery-access` para galerias finalizadas.

Arquivo: `supabase/functions/gallery-access/index.ts` (linha 104)

Adicionar `galleryId: gallery.id` no JSON de retorno do bloco finalized.

E no frontend, extrair esse ID:

Arquivo: `src/pages/ClientGallery.tsx` (linha ~188)

Atualizar a logica de `galleryId` para tambem considerar `galleryResponse.galleryId` (retorno do finalized).

---

### Bug 2: Download individual abre imagem em vez de baixar

**Causa raiz**: O atributo `<a download="filename.jpg">` so funciona para URLs do **mesmo dominio** (same-origin). Para URLs cross-origin como B2 (`f005.backblazeb2.com`), o browser ignora o `download` e abre a imagem normalmente.

Isso afeta tanto o download individual (Lightbox) quanto o "Baixar Todas" (downloads sequenciais).

**Solucao**: Usar `b2ResponseContentDisposition` -- parametro do B2 que forca o header `Content-Disposition: attachment` na resposta. Quando adicionado a signed URL, o B2 retorna o arquivo como download em vez de renderizar no browser.

Arquivo: `supabase/functions/b2-download-url/index.ts`

Na construcao da signed URL, adicionar o parametro:

```
signedUrl + "&b2ContentDisposition=attachment;filename=" + encodedFilename
```

Isso garante que o B2 retorne `Content-Disposition: attachment; filename="nome.jpg"` e o browser force o download automatico.

---

## Regra de Arquitetura (reforco)

O botao de download ja aparece SOMENTE nos locais corretos:
- `FinalizedPreviewScreen` -- somente se `allowDownload && hasDownloadablePhotos`
- Confirmed selection view -- somente se `gallery.settings.allowDownload`
- Lightbox -- somente em `isConfirmedMode` com `allowDownload`

Nenhum botao de download aparece durante a selecao ativa. Isso ja esta correto.

---

## Arquivos a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/gallery-access/index.ts` | Adicionar `galleryId` na resposta finalized |
| `src/pages/ClientGallery.tsx` | Extrair `galleryId` do response finalized |
| `supabase/functions/b2-download-url/index.ts` | Adicionar `b2ContentDisposition` na signed URL |

---

## Fluxo Corrigido

```text
1. Cliente acessa galeria finalizada
2. gallery-access retorna { finalized: true, galleryId: "6c231190-..." }
3. FinalizedPreviewScreen recebe galleryId correto
4. "Baixar Todas" envia galleryId + originalPaths para b2-download-url
5. Edge Function retorna signed URLs com b2ContentDisposition=attachment
6. triggerBrowserDownload(<a>) redireciona para B2
7. B2 retorna Content-Disposition: attachment --> browser forca download
```

---

## Secao Tecnica: b2ContentDisposition

O Backblaze B2 suporta o parametro `b2ContentDisposition` em URLs de download autorizadas. Quando presente:

- O B2 inclui o header `Content-Disposition` na resposta HTTP
- O browser interpreta como download forcado
- Funciona em todos os browsers (Chrome, Safari, Firefox, mobile)
- Nao requer CORS, proxy ou Edge Function adicional
- Documentacao: https://www.backblaze.com/docs/cloud-storage-download-files

Formato: `?Authorization=TOKEN&b2ContentDisposition=attachment%3B%20filename%3D%22nome.jpg%22`
