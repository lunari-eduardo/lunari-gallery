/**
 * Cloudinary Fetch API URL generator for B2-stored images
 * 
 * Architecture:
 * [B2 Storage] → [Cloudinary Fetch API] → [CDN Cache] → [Client]
 * 
 * Benefits:
 * - Dynamic watermarks (text/image) per gallery
 * - CDN caching (reduces B2 bandwidth costs)
 * - Automatic format optimization (WebP when supported)
 * - Responsive sizing per device
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

// Cloudinary Cloud Name (confirmed via user's Cloudinary dashboard)
const CLOUDINARY_CLOUD_NAME = 'dxfjakxte';

// B2 bucket URL (confirmed via diagnose-b2 edge function)
const B2_BUCKET_URL = 'https://f005.backblazeb2.com/file/lunari-gallery';

// Cloudinary Fetch API base URL
const CLOUDINARY_FETCH_BASE = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/fetch`;

// Toggle para debug - se false, usa URL direta do B2
const USE_CLOUDINARY = true;

/**
 * Map watermark position to Cloudinary gravity
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
 * Build watermark transformation string for Cloudinary
 */
function buildWatermarkTransformation(watermark: WatermarkSettings): string | null {
  if (watermark.type === 'none') return null;

  const gravity = getGravity(watermark.position);
  const opacity = Math.round(watermark.opacity);

  if (watermark.type === 'text' && watermark.text) {
    // Encode text for URL - replace spaces with %2520 for double encoding
    const escapedText = encodeURIComponent(watermark.text).replace(/%20/g, '%2520');
    
    // Text overlay: l_text:Font_Size:Text,g_position,o_opacity,co_color
    return `l_text:Arial_40:${escapedText},g_${gravity},o_${opacity},co_white`;
  }

  if (watermark.type === 'image' && watermark.logoUrl) {
    // For logo overlay, we use fetch with the logo URL
    const encodedLogoUrl = btoa(watermark.logoUrl).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    
    // Image overlay: l_fetch:base64url,g_position,o_opacity,w_width
    return `l_fetch:${encodedLogoUrl},g_${gravity},o_${opacity},w_150`;
  }

  return null;
}

/**
 * Generate a Cloudinary Fetch URL for an image stored in B2
 */
export function getCloudinaryUrl(options: ImageOptions): string {
  const { storageKey, width, height, watermark, quality = 'auto', format = 'auto' } = options;

  // Validate storageKey
  if (!storageKey || typeof storageKey !== 'string' || storageKey.trim() === '') {
    console.error('Cloudinary URL: storageKey inválido:', storageKey);
    return '/placeholder.svg';
  }

  // Build source URL from B2
  const sourceUrl = `${B2_BUCKET_URL}/${storageKey}`;

  // Se Cloudinary desabilitado, retornar URL direta do B2
  if (!USE_CLOUDINARY) {
    console.log('Cloudinary DISABLED - usando B2 direto:', sourceUrl);
    return sourceUrl;
  }

  // Build transformations array
  const transformations: string[] = [];

  // Format and quality (always first for best optimization)
  if (format === 'auto') transformations.push('f_auto');
  else if (format) transformations.push(`f_${format}`);
  
  if (quality === 'auto') transformations.push('q_auto');
  else if (typeof quality === 'number') transformations.push(`q_${quality}`);

  // Dimensions with c_limit (never upscales, only downscales)
  if (width) transformations.push(`w_${width}`);
  if (height) transformations.push(`h_${height}`);
  if (width || height) transformations.push('c_limit');

  // Apply watermark if configured
  if (watermark && watermark.type !== 'none') {
    const watermarkTransform = buildWatermarkTransformation(watermark);
    if (watermarkTransform) {
      transformations.push(watermarkTransform);
    }
  }

  // Build final URL - SEM encodeURIComponent (Cloudinary aceita URL não-codificada)
  const transformString = transformations.join(',');
  const finalUrl = `${CLOUDINARY_FETCH_BASE}/${transformString}/${sourceUrl}`;

  console.log('Cloudinary URL Build:', {
    storageKey,
    sourceUrl,
    transformations: transformString,
    finalUrl,
    b2Direct: sourceUrl,
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
 * Generate a preview URL (medium, with optional watermark)
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
 * Generate a fullscreen URL (large, with optional watermark)
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
