

# Plano: Corrigir Download via B2 com Signed URLs

## Problema Identificado

O fluxo de download de fotos originais falha porque o frontend tenta fazer `fetch()` diretamente do Backblaze B2:

```text
FLUXO ATUAL (COM BUG)
─────────────────────────────────────────────────────────────────────────

  Cliente clica em "Baixar Todas (ZIP)"
      │
      ▼
  downloadUtils.ts executa:
      fetch("https://f005.backblazeb2.com/file/lunari-gallery/...")
      │
      ▼
  ERRO: CORS Policy
  "No 'Access-Control-Allow-Origin' header"
      │
      ▼
  Alguns arquivos retornam 404 (path incorreto ou arquivo não existe)
      │
      ▼
  Download falha completamente
```

O B2 bloqueia requisições cross-origin do browser. Isso é esperado e correto para buckets privados.

## Solução: Signed URLs via Edge Function

A abordagem correta é gerar URLs temporárias assinadas no backend, e o browser acessa essas URLs diretamente (sem fetch):

```text
FLUXO CORRETO (SIGNED URLS)
─────────────────────────────────────────────────────────────────────────

  Cliente clica em "Baixar Todas (ZIP)"
      │
      ▼
  Frontend chama Edge Function:
      POST /b2-download-url
      body: { storageKeys: ["galleries/xxx/foto1.jpg", ...] }
      │
      ▼
  Edge Function:
      1. Valida permissão (galeria finalizada + allowDownload = true)
      2. Gera b2_get_download_authorization token
      3. Retorna signed URLs para cada arquivo
      │
      ▼
  Frontend:
      OPÇÃO A (individual): window.location.href = signedUrl
      OPÇÃO B (ZIP): fetch(signedUrl) sem CORS issues (mesma origem do redirect)
```

## Por que Signed URLs Funcionam

A URL assinada inclui o token de autorização como query parameter:
```
https://f005.backblazeb2.com/file/lunari-gallery/galleries/xxx/foto.jpg?Authorization=eyJhbG...
```

Isso permite que o browser faça download nativo SEM precisar de headers CORS.

## Implementação Técnica

### 1. Nova Edge Function: `b2-download-url`

```typescript
// supabase/functions/b2-download-url/index.ts

// Endpoint: POST /b2-download-url
// Body: { galleryId: string, storageKeys: string[] }
// Response: { urls: { storageKey: string, url: string, expiresAt: string }[] }

// Flow:
// 1. Validate gallery is finalized and allowDownload = true
// 2. Validate photos belong to this gallery
// 3. Call b2_authorize_account to get authToken
// 4. Call b2_get_download_authorization for file prefix
// 5. Build signed URLs with ?Authorization=token
// 6. Return URLs (valid for N seconds)
```

### 2. Atualizar `downloadUtils.ts`

```typescript
// ANTES (bloqueado por CORS)
const url = getOriginalPhotoUrl(storageKey);
const response = await fetch(url, { mode: 'cors' });

// DEPOIS (signed URL)
// 1. Chamar edge function para obter URLs assinadas
const signedUrls = await getSignedDownloadUrls(galleryId, storageKeys);

// 2. Para download ZIP: fetch das signed URLs
// 3. Para download individual: window.location.href = signedUrl
```

### 3. Download Individual vs ZIP

| Tipo | Comportamento |
|------|---------------|
| Individual | `window.location.href = signedUrl` (redirect nativo) |
| ZIP | `fetch(signedUrl)` funciona porque não precisa de CORS em redirect |

## Arquivos a Criar/Modificar

| Arquivo | Ação |
|---------|------|
| `supabase/functions/b2-download-url/index.ts` | **CRIAR** - Nova edge function |
| `src/lib/downloadUtils.ts` | **MODIFICAR** - Usar signed URLs |
| `src/lib/photoUrl.ts` | **MODIFICAR** - Adicionar helper para signed URLs |
| `src/components/DownloadModal.tsx` | **MODIFICAR** - Passar galleryId |
| `src/components/FinalizedPreviewScreen.tsx` | **MODIFICAR** - Passar galleryId |
| `src/components/Lightbox.tsx` | **MODIFICAR** - Download individual com signed URL |

## Detalhes da Edge Function

### Request
```json
{
  "galleryId": "uuid-da-galeria",
  "storageKeys": [
    "galleries/xxx/1770595297840-79d35baa.jpg",
    "galleries/xxx/1770595297828-fa7ca897.jpg"
  ]
}
```

### Response
```json
{
  "success": true,
  "urls": [
    {
      "storageKey": "galleries/xxx/1770595297840-79d35baa.jpg",
      "url": "https://f005.backblazeb2.com/file/lunari-gallery/galleries/xxx/1770595297840-79d35baa.jpg?Authorization=eyJhbG...",
      "expiresAt": "2026-02-09T01:00:00Z"
    }
  ],
  "expiresIn": 3600
}
```

### Validações de Segurança

1. **Galeria finalizada**: `finalized_at IS NOT NULL`
2. **Download permitido**: `configuracoes->'allowDownload' = true`
3. **Fotos pertencem à galeria**: Verificar `galeria_id` de cada foto
4. **Rate limiting**: Máximo X requisições por minuto

## Fluxo de Download em Lote (ZIP)

```text
┌─────────────────────────────────────────────────────────────────────────┐
│  DOWNLOAD ZIP COM SIGNED URLS                                           │
└─────────────────────────────────────────────────────────────────────────┘

  1. Usuario clica "Baixar Todas (ZIP)"
      │
  2. Frontend coleta storageKeys das fotos selecionadas
      │
  3. Frontend chama: POST /b2-download-url
      │
      ├── Edge Function valida permissoes
      ├── Edge Function gera token B2
      ├── Edge Function retorna URLs assinadas
      │
  4. Frontend recebe array de signed URLs
      │
  5. Para cada URL:
      │
      ├── fetch(signedUrl) <-- Funciona! Sem CORS porque é redirect
      ├── Adiciona ao JSZip
      │
  6. Gera blob do ZIP
      │
  7. saveAs(zipBlob, "fotos.zip")
```

## Resultado Esperado

| Cenario | Antes | Depois |
|---------|-------|--------|
| Download individual | Erro CORS | Redirect nativo funciona |
| Download ZIP | Erro CORS + 404 | Fetch funciona via signed URL |
| Fotos no view | Imagens quebradas | Carregam corretamente |
| Segurança | - | URLs expiram em 1 hora |

## Configuração Necessária (Secrets)

Os seguintes secrets já existem e serão utilizados:
- `B2_APPLICATION_KEY_ID`
- `B2_APPLICATION_KEY`
- `B2_BUCKET_ID`
- `B2_BUCKET_NAME`

## Observação sobre 404

Os erros 404 indicam que alguns `storageKey` não correspondem a arquivos existentes no B2. Isso pode ocorrer se:
1. O arquivo nunca foi salvo no B2 (apenas no R2)
2. O path está incorreto no banco
3. O arquivo foi deletado

A edge function deve tratar isso graciosamente e retornar apenas URLs para arquivos que existem.

