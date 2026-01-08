/**
 * Cloudinary Fetch API URL generator for B2-stored images
 * 
 * Architecture:
 * [B2 Storage] → [Cloudinary Fetch API] → [CDN Cache] → [Client]
 * 
 * IMPORTANT RULES:
 * 1. Cloudinary is the mandatory delivery layer (not optional)
 * 2. Use normal URLs with encodeURIComponent (NOT Base64)
 * 3. NEVER hardcode B2 shard (f002, f005, etc) - use downloadUrl from backend
 * 4. The b2BaseUrl must come from the get-b2-config Edge Function
 */

export interface WatermarkSettings {
  type: 'none' | 'standard' | 'text' | 'image';
  text?: string;
  logoUrl?: string;
  opacity: number; // 0-100
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center' | 'fill';
}

export interface ImageOptions {
  storageKey: string;
  b2BaseUrl: string; // REQUIRED: e.g. "https://f005.backblazeb2.com/file/lunari-gallery"
  width?: number;
  height?: number;
  watermark?: WatermarkSettings | null;
  quality?: 'auto' | number;
  format?: 'auto' | 'jpg' | 'png' | 'webp';
  imageWidth?: number;  // Original image width for orientation detection
  imageHeight?: number; // Original image height for orientation detection
}

// Cloudinary Cloud Name - MUST match the secret CLOUDINARY_CLOUD_NAME
const CLOUDINARY_CLOUD_NAME = 'dmaavprll';

// Cloudinary Fetch API base URL
const CLOUDINARY_FETCH_BASE = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/fetch`;

// Standard watermark images (served from public folder)
const getStandardWatermarkUrl = (isHorizontal: boolean): string => {
  // Use the deployed origin for watermark URLs
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/watermarks/${isHorizontal ? 'horizontal' : 'vertical'}.png`;
};

// Fixed opacity for standard watermark
const STANDARD_WATERMARK_OPACITY = 40;

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
function buildWatermarkTransformation(
  watermark: WatermarkSettings, 
  imageWidth?: number, 
  imageHeight?: number
): string | null {
  if (watermark.type === 'none') return null;

  // Handle standard watermark type
  if (watermark.type === 'standard') {
    // Determine orientation based on image dimensions
    const isHorizontal = (imageWidth || 800) >= (imageHeight || 600);
    const logoUrl = getStandardWatermarkUrl(isHorizontal);
    
    // Encode URL for Cloudinary overlay (Base64 for overlays)
    const encodedLogoUrl = btoa(logoUrl).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    
    // Standard watermark: centered, fixed opacity, responsive width
    return `l_fetch:${encodedLogoUrl},g_center,o_${STANDARD_WATERMARK_OPACITY},w_400`;
  }

  const gravity = getGravity(watermark.position);
  const opacity = Math.round(watermark.opacity);

  if (watermark.type === 'text' && watermark.text) {
    // Encode text for URL - replace spaces with %2520 for double encoding
    const escapedText = encodeURIComponent(watermark.text).replace(/%20/g, '%2520');
    
    // Text overlay: l_text:Font_Size:Text,g_position,o_opacity,co_color
    return `l_text:Arial_40:${escapedText},g_${gravity},o_${opacity},co_white`;
  }

  if (watermark.type === 'image' && watermark.logoUrl) {
    // For logo overlay, we use fetch with the logo URL (Base64 ONLY for overlays)
    const encodedLogoUrl = btoa(watermark.logoUrl).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    
    // Image overlay: l_fetch:base64url,g_position,o_opacity,w_width
    return `l_fetch:${encodedLogoUrl},g_${gravity},o_${opacity},w_150`;
  }

  return null;
}

/**
 * Generate a Cloudinary Fetch URL for an image stored in B2
 * 
 * CORRECT FORMAT:
 * https://res.cloudinary.com/<cloud>/image/fetch/f_auto,q_auto,w_1200,c_limit/https%3A%2F%2F<downloadUrl>%2Ffile%2F<bucket>%2F<storage_key>
 */
export function getCloudinaryUrl(options: ImageOptions): string {
  const { storageKey, b2BaseUrl, width, height, watermark, quality = 'auto', format = 'auto', imageWidth, imageHeight } = options;

  // Validate inputs
  if (!storageKey || typeof storageKey !== 'string' || storageKey.trim() === '') {
    console.error('Cloudinary URL: storageKey inválido:', storageKey);
    return '/placeholder.svg';
  }

  if (!b2BaseUrl || typeof b2BaseUrl !== 'string') {
    console.error('Cloudinary URL: b2BaseUrl inválido:', b2BaseUrl);
    return '/placeholder.svg';
  }

  // Build source URL from B2 (using dynamic downloadUrl from backend)
  const sourceUrl = `${b2BaseUrl}/${storageKey}`;

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
    const watermarkTransform = buildWatermarkTransformation(watermark, imageWidth, imageHeight);
    if (watermarkTransform) {
      transformations.push(watermarkTransform);
    }
  }

  // Build final URL with encodeURIComponent (NOT Base64)
  const transformString = transformations.join(',');
  const encodedSource = encodeURIComponent(sourceUrl);
  const finalUrl = `${CLOUDINARY_FETCH_BASE}/${transformString}/${encodedSource}`;

  console.log('Cloudinary URL Build:', {
    storageKey,
    b2BaseUrl,
    sourceUrl,
    transformations: transformString,
    finalUrl,
  });

  return finalUrl;
}

/**
 * Generate a thumbnail URL (small, no watermark)
 */
export function getThumbnailUrl(storageKey: string, b2BaseUrl: string, size: number = 300): string {
  return getCloudinaryUrl({
    storageKey,
    b2BaseUrl,
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
  b2BaseUrl: string,
  watermark: WatermarkSettings | null,
  maxWidth: number = 1200,
  imageWidth?: number,
  imageHeight?: number
): string {
  return getCloudinaryUrl({
    storageKey,
    b2BaseUrl,
    width: maxWidth,
    quality: 'auto',
    format: 'auto',
    watermark,
    imageWidth,
    imageHeight,
  });
}

/**
 * Generate a fullscreen URL (large, with optional watermark)
 */
export function getFullscreenUrl(
  storageKey: string,
  b2BaseUrl: string,
  watermark: WatermarkSettings | null,
  imageWidth?: number,
  imageHeight?: number
): string {
  return getCloudinaryUrl({
    storageKey,
    b2BaseUrl,
    width: 1920,
    quality: 'auto',
    format: 'auto',
    watermark,
    imageWidth,
    imageHeight,
  });
}

/**
 * Check if Cloudinary is properly configured
 */
export function isCloudinaryConfigured(): boolean {
  return Boolean(CLOUDINARY_CLOUD_NAME);
}
