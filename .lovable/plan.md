

# Plano: Migração Final para Cloudflare Image Resizing

## Status Atual

### O que já está funcionando
| Item | Status |
|------|--------|
| Domínio R2 (`media.lunarihub.com`) | Arquivos acessíveis |
| Pattern padrão (`system-assets/default-pattern.png`) | Presente no R2 |
| Cloudflare Image Resizing (`/cdn-cgi/image/`) | Funcionando |
| Worker `gallery-upload` | Auth JWKS OK, endpoint `/upload-watermark` funcional |
| Worker `image-processor` | Removido (não existe mais em `cloudflare/workers/`) |

### O que ainda falta corrigir

| # | Problema | Arquivo |
|---|----------|---------|
| 1 | URL base hardcoded como `cdn.lunarihub.com` em vez de `media.lunarihub.com` | `.env`, `src/lib/photoUrl.ts`, outros |
| 2 | `getPhotoUrl()` não aplica `width` dinâmico via Image Resizing | `src/lib/photoUrl.ts` |
| 3 | `getPhotoUrlWithFallback()` usa boolean para watermark (legado) | `src/lib/photoUrl.ts` |
| 4 | `useSupabaseGalleries.getPhotoUrl()` não passa config de watermark do fotógrafo | `src/hooks/useSupabaseGalleries.ts` |
| 5 | `ClientGallery.tsx` usa watermark da galeria, não do fotógrafo | `src/pages/ClientGallery.tsx` |
| 6 | `WatermarkUploader.tsx` usa URL incorreta para preview | `src/components/settings/WatermarkUploader.tsx` |

---

## Correções Necessárias

### 1. Atualizar URL Base do R2

**Arquivo:** `.env`

```env
# ANTES
VITE_R2_PUBLIC_URL="https://cdn.lunarihub.com"

# DEPOIS
VITE_R2_PUBLIC_URL="https://media.lunarihub.com"
```

### 2. Reescrever `photoUrl.ts` Completamente

**Arquivo:** `src/lib/photoUrl.ts`

A nova implementação deve:
- Usar `media.lunarihub.com` como URL base do R2
- Aplicar `width` dinâmico via `/cdn-cgi/image/width=X/`
- Aplicar watermark via `draw` quando ativo
- Suportar os três modos: `none`, `system`, `custom`

