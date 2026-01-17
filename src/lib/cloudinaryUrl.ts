/**
 * Cloudinary URL builder for B2 images
 * Uses Cloudinary's fetch feature to transform images stored in B2
 */

import { WatermarkSettings } from '@/types/gallery';

const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || '';
const B2_BUCKET_URL = import.meta.env.VITE_B2_BUCKET_URL || '';

// Fixed URL for watermarks - uses published domain for consistency
const WATERMARK_BASE_URL = 'https://lunari-gallery.lovable.app';

export interface CloudinaryOptions {
  size?: 'thumbnail' | 'preview' | 'full';
  width?: number;
  height?: number;
  quality?: 'auto' | number;
  format?: 'auto' | 'jpg' | 'png' | 'webp';
  watermark?: WatermarkSettings | null;
  photoWidth?: number;
  photoHeight?: number;
}

// Size presets
const SIZE_PRESETS = {
  thumbnail: { width: 400, quality: 'auto' as const },
  preview: { width: 1200, quality: 'auto' as const },
  full: { width: 1920, quality: 'auto' as const },
};

/**
 * Encode URL for Cloudinary l_fetch overlay
 */
function encodeUrlForCloudinary(url: string): string {
  return btoa(url).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Build a Cloudinary URL for an image stored in B2
 * @param storagePath - The path in B2 (e.g., "galleries/uuid/filename.jpg")
 * @param options - Transformation options
 */
export function buildCloudinaryUrl(
  storagePath: string | null | undefined,
  options: CloudinaryOptions = {}
): string {
  if (!storagePath) return '/placeholder.svg';
  
  // If Cloudinary is not configured, return B2 URL directly
  if (!CLOUDINARY_CLOUD_NAME || !B2_BUCKET_URL) {
    console.warn('Cloudinary or B2 not configured, returning direct B2 URL');
    return B2_BUCKET_URL ? `${B2_BUCKET_URL}/${storagePath}` : '/placeholder.svg';
  }

  // Get size preset or use custom dimensions
  const preset = options.size ? SIZE_PRESETS[options.size] : null;
  const width = options.width || preset?.width || 1920;
  const quality = options.quality || preset?.quality || 'auto';
  const format = options.format || 'auto';

  // Build transformation string
  const transformations: string[] = [];

  // Resize
  transformations.push(`w_${width}`);
  transformations.push('c_limit'); // Limit to max width, don't upscale
  
  // Quality and format
  transformations.push(`q_${quality}`);
  transformations.push(`f_${format}`);

  // Add watermark if configured (type === 'standard')
  if (options.watermark && options.watermark.type === 'standard') {
    const watermark = options.watermark;
    const opacity = watermark.opacity || 40;
    
    // Detect photo orientation based on dimensions
    // If photo is wider than tall (or equal), use horizontal watermark
    // If photo is taller than wide, use vertical watermark
    const isHorizontal = (options.photoWidth || 800) >= (options.photoHeight || 600);
    const watermarkFile = isHorizontal ? 'horizontal.png' : 'vertical.png';
    
    // Use fixed published URL for watermark (ensures consistency across environments)
    const watermarkUrl = `${WATERMARK_BASE_URL}/watermarks/${watermarkFile}`;

    // Cloudinary fetch overlay syntax
    const encodedWatermark = encodeUrlForCloudinary(watermarkUrl);
    
    // Map position to Cloudinary gravity (standard always uses center)
    const gravity = 'center';

    // Add watermark overlay
    transformations.push(`l_fetch:${encodedWatermark}`);
    transformations.push(`g_${gravity}`);
    transformations.push(`o_${opacity}`);
    transformations.push('fl_layer_apply');
  }

  // Build final URL
  const transformStr = transformations.join(',');
  const sourceUrl = `${B2_BUCKET_URL}/${storagePath}`;
  
  return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/fetch/${transformStr}/${sourceUrl}`;
}

/**
 * Get photo URL with appropriate size and watermark
 * @param storagePath - Path to image in B2
 * @param size - Image size preset
 * @param watermarkSettings - Watermark configuration
 * @param photoWidth - Original photo width (for orientation detection)
 * @param photoHeight - Original photo height (for orientation detection)
 */
export function getCloudinaryPhotoUrl(
  storagePath: string | null | undefined,
  size: 'thumbnail' | 'preview' | 'full',
  watermarkSettings?: WatermarkSettings | null,
  photoWidth?: number,
  photoHeight?: number
): string {
  // Only apply watermark to preview and full sizes
  const applyWatermark = size !== 'thumbnail' && watermarkSettings && watermarkSettings.type !== 'none';
  
  return buildCloudinaryUrl(storagePath, {
    size,
    watermark: applyWatermark ? watermarkSettings : null,
    photoWidth,
    photoHeight,
  });
}
