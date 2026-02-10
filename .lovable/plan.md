

# Correcao Definitiva de Download

## Diagnostico

O problema NAO esta no Worker (que ja tem o bypass para Deliver). O problema esta no frontend:

1. **`triggerBrowserDownload`** usa `target="_blank"` -- navegadores bloqueiam como popup
2. **"Baixar Todas"** tenta disparar multiplos cliques em `<a target="_blank">` em loop -- apenas o primeiro funciona
3. Nao existe suporte a ZIP -- o parametro `zipFilename` e recebido mas ignorado

## Solucao

### 1. Reescrever `src/lib/downloadUtils.ts`

**Download individual** -- Remover `target="_blank"`. O Worker ja retorna `Content-Disposition: attachment`, entao basta navegar com `<a href>` sem abrir nova aba. O navegador faz download sem sair da pagina.

```text
triggerBrowserDownload:
  - REMOVER target="_blank"
  - REMOVER rel="noopener noreferrer"
  - Manter apenas href + download + click()
```

**Download em massa (ZIP)** -- Usar biblioteca `jszip` para criar ZIP no client-side:

```text
1. fetch() cada foto via Worker URL (Content-Disposition nao afeta fetch)
2. Adicionar blob ao JSZip
3. Gerar ZIP blob
4. Criar URL.createObjectURL(zipBlob)
5. Disparar download do ZIP via <a download>
6. Revogar blob URL
```

**Download em massa (Mobile Deliver)** -- Sequencial com delays (mantido como fallback):

```text
1. Detectar mobile via window check
2. Se mobile + Deliver: download sequencial com 1.5s delay
3. Se desktop ou Select: sempre ZIP
```

### 2. Adicionar dependencia `jszip`

Necessaria para gerar ZIP no navegador.

### 3. Atualizar callers

**`src/lib/downloadUtils.ts`** -- Nova API:

```text
downloadPhoto(galleryId, storagePath, filename)
  -> Sem target="_blank", download direto

downloadAllPhotos(galleryId, photos, zipFilename, onProgress)
  -> Desktop: gera ZIP via JSZip
  -> Mobile (se isMobileDevice): sequencial

downloadAllPhotosSequential(galleryId, photos, onProgress)
  -> Usado internamente para mobile
```

**Componentes que usam download (sem mudanca de interface, apenas comportamento interno melhora)**:

- `ClientDeliverGallery.tsx` -- ja chama `downloadPhoto` e `downloadAllPhotos` corretamente
- `DeliverLightbox.tsx` -- ja chama `onDownload(photo)` corretamente
- `DownloadModal.tsx` -- ja chama `downloadAllPhotos` corretamente
- `FinalizedPreviewScreen.tsx` -- ja chama `downloadAllPhotos` corretamente
- `Lightbox.tsx` -- ja chama `downloadPhoto` corretamente

Nenhum componente precisa mudar. Apenas `downloadUtils.ts` muda internamente.

### 4. Nome do ZIP

Formato: `nome-da-sessao_fotos.zip` (sanitizado, sem caracteres especiais)

Esse nome ja e passado como parametro `zipFilename` por todos os callers. Agora sera efetivamente usado.

## Arquivos

| Arquivo | Acao |
|---------|------|
| `package.json` | Adicionar `jszip` como dependencia |
| `src/lib/downloadUtils.ts` | Reescrever: individual sem popup, massa via ZIP |

## Resultado esperado

- Download individual: clique direto, sem popup, sem tela preta
- Download em massa desktop: ZIP unico com barra de progresso
- Download em massa mobile (Deliver): sequencial com delay
- Gallery Select: ZIP obrigatorio no "Baixar Todas"
- Gallery Deliver: ZIP no desktop, sequencial no mobile
- Nenhuma mensagem tecnica visivel ao usuario