```typescript
/**
 * Photo URL utilities with Cloudflare Image Resizing
 * 
 * Architecture:
 * - Clean previews stored in R2 (media.lunarihub.com)
 * - Thumbnails/resizing via /cdn-cgi/image/width=X/
 * - Watermarks applied on-the-fly via draw parameter
 * - Originals in B2 (for downloads)
 */

const R2_PUBLIC_URL = import.meta.env.VITE_R2_PUBLIC_URL || 'https://media.lunarihub.com';
const B2_BUCKET_URL = import.meta.env.VITE_B2_BUCKET_URL || '';

// Cloudflare Image Resizing endpoint (on the domain with Pro plan)
const CF_RESIZING_DOMAIN = 'https://lunarihub.com';

export type PhotoSize = 'thumbnail' | 'preview' | 'original';

export interface PhotoPaths {
  storageKey: string;
  thumbPath?: string | null;
  previewPath?: string | null;
  width?: number;
  height?: number;
}

export interface WatermarkConfig {
  mode: 'system' | 'custom' | 'none';
  path?: string | null;
  opacity?: number;  // Not used in V1
  scale?: number;    // Not used in V1
}

// Size configurations
const SIZE_CONFIG = {
  thumbnail: 400,
  preview: 1920,  // Default, can be overridden
  original: null, // No resizing
};

/**
 * Get photo URL with optional resizing and watermark
 */
export function getPhotoUrl(
  photo: PhotoPaths,
  size: PhotoSize,
  watermarkConfig?: WatermarkConfig,
  targetWidth?: number
): string {
  // Original - direct from B2
  if (size === 'original') {
    return getOriginalPhotoUrl(photo.storageKey);
  }

  // Determine base path in R2
  const basePath = size === 'thumbnail' 
    ? (photo.thumbPath || photo.previewPath || photo.storageKey)
    : (photo.previewPath || photo.storageKey);

  if (!basePath) return '/placeholder.svg';

  // Full R2 URL
  const baseUrl = `${R2_PUBLIC_URL}/${basePath}`;

  // Determine target width
  const width = targetWidth || SIZE_CONFIG[size] || 1920;

  // Build transformation options
  const options: string[] = [];
  options.push(`width=${width}`);
  options.push('fit=scale-down');
  options.push('quality=85');

  // Add watermark if configured
  if (size === 'preview' && watermarkConfig && watermarkConfig.mode !== 'none') {
    const overlayUrl = getWatermarkOverlayUrl(watermarkConfig);
    if (overlayUrl) {
      const drawConfig = [{
        url: overlayUrl,
        repeat: true,
        opacity: 1, // PNG handles transparency
      }];
      options.push(`draw=${encodeURIComponent(JSON.stringify(drawConfig))}`);
    }
  }

  // Build final URL with transformations
  return `${CF_RESIZING_DOMAIN}/cdn-cgi/image/${options.join(',')}/${baseUrl}`;
}

/**
 * Get watermark overlay URL based on mode
 */
function getWatermarkOverlayUrl(config: WatermarkConfig): string | null {
  if (config.mode === 'none') return null;
  
  if (config.mode === 'custom' && config.path) {
    return `${R2_PUBLIC_URL}/${config.path}`;
  }
  
  // System default pattern
  return `${R2_PUBLIC_URL}/system-assets/default-pattern.png`;
}

/**
 * Get photo URL with fallback for legacy compatibility
 * @deprecated Use getPhotoUrl with proper WatermarkConfig
 */
export function getPhotoUrlWithFallback(
  photo: PhotoPaths & { processingStatus?: string },
  size: PhotoSize,
  withWatermark: boolean = false
): string {
  const watermarkConfig: WatermarkConfig | undefined = withWatermark 
    ? { mode: 'system' } 
    : undefined;
  
  return getPhotoUrl(photo, size, watermarkConfig);
}

/**
 * Get original photo URL from B2
 */
export function getOriginalPhotoUrl(storageKey: string | null | undefined): string {
  if (!storageKey) return '/placeholder.svg';
  if (!B2_BUCKET_URL) {
    console.warn('B2 bucket URL not configured');
    return '/placeholder.svg';
  }
  return `${B2_BUCKET_URL}/${storageKey}`;
}

/**
 * Check if photo is ready for display
 */
export function isPhotoReady(photo: { processingStatus?: string }): boolean {
  return photo.processingStatus !== 'error';
}

/**
 * @deprecated Processing is no longer async
 */
export function isPhotoProcessing(): boolean {
  return false;
}
```

### 3. Atualizar `useSupabaseGalleries.ts`

**Arquivo:** `src/hooks/useSupabaseGalleries.ts`

Modificar a função `getPhotoUrl` para receber e passar `WatermarkConfig`:

```typescript
// Get photo URL helper - uses Cloudflare Image Resizing
const getPhotoUrl = useCallback(
  (
    photo: GaleriaPhoto & { processingStatus?: string; thumbPath?: string; previewPath?: string },
    gallery: Galeria | undefined,
    size: 'thumbnail' | 'preview' | 'full',
    watermarkConfig?: WatermarkConfig
  ): string => {
    const photoPath = photo.storageKey;
    if (!photoPath) return '/placeholder.svg';

    // Import from photoUrl.ts
    return getPhotoUrlFromLib(
      {
        storageKey: photoPath,
        thumbPath: photo.thumbPath,
        previewPath: photo.previewPath,
        width: photo.width,
        height: photo.height,
      },
      size === 'full' ? 'original' : size,
      watermarkConfig
    );
  },
  []
);
```

### 4. Atualizar `ClientGallery.tsx`

**Arquivo:** `src/pages/ClientGallery.tsx`

Buscar configuração de watermark do **fotógrafo** (não da galeria) e passar para URL:

