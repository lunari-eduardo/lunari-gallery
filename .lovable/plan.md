# Plano: Sistema de Download de Fotos Originais

## ✅ Status: TOTALMENTE IMPLEMENTADO

---

## Fase 1: Signed URLs para Download (COMPLETO)

### Problema
O frontend tentava `fetch()` direto do B2, que bloqueava por CORS.

### Solução
Edge function `b2-download-url` gera URLs assinadas com token no query parameter.

---

## Fase 2: Upload Dual (B2 + R2) quando allowDownload=true (COMPLETO)

### Problema
Quando `allowDownload = true`, o sistema só fazia upload do preview para R2, descartando o original. Isso causava 404 no download porque o arquivo original nunca era salvo no B2.

### Solução: Upload Dual

```text
FLUXO DE UPLOAD COM allowDownload = true
─────────────────────────────────────────────────────────────────────────

  Usuário seleciona foto
      │
      ▼
  PhotoUploader.tsx verifica: allowDownload === true?
      │
  ┌───┴───────────────────────────────────────────────────────────────┐
  │ SEQUÊNCIA CRÍTICA:                                                 │
  │                                                                    │
  │ 1. PRIMEIRO: Upload do ORIGINAL para B2 (sem compressão)          │
  │    → b2-upload com flag isOriginalOnly=true                        │
  │    → Retorna b2_path                                               │
  │                                                                    │
  │ 2. DEPOIS: Compressão com watermark                               │
  │    → compressImage() aplica marca d'água                          │
  │                                                                    │
  │ 3. POR FIM: Upload do preview para R2                             │
  │    → r2-upload com originalPath=b2_path                           │
  │    → Salva ambos os paths no banco                                │
  │                                                                    │
  └────────────────────────────────────────────────────────────────────┘
      │
      ▼
  Banco de dados (galeria_fotos):
      ├── storage_key = path do preview no R2 (para visualização)
      └── original_path = path do original no B2 (para download)
```

### Arquivos Modificados

| Arquivo | Alteração |
|---------|-----------|
| `src/components/PhotoUploader.tsx` | Nova prop `allowDownload`, upload para B2 antes da compressão |
| `supabase/functions/r2-upload/index.ts` | Aceita `originalPath` e salva no campo `original_path` |
| `supabase/functions/b2-upload/index.ts` | Flag `isOriginalOnly` para skip de créditos/DB record |
| `supabase/functions/b2-download-url/index.ts` | Usa `original_path` em vez de `storage_key` |
| `src/pages/GalleryCreate.tsx` | Passa `allowDownload` para PhotoUploader |
| `src/components/FinalizedPreviewScreen.tsx` | Usa `originalPath` para download, verifica existência |
| `src/components/Lightbox.tsx` | Download individual usa `originalPath` |

---

## Arquitetura de Storage Final

| Arquivo | Storage | Campo no DB | Uso | Condição |
|---------|---------|-------------|-----|----------|
| Preview (com watermark) | Cloudflare R2 | `storage_key` | Visualização, seleção | **Sempre** |
| Original (sem watermark) | Backblaze B2 | `original_path` | Download após confirmação | **Apenas se allowDownload = true** |

---

## Regras de Negócio

1. **Exibição (thumbnails, lightbox, fullscreen)**: Sempre usa `storage_key` (R2 preview com watermark)
2. **Download**: Sempre usa `original_path` (B2 original) via signed URL
3. **Sem original no B2 = Sem botão de download**: UI verifica se `original_path` existe
4. **allowDownload = true durante upload**: Upload duplo obrigatório (B2 + R2)
5. **allowDownload = false durante upload**: Apenas R2, original descartado

---

## Fluxo de Download (Signed URLs)

```text
  Cliente clica em "Baixar Todas (ZIP)"
      │
      ▼
  Frontend chama: POST /b2-download-url
      body: { galleryId, storageKeys: [original_path values] }
      │
      ▼
  Edge Function:
      1. Valida: galeria finalizada + allowDownload = true
      2. Valida: fotos têm original_path (não null)
      3. Gera token via b2_get_download_authorization
      4. Retorna signed URLs (válidas por 1 hora)
      │
      ▼
  Frontend:
      - Individual: redirect nativo (window.location.href)
      - ZIP: fetch → blob → JSZip → saveAs
```

---

## Validações de Segurança

- Galeria deve estar finalizada (`finalized_at IS NOT NULL`)
- Download deve estar permitido (`configuracoes->'allowDownload' = true`)
- Fotos devem ter `original_path` não nulo
- URLs expiram em 1 hora
- Máximo 500 arquivos por requisição
