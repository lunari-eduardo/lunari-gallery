/**
 * Photo URL utilities for R2-based image serving
 * 
 * - Thumbnails, previews, and watermarked previews are served from Cloudflare R2 (public)
 * - Original images are served from Backblaze B2 (for downloads after confirmation)
 */

const R2_PUBLIC_URL = import.meta.env.VITE_R2_PUBLIC_URL || '';
const B2_BUCKET_URL = import.meta.env.VITE_B2_BUCKET_URL || '';

export type PhotoSize = 'thumbnail' | 'preview' | 'original';
export type ProcessingStatus = 'uploaded' | 'processing' | 'ready' | 'error';

export interface PhotoPaths {
  storageKey: string;
  thumbPath?: string | null;
  previewPath?: string | null;
  previewWmPath?: string | null;
  processingStatus?: ProcessingStatus | string;
  width?: number;
  height?: number;
}

/**
 * Get photo URL based on size, watermark preference, and processing status
 * 
 * @param photo - Photo with path information
 * @param size - Desired image size
 * @param withWatermark - Whether to use watermarked version (for preview only)
 * @returns URL string or placeholder if not ready
 */
export function getPhotoUrl(
  photo: PhotoPaths,
  size: PhotoSize,
  withWatermark: boolean = false
): string {
  // If photo is still processing, return placeholder
  if (!photo.processingStatus || photo.processingStatus !== 'ready') {
    return '/placeholder-processing.svg';
  }

  // Original - always from B2 (for downloads)
  if (size === 'original') {
    return getOriginalPhotoUrl(photo.storageKey);
  }

  // Thumbnail - from R2
  if (size === 'thumbnail' && photo.thumbPath) {
    return `${R2_PUBLIC_URL}/${photo.thumbPath}`;
  }

  // Preview with watermark
  if (size === 'preview' && withWatermark && photo.previewWmPath) {
    return `${R2_PUBLIC_URL}/${photo.previewWmPath}`;
  }

  // Preview without watermark
  if (size === 'preview' && photo.previewPath) {
    return `${R2_PUBLIC_URL}/${photo.previewPath}`;
  }

  // Fallback to placeholder
  return '/placeholder.svg';
}

/**
 * Check if photo is ready for display
 */
export function isPhotoReady(photo: PhotoPaths): boolean {
  return photo.processingStatus === 'ready';
}

/**
 * Check if photo is still processing
 */
export function isPhotoProcessing(photo: PhotoPaths): boolean {
  return photo.processingStatus === 'uploaded' || photo.processingStatus === 'processing';
}

/**
 * Get the original photo URL directly from B2 (NO watermark, NO transformations)
 * Use this for downloads after payment/confirmation
 * 
 * @param storageKey - Path to image in B2
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
 * TEMPORARY: Get photo URL using direct B2 URL
 * This is used during the transition period while R2 processing is being set up
 * Once all photos are processed to R2, this can be removed
 */
export function getPhotoUrlWithFallback(
  photo: PhotoPaths,
  size: PhotoSize,
  withWatermark: boolean = false
): string {
  // If R2 paths are available and photo is ready, use R2
  if (photo.processingStatus === 'ready') {
    if (size === 'thumbnail' && photo.thumbPath) {
      return `${R2_PUBLIC_URL}/${photo.thumbPath}`;
    }
    if (size === 'preview' && withWatermark && photo.previewWmPath) {
      return `${R2_PUBLIC_URL}/${photo.previewWmPath}`;
    }
    if (size === 'preview' && photo.previewPath) {
      return `${R2_PUBLIC_URL}/${photo.previewPath}`;
    }
  }
  
  // Fallback: use B2 directly (no transformations, no watermark)
  // This works for photos uploaded before R2 processing was enabled
  if (photo.storageKey) {
    return getOriginalPhotoUrl(photo.storageKey);
  }
  
  return '/placeholder.svg';
}