```typescript
// Fetch photographer's watermark settings
const { data: photographerWatermark } = useQuery({
  queryKey: ['photographer-watermark', supabaseGallery?.userId],
  queryFn: async () => {
    if (!supabaseGallery?.userId) return null;
    
    const { data } = await supabase
      .from('photographer_accounts')
      .select('watermark_mode, watermark_path, watermark_opacity, watermark_scale')
      .eq('user_id', supabaseGallery.userId)
      .single();
    
    return data;
  },
  enabled: !!supabaseGallery?.userId,
});

// In photos memo:
const watermarkConfig: WatermarkConfig = {
  mode: photographerWatermark?.watermark_mode || 'system',
  path: photographerWatermark?.watermark_path || null,
  opacity: photographerWatermark?.watermark_opacity || 40,
  scale: photographerWatermark?.watermark_scale || 30,
};

// Use in photo URL generation
previewUrl: getPhotoUrl(photoPaths, 'preview', watermarkConfig),
```

### 5. Atualizar `WatermarkUploader.tsx`

**Arquivo:** `src/components/settings/WatermarkUploader.tsx`

Corrigir URL de preview para usar Image Resizing:

```typescript
const getPreviewUrl = useCallback((path: string | null) => {
  if (!path) return null;
  // Use Image Resizing para preview
  return `https://lunarihub.com/cdn-cgi/image/width=200/${R2_PUBLIC_URL}/${path}`;
}, []);
```

### 6. Atualizar `useWatermarkSettings.ts`

**Arquivo:** `src/hooks/useWatermarkSettings.ts`

Atualizar URL do Worker:

```typescript
// ANTES
const workerUrl = 'https://cdn.lunarihub.com';

// DEPOIS  
const workerUrl = 'https://media.lunarihub.com';
```

---

## Fluxo Final de URLs

### Thumbnail (400px, sem watermark)
```
https://lunarihub.com/cdn-cgi/image/width=400,fit=scale-down,quality=85/https://media.lunarihub.com/{path}
```

### Preview (1920px, com watermark system)
```
https://lunarihub.com/cdn-cgi/image/width=1920,fit=scale-down,quality=85,draw=[{"url":"https://media.lunarihub.com/system-assets/default-pattern.png","repeat":true,"opacity":1}]/https://media.lunarihub.com/{path}
```

### Preview (1920px, com watermark custom)
```
https://lunarihub.com/cdn-cgi/image/width=1920,fit=scale-down,quality=85,draw=[{"url":"https://media.lunarihub.com/user-assets/{userId}/watermark.png","repeat":true,"opacity":1}]/https://media.lunarihub.com/{path}
```

### Preview (1920px, sem watermark)
```
https://lunarihub.com/cdn-cgi/image/width=1920,fit=scale-down,quality=85/https://media.lunarihub.com/{path}
```

### Original (download)
```
https://f005.backblazeb2.com/file/lunari-gallery/{path}
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `.env` | `VITE_R2_PUBLIC_URL` → `media.lunarihub.com` |
| `src/lib/photoUrl.ts` | Reescrever com Image Resizing + draw |
| `src/hooks/useSupabaseGalleries.ts` | Atualizar `getPhotoUrl` para WatermarkConfig |
| `src/pages/ClientGallery.tsx` | Buscar watermark do fotógrafo |
| `src/hooks/useWatermarkSettings.ts` | Atualizar URL do Worker |
| `src/components/settings/WatermarkUploader.tsx` | Corrigir preview URL |

---

## Validação Pós-Implementação

### Cenário 1: `watermark_mode = 'none'`
- Thumbnail: Mostra preview reduzido sem overlay
- Preview: Mostra imagem limpa redimensionada

### Cenário 2: `watermark_mode = 'system'`
- Thumbnail: Mostra preview reduzido sem overlay
- Preview: Mostra imagem com pattern de linhas diagonais em mosaico

### Cenário 3: `watermark_mode = 'custom'`
- Upload: Salva PNG em `user-assets/{userId}/watermark.png`
- Thumbnail: Mostra preview reduzido sem overlay
- Preview: Mostra imagem com logo do usuário em mosaico

---

## Notas Técnicas

### Por que `media.lunarihub.com` em vez de `cdn.lunarihub.com`?
O domínio `media.lunarihub.com` foi o que você confirmou estar funcionando para servir arquivos do R2.

### Parâmetros do Image Resizing
- `width=X` - Largura alvo
- `fit=scale-down` - Só reduz, nunca aumenta
- `quality=85` - Qualidade JPEG
- `draw=[...]` - Overlay em mosaico

### Limitações V1
- Tamanho do tile vem do PNG (não dinâmico)
- Opacidade vem do PNG (não dinâmico)
- Scale não é aplicado (V2)

