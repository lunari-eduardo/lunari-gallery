
# Plano: Pipeline de Upload R2 - IMPLEMENTADO ✅

## Status: Concluído

O pipeline de upload foi redirecionado de B2 (Backblaze) para R2 (Cloudflare).

## Mudanças Realizadas

### 1. PhotoUploader.tsx
- Agora envia para `https://cdn.lunarihub.com/upload` (Worker R2)
- Usa `VITE_R2_UPLOAD_URL` para configuração

### 2. Worker gallery-upload
- Path simplificado: `galleries/{galleryId}/{filename}`
- Todos os paths (storage_key, preview_path, thumb_path) apontam para o mesmo arquivo
- `processing_status: 'ready'` definido na criação
- Cloudflare Image Resizing aplica resize dinamicamente via URL

### 3. Variáveis de Ambiente
- `VITE_R2_UPLOAD_URL="https://cdn.lunarihub.com"` - Worker de upload
- `VITE_R2_PUBLIC_URL="https://media.lunarihub.com"` - CDN de leitura

## Fluxo Final

```
Browser → Compress → Worker R2 (cdn.lunarihub.com/upload) → R2 Bucket → Supabase
                                                                ↓
                                                    storage_key = "galleries/{id}/foto.jpg"
                                                                ↓
                                                    URL: media.lunarihub.com/galleries/{id}/foto.jpg ✓
                                                                ↓
                                                    Image Resizing: lunarihub.com/cdn-cgi/image/width=X/... ✓
```

## URLs Geradas

**Thumbnail (400px):**
```
https://lunarihub.com/cdn-cgi/image/width=400,fit=scale-down,quality=85/https://media.lunarihub.com/galleries/{id}/foto.jpg
```

**Preview (1920px):**
```
https://lunarihub.com/cdn-cgi/image/width=1920,fit=scale-down,quality=85/https://media.lunarihub.com/galleries/{id}/foto.jpg
```

## Próximos Passos

1. **Deploy do Worker** - Execute `wrangler deploy` no diretório `cloudflare/workers/gallery-upload/`
2. **Testar upload** - Envie uma nova foto e verifique se aparece na galeria
3. **Migrar arquivos antigos** - Copiar de B2 para R2 usando rclone (opcional)
