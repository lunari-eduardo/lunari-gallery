/**
 * Photo URL utilities - Simplified Architecture
 * 
 * Architecture:
 * - Previews stored directly in R2 (media.lunarihub.com)
 * - No dynamic transformations - static files served via CDN
 * - Watermark applied via CSS overlay in frontend (not burned in pixels)
 * - Originals in B2 (for downloads after confirmation)
 */

const R2_PUBLIC_URL = import.meta.env.VITE_R2_PUBLIC_URL || 'https://media.lunarihub.com';
const B2_BUCKET_URL = import.meta.env.VITE_B2_BUCKET_URL || '';

export type PhotoSize = 'thumbnail' | 'preview' | 'original';

export interface PhotoPaths {
  storageKey: string;
  thumbPath?: string | null;
  previewPath?: string | null;
  width?: number;
  height?: number;
}

/**
 * Get photo URL - direct static file from R2
 * 
 * @param photo - Photo paths object
 * @param size - Target size (thumbnail, preview, original)
 */
export function getPhotoUrl(
  photo: PhotoPaths,
  size: PhotoSize
): string {
  // Original - direct from B2 (for downloads)
  if (size === 'original') {
    return getOriginalPhotoUrl(photo.storageKey);
  }

  // Determine path based on size
  const path = size === 'thumbnail' 
    ? (photo.thumbPath || photo.previewPath || photo.storageKey)
    : (photo.previewPath || photo.storageKey);

  if (!path) return '/placeholder.svg';

  // Direct URL to R2 public bucket
  return `${R2_PUBLIC_URL}/${path}`;
}

/**
 * Get original photo URL from B2
 * Use this for downloads after payment/confirmation
 */
export function getOriginalPhotoUrl(storageKey: string | null | undefined): string {
  if (!storageKey) return '/placeholder.svg';
  
  // If B2 bucket is configured, use it for originals
  if (B2_BUCKET_URL) {
    return `${B2_BUCKET_URL}/${storageKey}`;
  }
  
  // Fallback to R2 (same file used as preview)
  return `${R2_PUBLIC_URL}/${storageKey}`;
}

/**
 * Check if photo is ready for display
 * With simplified architecture, photos are ready immediately after upload
 */
export function isPhotoReady(photo: { processingStatus?: string }): boolean {
  return photo.processingStatus !== 'error';
}

/**
 * Get R2 public URL (for external use)
 */
export function getR2PublicUrl(): string {
  return R2_PUBLIC_URL;
}
