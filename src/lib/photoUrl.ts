/**
 * Photo URL utilities with Cloudflare Image Resizing for watermark on-the-fly
 * 
 * Architecture:
 * - Previews (clean, no watermark) are stored in R2
 * - Watermarks are applied via Cloudflare Image Resizing URL params
 * - Original images in B2 (for downloads after confirmation)
 * 
 * Cloudflare Image Resizing applies watermark via /cdn-cgi/image/ endpoint
 * using the `draw` parameter with `repeat: true` for tiling effect.
 */

const R2_PUBLIC_URL = import.meta.env.VITE_R2_PUBLIC_URL || 'https://cdn.lunarihub.com';
const B2_BUCKET_URL = import.meta.env.VITE_B2_BUCKET_URL || '';

// Cloudflare Image Resizing base (must be the same domain as R2 CDN)
const CF_IMAGE_RESIZING_DOMAIN = 'https://lunarihub.com';

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
  path?: string | null;  // Path to custom watermark in R2 (user-assets/{userId}/watermark.png)
  opacity?: number;      // 10-100 (not used in V1 - embedded in PNG)
  scale?: number;        // 10-50 (not used in V1 - embedded in PNG)
}

/**
 * Get photo URL based on size and watermark configuration
 * 
 * For thumbnails: Always served clean from R2
 * For previews: 
 *   - If watermark mode is 'none': Clean URL from R2
 *   - If watermark mode is 'system' or 'custom': Cloudflare Image Resizing URL
 * For originals: Direct B2 URL (for downloads)
 */
export function getPhotoUrl(
  photo: PhotoPaths,
  size: PhotoSize,
  watermarkConfig?: WatermarkConfig
): string {
  // Original - always from B2 (for downloads)
  if (size === 'original') {
    return getOriginalPhotoUrl(photo.storageKey);
  }

  // Thumbnail - always clean from R2 (no watermark)
  if (size === 'thumbnail') {
    if (photo.thumbPath) {
      return `${R2_PUBLIC_URL}/${photo.thumbPath}`;
    }
    // Fallback to preview or storage key
    if (photo.previewPath) {
      return `${R2_PUBLIC_URL}/${photo.previewPath}`;
    }
    if (photo.storageKey) {
      return `${R2_PUBLIC_URL}/${photo.storageKey}`;
    }
    return '/placeholder.svg';
  }

  // Preview - apply watermark if configured
  if (size === 'preview') {
    const baseUrl = photo.previewPath 
      ? `${R2_PUBLIC_URL}/${photo.previewPath}`
      : photo.storageKey 
        ? `${R2_PUBLIC_URL}/${photo.storageKey}`
        : null;

    if (!baseUrl) {
      return '/placeholder.svg';
    }

    // No watermark - return clean URL
    if (!watermarkConfig || watermarkConfig.mode === 'none') {
      return baseUrl;
    }

    // Apply watermark via Cloudflare Image Resizing
    return buildWatermarkedUrl(baseUrl, watermarkConfig);
  }

  return '/placeholder.svg';
}

/**
 * Build a Cloudflare Image Resizing URL with watermark overlay
 * 
 * Uses the `/cdn-cgi/image/` endpoint with `draw` parameter.
 * The watermark PNG should have transparency and appropriate sizing/padding built-in.
 */
function buildWatermarkedUrl(baseImageUrl: string, config: WatermarkConfig): string {
  // Determine overlay URL based on mode
  let overlayUrl: string;
  
  if (config.mode === 'custom' && config.path) {
    // Custom watermark from user's upload
    overlayUrl = `${R2_PUBLIC_URL}/${config.path}`;
  } else {
    // System default pattern
    overlayUrl = `${R2_PUBLIC_URL}/system-assets/default-pattern.png`;
  }

  // Build the draw parameter for Cloudflare Image Resizing
  // repeat: true creates a tiling/mosaic effect
  // opacity is applied from the PNG itself (V1 simplification)
  const drawConfig = [{
    url: overlayUrl,
    repeat: true,
    fit: 'contain',
    opacity: 1, // PNG transparency handles this
  }];

  // Cloudflare Image Resizing URL format:
  // https://domain.com/cdn-cgi/image/draw=[config]/original-image-url
  const params = new URLSearchParams();
  params.set('draw', JSON.stringify(drawConfig));
  
  // Build final URL
  // Format: /cdn-cgi/image/{options}/{source-image}
  // The source image must be a full URL or path on the same domain
  
  // Since our images are on cdn.lunarihub.com (R2), we need to reference them
  // from the main domain that has Image Resizing enabled
  const imagePathFromR2 = baseImageUrl.replace(R2_PUBLIC_URL, '');
  
  return `${CF_IMAGE_RESIZING_DOMAIN}/cdn-cgi/image/draw=${encodeURIComponent(JSON.stringify(drawConfig))}/${baseImageUrl}`;
}

/**
 * Get photo URL with fallback for legacy photos
 * 
 * This function handles the transition period where some photos may not have
 * R2 paths yet. For legacy photos, it falls back to B2 directly.
 * 
 * @deprecated Use getPhotoUrl with proper watermarkConfig instead
 */
export function getPhotoUrlWithFallback(
  photo: PhotoPaths & { processingStatus?: string },
  size: PhotoSize,
  withWatermark: boolean = false
): string {
  // For backward compatibility, convert boolean to config
  const watermarkConfig: WatermarkConfig | undefined = withWatermark 
    ? { mode: 'system' } 
    : undefined;
  
  // Check if we have R2 paths
  const hasR2Paths = photo.thumbPath || photo.previewPath;
  
  if (hasR2Paths) {
    return getPhotoUrl(photo, size, watermarkConfig);
  }
  
  // Fallback to B2 directly (legacy photos without R2 processing)
  if (photo.storageKey) {
    return getOriginalPhotoUrl(photo.storageKey);
  }
  
  return '/placeholder.svg';
}

/**
 * Get the original photo URL directly from B2
 * Use this for downloads after payment/confirmation
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
 * With the new architecture, photos are ready immediately after upload
 */
export function isPhotoReady(photo: { processingStatus?: string }): boolean {
  // With new architecture, all photos are ready after upload
  // Keep for backward compatibility
  return photo.processingStatus !== 'error';
}

/**
 * Check if photo is still processing
 * @deprecated Processing is no longer async
 */
export function isPhotoProcessing(photo: { processingStatus?: string }): boolean {
  // With new architecture, there's no async processing
  return false;
}
