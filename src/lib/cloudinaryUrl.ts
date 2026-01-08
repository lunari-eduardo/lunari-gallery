/**
 * Image URL generator for B2 storage
 * Since the B2 bucket is public, we can serve images directly without Cloudinary
 * This eliminates the Cloudinary "Allowed fetch domains" security restriction issue
 */

export interface WatermarkSettings {
  type: 'none' | 'text' | 'image';
  text?: string;
  logoUrl?: string;
  opacity: number; // 0-100
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center' | 'fill';
}

export interface ImageOptions {
  storageKey: string;
  width?: number;
  height?: number;
  watermark?: WatermarkSettings | null;
  quality?: 'auto' | number;
  format?: 'auto' | 'jpg' | 'png' | 'webp';
}

// B2 bucket URL - hardcoded for production (confirmed via diagnose-b2 edge function)
const B2_BUCKET_URL = 'https://f005.backblazeb2.com/file/lunari-gallery';

/**
 * Generate a direct B2 URL for an image
 * Since the bucket is public, images can be accessed directly
 */
export function getCloudinaryUrl(options: ImageOptions): string {
  const { storageKey } = options;

  // Validate storageKey
  if (!storageKey || typeof storageKey !== 'string' || storageKey.trim() === '') {
    console.error('Image URL: storageKey inválido:', storageKey);
    return '/placeholder.svg';
  }

  // Build direct B2 URL (bucket is public)
  const directUrl = `${B2_BUCKET_URL}/${storageKey}`;

  console.log('Image URL Build:', {
    bucketUrl: B2_BUCKET_URL,
    storageKey,
    directUrl,
  });

  return directUrl;
}

/**
 * Generate a thumbnail URL
 * For now, returns the same direct URL since we're not using Cloudinary transformations
 */
export function getThumbnailUrl(storageKey: string, size: number = 300): string {
  return getCloudinaryUrl({
    storageKey,
    width: size,
    quality: 'auto',
    format: 'auto',
    watermark: null,
  });
}

/**
 * Generate a preview URL
 */
export function getPreviewUrl(
  storageKey: string,
  watermark: WatermarkSettings | null,
  maxWidth: number = 1200
): string {
  return getCloudinaryUrl({
    storageKey,
    width: maxWidth,
    quality: 'auto',
    format: 'auto',
    watermark,
  });
}

/**
 * Generate a fullscreen URL
 */
export function getFullscreenUrl(
  storageKey: string,
  watermark: WatermarkSettings | null
): string {
  return getCloudinaryUrl({
    storageKey,
    width: 1920,
    quality: 'auto',
    format: 'auto',
    watermark,
  });
}

/**
 * Check if image storage is properly configured
 */
export function isCloudinaryConfigured(): boolean {
  return Boolean(B2_BUCKET_URL);
}
