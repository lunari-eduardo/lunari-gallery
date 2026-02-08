

# Plano: Arquitetura Simplificada "Watermark no Frontend"

## Concordo Completamente

A sua proposta e a abordagem correta para este produto:

1. **Elimina complexidade de backend** - Nenhum processamento de imagem
2. **Custo previsivel** - Apenas CDN estatica (R2) + storage frio (B2)
3. **Menos pontos de falha** - Sem Workers, pipelines ou servicos externos
4. **Performance maxima** - Arquivos estaticos servidos diretamente

---

## Nova Arquitetura

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                    FLUXO SIMPLIFICADO                                   │
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
  │  Watermark aplicada via CSS (overlay visual)                        │
  │  - <img> + <div> com background-image do pattern                    │
  │  - Protecao: pointer-events:none, user-select:none                  │
  │  - Opcional: context menu bloqueado                                 │
  └─────────────────────────────────────────────────────────────────────┘

  FASE 3: ENTREGA FINAL (APOS CONFIRMACAO)
  ┌─────────────────────────────────────────────────────────────────────┐
  │  Galeria confirmada + allowDownload = true                          │
  │         │                                                           │
  │         ▼                                                           │
  │  Opcao A: Mesmo arquivo do R2 (1920px web)                         │
  │  https://media.lunarihub.com/galleries/{id}/foto.jpg               │
  │         │                                                           │
  │         ▼                                                           │
  │  Opcao B: Original do B2 (se fotografo subiu)                      │
  │  https://b2.lunarihub.com/originals/galleries/{id}/original.jpg    │
  │  (URL temporaria com signed URL)                                    │
  └─────────────────────────────────────────────────────────────────────┘
```

---

## O Que Muda no Codigo

### 1. Simplificar photoUrl.ts

Remover toda logica de Cloudflare Image Resizing e watermark dinamico:

```typescript
// ANTES: 150+ linhas com /cdn-cgi/image/draw=...
// DEPOIS: ~30 linhas

const R2_PUBLIC_URL = 'https://media.lunarihub.com';

export function getPhotoUrl(
  photo: { storageKey: string; thumbPath?: string; previewPath?: string },
  size: 'thumbnail' | 'preview' | 'original'
): string {
  if (size === 'original') {
    return getOriginalPhotoUrl(photo.storageKey);
  }
  
  const path = size === 'thumbnail' 
    ? (photo.thumbPath || photo.previewPath || photo.storageKey)
    : (photo.previewPath || photo.storageKey);
    
  if (!path) return '/placeholder.svg';
  
  return `${R2_PUBLIC_URL}/${path}`;
}
```

### 2. Criar Componente WatermarkOverlay

Componente CSS puro para overlay visual:

```typescript
// src/components/WatermarkOverlay.tsx

interface WatermarkOverlayProps {
  opacity?: number;
  pattern?: 'diagonal' | 'grid' | 'custom';
  customUrl?: string;
}

export function WatermarkOverlay({ opacity = 40, pattern = 'diagonal' }: WatermarkOverlayProps) {
  // Pattern SVG inline ou PNG do sistema
  // Aplicado via CSS absoluto sobre a imagem
  // pointer-events: none para nao interferir com cliques
}
```

### 3. Atualizar PhotoCard.tsx

Adicionar overlay de watermark:

```typescript
<div className="relative">
  <img src={photo.previewUrl} ... />
  {showWatermark && <WatermarkOverlay opacity={40} />}
</div>
```

### 4. Atualizar Lightbox.tsx

Mesmo padrao - overlay CSS no fullscreen:

```typescript
<div className="relative">
  <img src={displayUrl} ... />
  {showWatermark && !isConfirmedMode && <WatermarkOverlay opacity={40} />}
</div>
```

### 5. Atualizar ClientGallery.tsx

Remover:
- Query de photographerWatermark (nao necessario)
- Logica de WatermarkConfig
- Passagem de watermarkConfig para getPhotoUrl

Adicionar:
- Flag simples showWatermark baseada em configuracao da galeria

---

## Seguranca da Watermark Visual

Protecoes CSS (nivel adequado para selecao de fotos):

| Protecao | Como |
|----------|------|
| Bloqueio de arraste | `draggable="false"` |
| Bloqueio de selecao | `user-select: none` |
| Click-through | `pointer-events: none` no overlay |
| Context menu | `onContextMenu={e => e.preventDefault()}` |
| Print media | `@media print { .watermark { opacity: 1 } }` |

Nota: Nenhuma watermark frontend e "inquebravel", mas para o fluxo de selecao e suficiente. O cliente ja pagou pelo servico - o objetivo e apenas evitar uso indevido casual.

---

## Configuracao Necessaria (Voce)

### Cloudflare Dashboard

1. **R2 > lunari-previews > Settings > Enable Public Access**
2. **R2 > lunari-previews > Settings > Add Custom Domain: media.lunarihub.com**
3. **Verificar DNS**: media.lunarihub.com apontando para R2

### Environment Variables

Confirmar que existe:
- `VITE_R2_PUBLIC_URL=https://media.lunarihub.com`

---

## Implementacao

### Arquivos a Modificar

| Arquivo | Acao |
|---------|------|
| src/lib/photoUrl.ts | Simplificar (remover /cdn-cgi/image/) |
| src/components/WatermarkOverlay.tsx | Criar novo |
| src/components/PhotoCard.tsx | Adicionar overlay |
| src/components/Lightbox.tsx | Adicionar overlay |
| src/pages/ClientGallery.tsx | Remover logica de watermark backend |

### Arquivos a Remover

| Arquivo | Motivo |
|---------|--------|
| public/watermarks/* | Nao mais necessario (pattern inline SVG) |
| Configuracoes de watermark_mode | Simplificar para on/off |

---

## Resultado Final

| Antes | Depois |
|-------|--------|
| Cloudflare Image Resizing | Nenhum |
| Worker de processamento | Nenhum |
| Servico externo (Cloudinary) | Nenhum |
| URLs de 300+ caracteres | URL direta simples |
| Watermark queimada no pixel | Overlay CSS visual |
| Depende de CF Pro | Apenas R2 publico |

### Custos Estimados

| Servico | Custo |
|---------|-------|
| R2 Storage | $0.015/GB/mes |
| R2 Egress | Gratis (via custom domain) |
| B2 Cold Storage | $0.006/GB/mes |
| Processamento | $0 (nao existe) |

### Performance

| Metrica | Valor |
|---------|-------|
| Latencia | <50ms (CDN edge) |
| Cache | Infinito (arquivo estatico) |
| Transformacao | 0ms (nao existe) |

---

## Proximos Passos

1. Voce configura R2 publico + custom domain
2. Eu implemento as mudancas no codigo
3. Testamos upload e visualizacao
4. Sistema funciona de forma estavel

