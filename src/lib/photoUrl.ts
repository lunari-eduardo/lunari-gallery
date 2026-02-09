/**
 * Photo URL utilities - Dual Storage Architecture
 * 
 * ARCHITECTURE:
 * 
 * R2 (Cloudflare) - https://media.lunarihub.com
 *   - Previews with watermark burned-in during upload
 *   - Used for ALL display (thumbnails, lightbox, fullscreen)
 *   - Referenced by: storage_key, thumb_path, preview_path
 *   - Public CDN access
 * 
 * B2 (Backblaze) - Private, access via signed URL only
 *   - Original files without watermark (high resolution)
 *   - Used ONLY for download after confirmation
 *   - Referenced by: original_path
 *   - Only exists if allowDownload=true during upload
 *   - NEVER access directly from browser (CORS blocked)
 *   - Use b2-download-url Edge Function for signed URLs
 * 
 * GOLDEN RULES:
 *   ❌ NEVER: access B2 directly from browser (CORS)
 *   ❌ NEVER: use original_path for display
 *   ✓ ALWAYS: use R2 (storage_key) for display
 *   ✓ ALWAYS: use signed URL for B2 downloads
 */

const R2_PUBLIC_URL = import.meta.env.VITE_R2_PUBLIC_URL || 'https://media.lunarihub.com';

export type PhotoSize = 'thumbnail' | 'preview' | 'original';

export interface PhotoPaths {
  storageKey: string;
  thumbPath?: string | null;
  previewPath?: string | null;
  width?: number;
  height?: number;
}

/**
 * Get photo URL for DISPLAY - always returns R2 URL
 * 
 * @param photo - Photo paths object
 * @param size - Target size (thumbnail, preview, original)
 * @returns R2 public URL for display
 */
export function getPhotoUrl(
  photo: PhotoPaths,
  size: PhotoSize
): string {
  // For 'original' size in display context, still use R2 preview
  // Actual B2 originals are accessed via b2-download-url Edge Function
  const path = size === 'thumbnail' 
    ? (photo.thumbPath || photo.previewPath || photo.storageKey)
    : (photo.previewPath || photo.storageKey);

  if (!path) return '/placeholder.svg';

  // Direct URL to R2 public bucket
  return `${R2_PUBLIC_URL}/${path}`;
}

/**
 * Get display URL for a storage key - ALWAYS R2
 * Use this for any UI display (thumbnails, lightbox, fullscreen)
 * 
 * @param storageKey - The R2 storage key (from storage_key column)
 * @returns R2 public URL
 */
export function getDisplayUrl(storageKey: string | null | undefined): string {
  if (!storageKey) return '/placeholder.svg';
  return `${R2_PUBLIC_URL}/${storageKey}`;
}

/**
 * @deprecated Use getDisplayUrl for display, or b2-download-url for downloads
 * 
 * This function now ALWAYS returns R2 URL for safety.
 * For actual B2 downloads, use the b2-download-url Edge Function.
 */
export function getOriginalPhotoUrl(storageKey: string | null | undefined): string {
  if (!storageKey) return '/placeholder.svg';
  // ALWAYS return R2 URL - B2 is accessed via signed URLs only
  return `${R2_PUBLIC_URL}/${storageKey}`;
}

/**
 * Check if photo is ready for display
 */
export function isPhotoReady(photo: { processingStatus?: string }): boolean {
  return photo.processingStatus !== 'error';
}

/**
 * Get R2 public URL base
 */
export function getR2PublicUrl(): string {
  return R2_PUBLIC_URL;
}
