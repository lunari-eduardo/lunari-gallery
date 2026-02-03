// Production domain for gallery URLs
const PRODUCTION_GALLERY_DOMAIN = 'https://gallery.lunarihub.com';

/**
 * Generates a gallery URL for the client using the production domain.
 * @param publicToken The gallery's public token
 * @param photographerDomain Optional custom domain for the photographer (future feature)
 * @returns Full URL to the gallery
 */
export function getGalleryUrl(publicToken: string, photographerDomain?: string): string {
  if (!publicToken) return '';
  
  // Priority: 
  // 1. Photographer's custom domain (e.g., galeria.fotografojose.com.br)
  // 2. Production gallery domain
  const baseDomain = photographerDomain || PRODUCTION_GALLERY_DOMAIN;
  
  return `${baseDomain}/g/${publicToken}`;
}

/**
 * Checks if the current window is on a production domain
 */
export function isProductionDomain(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.hostname === 'gallery.lunarihub.com' ||
         window.location.hostname.endsWith('.gallery.lunarihub.com');
}
