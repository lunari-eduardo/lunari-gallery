# Plano: Corrigir Download via B2 com Signed URLs

## ✅ Status: IMPLEMENTADO

## Problema Identificado

O fluxo de download de fotos originais falhava porque o frontend tentava fazer `fetch()` diretamente do Backblaze B2, que bloqueava por CORS.

## Solução Implementada: Signed URLs via Edge Function

### Arquivos Criados/Modificados

| Arquivo | Ação |
|---------|------|
| `supabase/functions/b2-download-url/index.ts` | ✅ CRIADO - Edge function para gerar signed URLs |
| `supabase/config.toml` | ✅ MODIFICADO - Adicionado verify_jwt = false |
| `src/lib/downloadUtils.ts` | ✅ MODIFICADO - Usa signed URLs via edge function |
| `src/components/DownloadModal.tsx` | ✅ MODIFICADO - Recebe galleryId |
| `src/components/FinalizedPreviewScreen.tsx` | ✅ MODIFICADO - Recebe galleryId |
| `src/components/Lightbox.tsx` | ✅ MODIFICADO - Recebe galleryId para downloads |
| `src/pages/ClientGallery.tsx` | ✅ MODIFICADO - Passa galleryId para componentes |

### Fluxo Correto (Signed URLs)

```text
  Cliente clica em "Baixar Todas (ZIP)"
      │
      ▼
  Frontend chama Edge Function:
      POST /b2-download-url
      body: { galleryId, storageKeys }
      │
      ▼
  Edge Function:
      1. Valida permissão (galeria finalizada + allowDownload = true)
      2. Valida que fotos pertencem à galeria
      3. Gera b2_get_download_authorization token
      4. Retorna signed URLs para cada arquivo
      │
      ▼
  Frontend:
      - Individual: window.location.href = signedUrl (redirect nativo)
      - ZIP: fetch(signedUrl) sem CORS issues (token no URL)
```

### Validações de Segurança

1. **Galeria finalizada**: `finalized_at IS NOT NULL`
2. **Download permitido**: `configuracoes->'allowDownload' = true`
3. **Fotos pertencem à galeria**: Verificação no banco
4. **URLs expiram**: 1 hora de validade
5. **Limite de arquivos**: Máximo 500 por requisição

### Resultado

| Cenário | Antes | Depois |
|---------|-------|--------|
| Download individual | Erro CORS | ✅ Redirect nativo funciona |
| Download ZIP | Erro CORS + 404 | ✅ Fetch funciona via signed URL |
| Segurança | - | ✅ URLs expiram em 1 hora |
