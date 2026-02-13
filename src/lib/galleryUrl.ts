// Production domain for gallery URLs
const PRODUCTION_GALLERY_DOMAIN = 'https://gallery.lunarihub.com';

// Supabase URL for edge functions
const SUPABASE_FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL
  ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`
  : 'https://tlnjspsywycbudhewsfv.supabase.co/functions/v1';

/**
 * Generates a gallery URL for the client using the production domain.
 */
export function getGalleryUrl(publicToken: string, photographerDomain?: string): string {
  if (!publicToken) return '';
  const baseDomain = photographerDomain || PRODUCTION_GALLERY_DOMAIN;
  return `${baseDomain}/g/${publicToken}`;
}

/**
 * Generates a gallery URL that goes through the OG edge function.
 * This URL serves dynamic Open Graph meta tags for WhatsApp/social previews,
 * then redirects normal users to the actual gallery.
 */
export function getGalleryOgUrl(publicToken: string): string {
  if (!publicToken) return '';
  return `${SUPABASE_FUNCTIONS_URL}/gallery-og?token=${publicToken}`;
}

/**
 * Checks if the current window is on a production domain
 */
export function isProductionDomain(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.hostname === 'gallery.lunarihub.com' ||
         window.location.hostname.endsWith('.gallery.lunarihub.com');
}
