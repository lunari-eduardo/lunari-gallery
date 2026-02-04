# Plano: Migração de Cloudinary para Cloudflare R2

## Status: ✅ IMPLEMENTADO

## Arquitetura Final

```text
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                        ARQUITETURA DE IMAGENS                                       │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│   ┌─────────────┐    ┌──────────────────┐    ┌─────────────────────┐               │
│   │   Frontend  │───>│  b2-upload       │───>│  Backblaze B2       │               │
│   │   (Upload)  │    │  (Edge Function) │    │  (Originais)        │               │
│   └─────────────┘    └──────────────────┘    └─────────────────────┘               │
│         │                     │                                                     │
│         │                     │ processing_status='uploaded'                        │
│         │                     ▼                                                     │
│         │            ┌──────────────────┐                                          │
│         │            │   galeria_fotos  │                                          │
│         │            │   (Supabase)     │                                          │
│         │            └──────────────────┘                                          │
│         │                     │                                                     │
│         │                     │ pg_cron (cada 1 min)                               │
│         │                     ▼                                                     │
│         │            ┌──────────────────┐    ┌─────────────────────┐               │
│         │            │  process-photos  │───>│  Cloudflare R2      │               │
│         │            │  (Edge Function) │    │  cdn.lunarihub.com  │               │
│         │            └──────────────────┘    └─────────────────────┘               │
│         │                     │                                                     │
│         │                     │ processing_status='ready'                           │
│         │                     │ thumb_path, preview_path, preview_wm_path          │
│         │                     ▼                                                     │
│   ┌─────────────┐    ┌──────────────────┐                                          │
│   │   Frontend  │<───│  R2 Public URLs  │                                          │
│   │(Visualizar) │    │  (CDN Global)    │                                          │
│   └─────────────┘    └──────────────────┘                                          │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Componentes Implementados

### 1. Database
- ✅ Coluna `processing_status` adicionada à `galeria_fotos`
- ✅ Índice otimizado para busca de fotos pendentes

### 2. Edge Functions
- ✅ `b2-upload`: Atualizado para definir `processing_status = 'uploaded'`
- ✅ `process-photos`: Nova função para processamento assíncrono (MVP - passa imagem sem transformações)

### 3. Frontend
- ✅ `src/lib/photoUrl.ts`: Novo módulo de URLs (substitui cloudinaryUrl.ts)
- ✅ `public/placeholder-processing.svg`: Placeholder animado para fotos em processamento
- ✅ Componentes atualizados para usar `getPhotoUrlWithFallback`

### 4. Secrets Configurados
- ✅ R2_ACCESS_KEY_ID
- ✅ R2_SECRET_ACCESS_KEY  
- ✅ R2_ACCOUNT_ID
- ✅ R2_BUCKET_NAME
- ✅ R2_PUBLIC_URL

### 5. Variáveis de Ambiente
- ✅ `VITE_R2_PUBLIC_URL`: https://cdn.lunarihub.com
- ❌ `VITE_CLOUDINARY_CLOUD_NAME`: Removido

---

## Próximos Passos (Fase 2 - Opcional)

### Configurar pg_cron para execução automática

1. **Habilitar extensões no Supabase Dashboard:**
   - Database > Extensions > Habilitar `pg_cron` e `pg_net`

2. **Executar SQL para criar o job:**
```sql
SELECT cron.schedule(
  'process-photos-job',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://tlnjspsywycbudhewsfv.supabase.co/functions/v1/process-photos',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
    body := '{"batchSize": 10}'::jsonb
  ) AS request_id;
  $$
);
```

### Implementar processamento real de imagens

A Edge Function `process-photos` atualmente:
- ✅ Busca fotos pendentes
- ✅ Baixa do B2
- ✅ Faz upload para R2
- ⏳ **Placeholder**: Resize/watermark retornam imagem original

Para processamento real, considerar:
- Cloudflare Image Resizing (via URL transforms)
- Worker dedicado com Sharp/Canvas
- Serviço externo de processamento

---

## Fallback para Fotos Legadas

O sistema usa `getPhotoUrlWithFallback` que:
1. Se `processing_status === 'ready'` → Usa URLs do R2
2. Caso contrário → Usa URL direta do B2 (sem transformações)

Isso garante que fotos existentes continuem funcionando durante a transição.
