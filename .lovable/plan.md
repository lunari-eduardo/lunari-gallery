# Plano: Arquitetura Simplificada "Watermark no Frontend"

## ✅ Status: IMPLEMENTADO

### Resumo das Mudanças

A arquitetura foi simplificada para:
1. **Eliminar processamento de backend** - Nenhuma transformação dinâmica de imagem
2. **URLs estáticas diretas** - Fotos servidas diretamente do R2 CDN
3. **Watermark via CSS overlay** - Proteção visual aplicada no frontend

---

## Arquitetura Implementada

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                    FLUXO SIMPLIFICADO (ATIVO)                           │
└─────────────────────────────────────────────────────────────────────────┘

  FASE 1: UPLOAD
  ┌─────────────────────────────────────────────────────────────────────┐
  │  Frontend comprime para 1920px (imageCompression.ts)                │
  │         │                                                           │
  │         ▼                                                           │
  │  Edge Function: r2-upload                                           │
  │         │                                                           │
  │         ▼                                                           │
  │  R2 Bucket: lunari-previews (PUBLICO)                              │
  │  Path: galleries/{id}/foto.jpg                                      │
  │         │                                                           │
  │         ▼                                                           │
  │  DB: galeria_fotos.storage_key = path                              │
  │  Status: ready (imediato)                                           │
  └─────────────────────────────────────────────────────────────────────┘

  FASE 2: VISUALIZACAO (SELECAO)
  ┌─────────────────────────────────────────────────────────────────────┐
  │  Frontend busca fotos do banco                                      │
  │         │                                                           │
  │         ▼                                                           │
  │  URL direta: https://media.lunarihub.com/galleries/{id}/foto.jpg   │
  │         │                                                           │
  │         ▼                                                           │
  │  Watermark aplicada via CSS (WatermarkOverlay component)            │
  │  - SVG diagonal pattern com opacity 15%                             │
  │  - pointer-events:none, user-select:none                            │
  │  - Context menu bloqueado                                           │
  └─────────────────────────────────────────────────────────────────────┘

  FASE 3: ENTREGA FINAL (APOS CONFIRMACAO)
  ┌─────────────────────────────────────────────────────────────────────┐
  │  Galeria confirmada + isConfirmed = true                            │
  │         │                                                           │
  │         ▼                                                           │
  │  Watermark overlay é removido (showWatermark=false)                 │
  │  Imagem limpa exibida para download                                 │
  └─────────────────────────────────────────────────────────────────────┘
```

---

## Arquivos Modificados

| Arquivo | Mudança |
|---------|---------|
| `src/lib/photoUrl.ts` | Simplificado - remove Cloudflare Image Resizing, retorna URLs diretas |
| `src/components/WatermarkOverlay.tsx` | **NOVO** - Componente CSS overlay com SVG pattern |
| `src/components/PhotoCard.tsx` | Usa `showWatermark` prop + `WatermarkOverlay` |
| `src/components/Lightbox.tsx` | Usa `showWatermark` prop + `WatermarkOverlay` |
| `src/pages/ClientGallery.tsx` | Remove query de watermark, usa prop `showWatermark` |
| `src/pages/GalleryDetail.tsx` | Atualizado para nova API de PhotoCard/Lightbox |
| `src/pages/GalleryPreview.tsx` | Atualizado para nova API de PhotoCard |
| `src/hooks/useSupabaseGalleries.ts` | Remove `WatermarkConfig`, simplifica `getPhotoUrl` |

## Arquivos Removidos

| Arquivo | Motivo |
|---------|--------|
| `public/watermarks/*` | Não mais necessário (pattern inline SVG) |

---

## Proteções de Segurança (CSS)

| Proteção | Implementação |
|----------|---------------|
| Bloqueio de arraste | `draggable="false"` |
| Bloqueio de seleção | `user-select: none` |
| Click-through | `pointer-events: none` no overlay |
| Context menu | `onContextMenu={e => e.preventDefault()}` |

---

## Configuração Necessária (Cloudflare)

Para o sistema funcionar, você precisa:

1. **R2 > lunari-previews > Settings > Enable Public Access**
2. **R2 > lunari-previews > Settings > Add Custom Domain: media.lunarihub.com**
3. **DNS**: media.lunarihub.com apontando para R2

---

## Resultado

| Antes | Depois |
|-------|--------|
| Cloudflare Image Resizing | Nenhum |
| URL com `/cdn-cgi/image/draw=...` | URL direta estática |
| Query `photographer_accounts` para watermark | Não necessário |
| Dependência de CF Pro | Apenas R2 público |
| Watermark queimada no pixel | Overlay CSS visual |

### Performance

- **Latência**: <50ms (CDN edge)
- **Cache**: Infinito (arquivo estático)
- **Transformação**: 0ms (não existe)

### Custos

- **R2 Storage**: $0.015/GB/mês
- **R2 Egress**: Grátis (via custom domain)
- **Processamento**: $0 (não existe)
