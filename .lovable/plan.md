
# Plano: Restaurar Pipeline de Upload para R2

## Problema Diagnosticado

O sistema atual faz upload **apenas para B2** (Backblaze), mas as URLs de visualização esperam encontrar os arquivos no **R2** (Cloudflare). Como resultado, todas as imagens falham ao carregar.

### Fluxo Atual (Quebrado)

```text
Browser → Compress → b2-upload (Edge Function) → Backblaze B2
                                                     ↓
                                              storage_key = "galleries/{id}/foto.jpg"
                                                     ↓
                                              thumb_path = storage_key (mesmo path)
                                              preview_path = storage_key (mesmo path)
                                                     ↓
                                              URL gerada: media.lunarihub.com/{path}
                                                     ↓
                                              ❌ 404 - arquivo não existe no R2!
```

### O Arquivo Está em B2:
```
https://f005.backblazeb2.com/file/lunari-gallery/galleries/{id}/foto.jpg ✓
```

### Mas a URL Aponta para R2:
```
https://media.lunarihub.com/galleries/{id}/foto.jpg ❌ (não existe)
```

---

## Solução: Enviar para R2 (Não B2) Durante Upload

A solução mais direta é mudar o destino do upload: **enviar direto para R2** em vez de B2.

### Opção Escolhida: Upload via Worker R2

O Worker `gallery-upload` já tem binding para R2 (`GALLERY_BUCKET`) e já sabe fazer `R2.put()`. Ele foi originalmente criado para isso, mas **nunca foi usado** no fluxo principal.

### Mudanças Necessárias

**1. Redirecionar upload para o Worker R2 (`gallery-upload`)**

Atualizar `PhotoUploader.tsx` para enviar para o Worker Cloudflare em vez da Edge Function `b2-upload`.

**2. Atualizar Worker `gallery-upload`**

O Worker já existe em `cloudflare/workers/gallery-upload/index.ts` e já tem:
- Endpoint `/upload` funcional
- Auth via JWKS
- `R2.put()` implementado

Precisamos ajustar:
- Path de storage: usar `galleries/{galleryId}/{filename}` (consistente)
- Retornar os paths corretos

**3. Ajustar `photoUrl.ts` para consistência**

Garantir que `preview_path` e `thumb_path` apontem para caminhos no R2.

---

## Arquitetura Final

```text
┌────────────────────────────────────────────────────────────────┐
│                    NOVO FLUXO DE UPLOAD                        │
└────────────────────────────────────────────────────────────────┘

  Browser                     Cloudflare Worker              R2 Bucket
┌─────────┐                   ┌──────────────┐            ┌───────────────┐
│ Client  │──POST /upload───▶ │gallery-upload│──R2.put()─▶│lunari-previews│
│         │  (FormData)       │ cdn.lunarihub│            │               │
└─────────┘                   └──────────────┘            └───────────────┘
                                     │
                                     ▼
                              ┌──────────────┐
                              │  Supabase    │
                              │ galeria_fotos│
                              │  (metadata)  │
                              └──────────────┘

URLs servidas:
- Thumbnail: https://lunarihub.com/cdn-cgi/image/width=400/https://media.lunarihub.com/galleries/{id}/foto.jpg
- Preview:   https://lunarihub.com/cdn-cgi/image/width=1920/https://media.lunarihub.com/galleries/{id}/foto.jpg
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/PhotoUploader.tsx` | Chamar Worker R2 em vez de Edge Function B2 |
| `cloudflare/workers/gallery-upload/index.ts` | Ajustar paths e integrar com Supabase |
| `.env` | Adicionar `VITE_R2_UPLOAD_URL` se necessário |
| `supabase/functions/b2-upload/index.ts` | Manter para downloads originais (opcional) |

---

## Detalhes Técnicos

### 1. PhotoUploader.tsx - Novo Upload

```typescript
// ANTES: chamava b2-upload
const { data, error } = await supabase.functions.invoke('b2-upload', {
  body: formData,
});

// DEPOIS: chama Worker R2
const token = session.access_token;
const response = await fetch('https://cdn.lunarihub.com/upload', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
  },
  body: formData,
});
const data = await response.json();
```

### 2. Worker gallery-upload - Ajustes

```typescript
// Path no R2: galleries/{galleryId}/{filename}
const storagePath = `galleries/${galleryId}/${filename}`;

// Upload para R2
await env.GALLERY_BUCKET.put(storagePath, fileBuffer, {
  httpMetadata: { contentType: file.type },
});

// Salvar no Supabase com paths corretos
const photoRecord = {
  storage_key: storagePath,
  thumb_path: storagePath,    // Cloudflare Image Resizing aplica resize
  preview_path: storagePath,  // Cloudflare Image Resizing aplica resize
  processing_status: 'ready',
};
```

### 3. URLs Resultantes

Após o upload, as URLs serão:

**Thumbnail (400px):**
```
https://lunarihub.com/cdn-cgi/image/width=400,fit=scale-down,quality=85/https://media.lunarihub.com/galleries/{galleryId}/{filename}
```

**Preview com Watermark (1920px):**
```
https://lunarihub.com/cdn-cgi/image/width=1920,fit=scale-down,draw=[...]/https://media.lunarihub.com/galleries/{galleryId}/{filename}
```

---

## E os Arquivos Existentes no B2?

As fotos já enviadas estão no B2 e funcionam para **download** (original). Para visualização, você tem duas opções:

**Opção A: Migrar arquivos manualmente**
- Copiar de B2 para R2 usando rclone ou script

**Opção B: Corrigir URLs temporariamente**
- Alterar `photoUrl.ts` para usar B2 como fallback quando arquivo não encontrar

**Recomendação:** Fazer novas fotos irem para R2, e migrar as antigas gradualmente.

---

## Resumo

| Antes | Depois |
|-------|--------|
| Upload → B2 | Upload → R2 |
| preview_path aponta para B2 | preview_path aponta para R2 |
| Arquivo não acessível via R2 | Arquivo acessível via R2 |
| Cloudflare Image Resizing: 404 | Cloudflare Image Resizing: OK |

---

## Próximos Passos (Após Aprovação)

1. Atualizar `PhotoUploader.tsx` para usar Worker R2
2. Ajustar Worker `gallery-upload` para integrar com Supabase
3. (Opcional) Atualizar Worker local e fazer deploy via `wrangler deploy`
4. Testar upload de nova foto
5. Verificar se imagem aparece na galeria
