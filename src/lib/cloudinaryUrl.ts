/**
 * Cloudinary URL generator for dynamic image delivery with watermarks
 * Fetches images from B2 and applies transformations on-the-fly
 */

export interface WatermarkSettings {
  type: 'none' | 'text' | 'image';
  text?: string;
  logoUrl?: string;
  opacity: number; // 0-100
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center' | 'fill';
}

export interface CloudinaryOptions {
  storageKey: string;
  width?: number;
  height?: number;
  watermark?: WatermarkSettings | null;
  quality?: 'auto' | number;
  format?: 'auto' | 'jpg' | 'png' | 'webp';
}

// Cloudinary cloud name - hardcoded for production (VITE_* env vars don't work in Lovable)
const CLOUDINARY_CLOUD_NAME = 'dxfjakxte';

// B2 bucket URL - hardcoded for production
const B2_BUCKET_URL = 'https://f002.backblazeb2.com/file/lunari-gallery';

/**
 * Map position to Cloudinary gravity
 */
function getGravity(position: WatermarkSettings['position']): string {
  const gravityMap: Record<string, string> = {
    'top-left': 'north_west',
    'top-right': 'north_east',
    'bottom-left': 'south_west',
    'bottom-right': 'south_east',
    'center': 'center',
    'fill': 'center',
  };
  return gravityMap[position] || 'south_east';
}

/**
 * Build watermark transformation string
 */
function buildWatermarkTransformation(watermark: WatermarkSettings): string {
  if (watermark.type === 'none') return '';

  const gravity = getGravity(watermark.position);
  const opacity = Math.round(watermark.opacity);

  if (watermark.type === 'text' && watermark.text) {
    // Text watermark
    // Encode text for URL safety
    const encodedText = encodeURIComponent(watermark.text);
    
    if (watermark.position === 'fill') {
      // Tiled text watermark (diagonal pattern)
      return `l_text:Arial_40_bold:${encodedText},o_${opacity},a_-30,fl_tiled`;
    }
    
    return `l_text:Arial_30_bold:${encodedText},o_${opacity},g_${gravity},x_20,y_20`;
  }

  if (watermark.type === 'image' && watermark.logoUrl) {
    // Image watermark - using fetch overlay
    // Note: Logo needs to be accessible via URL
    const encodedUrl = encodeURIComponent(watermark.logoUrl);
    
    if (watermark.position === 'fill') {
      return `l_fetch:${btoa(watermark.logoUrl)},o_${opacity},fl_tiled,w_200`;
    }
    
    return `l_fetch:${btoa(watermark.logoUrl)},o_${opacity},g_${gravity},w_150,x_20,y_20`;
  }

  return '';
}

/**
 * Generate a Cloudinary URL for an image stored in B2
 */
/**
 * Generate a Cloudinary URL for an image stored in B2
 * Format: https://res.cloudinary.com/{cloud}/image/fetch/{transformations}/{encodedRemoteUrl}
 */
export function getCloudinaryUrl(options: CloudinaryOptions): string {
  const {
    storageKey,
    width,
    height,
    watermark,
    quality = 'auto',
    format = 'auto',
  } = options;

  // Validate storageKey
  if (!storageKey || typeof storageKey !== 'string' || storageKey.trim() === '') {
    console.error('Cloudinary: storageKey inválido:', storageKey);
    return '/placeholder.svg';
  }

  // Build source URL from B2
  const sourceUrl = `${B2_BUCKET_URL}/${storageKey}`;

  // Build transformations array
  const transformations: string[] = [];
  transformations.push(`f_${format}`);
  transformations.push(`q_${quality}`);
  if (width) transformations.push(`w_${width}`);
  if (height) transformations.push(`h_${height}`);
  if (width || height) transformations.push('c_limit');

  // Add watermark if configured
  if (watermark && watermark.type !== 'none') {
    const watermarkTransform = buildWatermarkTransformation(watermark);
    if (watermarkTransform) {
      transformations.push(watermarkTransform);
    }
  }

  // Build final URL with proper encoding
  const transformString = transformations.join(',');
  const encodedSourceUrl = encodeURIComponent(sourceUrl);
  const finalUrl = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/fetch/${transformString}/${encodedSourceUrl}`;

  // Debug log
  console.log('Cloudinary Build:', {
    constants: { cloudName: CLOUDINARY_CLOUD_NAME, bucketUrl: B2_BUCKET_URL },
    input: { storageKey, width, height },
    sourceUrl,
    finalUrl,
  });

  return finalUrl;
}

/**
 * Generate a thumbnail URL (small, no watermark)
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
 * Generate a preview URL (medium, with watermark)
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
 * Generate a fullscreen URL (large, with watermark)
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
 * Check if Cloudinary is properly configured
 */
export function isCloudinaryConfigured(): boolean {
  return Boolean(CLOUDINARY_CLOUD_NAME && B2_BUCKET_URL);
}
