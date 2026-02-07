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
  opacity?: number;  // Not used in V1 - embedded in PNG
  scale?: number;    // Not used in V1 - embedded in PNG
}

// Size configurations
const SIZE_CONFIG: Record<PhotoSize, number | null> = {
  thumbnail: 400,
  preview: 1920,  // Default, can be overridden
  original: null, // No resizing
};

/**
 * Get photo URL with optional resizing and watermark
 * 
 * @param photo - Photo paths object
 * @param size - Target size (thumbnail, preview, original)
 * @param watermarkConfig - Optional watermark configuration
 * @param targetWidth - Optional custom width (overrides SIZE_CONFIG)
 */
export function getPhotoUrl(
  photo: PhotoPaths,
  size: PhotoSize,
  watermarkConfig?: WatermarkConfig,
  targetWidth?: number
): string {
  // Original - direct from B2 (for downloads)
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

  // Add watermark if configured (only for preview, never for thumbnails)
  if (size === 'preview' && watermarkConfig && watermarkConfig.mode !== 'none') {
    const overlayUrl = getWatermarkOverlayUrl(watermarkConfig);
    if (overlayUrl) {
      const drawConfig = [{
        url: overlayUrl,
        repeat: true,
        opacity: 1, // PNG transparency handles this
      }];
      options.push(`draw=${encodeURIComponent(JSON.stringify(drawConfig))}`);
    }
  }

  // Build final URL with Cloudflare Image Resizing
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
 * Converts boolean watermark flag to WatermarkConfig
 * 
 * @deprecated Use getPhotoUrl with proper WatermarkConfig instead
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
 * With new architecture, photos are ready immediately after upload
 */
export function isPhotoReady(photo: { processingStatus?: string }): boolean {
  return photo.processingStatus !== 'error';
}

/**
 * Check if photo is still processing
 * @deprecated Processing is no longer async - always returns false
 */
export function isPhotoProcessing(): boolean {
  return false;
}

/**
 * Get R2 public URL (for external use)
 */
export function getR2PublicUrl(): string {
  return R2_PUBLIC_URL;
}
