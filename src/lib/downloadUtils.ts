/**
 * Download utilities - Sequential Native Browser Downloads
 * 
 * Uses signed URLs from b2-download-url Edge Function.
 * Each file is downloaded via native browser <a> redirect (no CORS issues).
 * No ZIP, no fetch(), no proxy needed.
 */

import { supabase } from '@/integrations/supabase/client';

export interface DownloadablePhoto {
  storageKey: string; // This should be the original_path (B2 path)
  filename: string;
}

interface SignedUrlResult {
  storageKey: string;
  url: string;
  filename: string;
}

interface SignedUrlsResponse {
  success: boolean;
  urls: SignedUrlResult[];
  expiresIn: number;
  expiresAt: string;
  error?: string;
}

/**
 * Get signed download URLs from B2 via edge function
 */
async function getSignedDownloadUrls(
  galleryId: string,
  storageKeys: string[]
): Promise<SignedUrlResult[]> {
  const { data, error } = await supabase.functions.invoke<SignedUrlsResponse>(
    'b2-download-url',
    {
      body: { galleryId, storageKeys },
    }
  );

  if (error || !data?.success) {
    console.error('Failed to get signed URLs:', error || data?.error);
    throw new Error(data?.error || 'Failed to get download URLs');
  }

  return data.urls;
}

/**
 * Download a single photo using signed URL (native browser redirect)
 * No CORS issues - browser handles the download natively.
 */
export async function downloadPhoto(
  galleryId: string,
  storageKey: string,
  filename: string
): Promise<void> {
  const urls = await getSignedDownloadUrls(galleryId, [storageKey]);

  if (urls.length === 0) {
    throw new Error('Failed to get download URL');
  }

  triggerBrowserDownload(urls[0].url, filename);
}

/**
 * Download multiple photos SEQUENTIALLY using native browser downloads.
 * 
 * Each photo gets its own <a> click with a small delay between them.
 * This avoids:
 *   - CORS issues (no fetch(), just native navigation)
 *   - Proxy Edge Functions
 *   - ZIP generation in browser
 *   - Memory pressure from large batches
 * 
 * @param galleryId Gallery ID for authorization
 * @param photos Array of photos with storageKey (original_path) and filename
 * @param _zipFilename Unused - kept for API compatibility
 * @param onProgress Progress callback (current, total)
 */
export async function downloadAllPhotos(
  galleryId: string,
  photos: DownloadablePhoto[],
  _zipFilename: string,
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  if (photos.length === 0) {
    throw new Error('No photos to download');
  }

  // Get signed URLs for all photos in one request
  const storageKeys = photos.map((p) => p.storageKey).filter(Boolean);
  const signedUrls = await getSignedDownloadUrls(galleryId, storageKeys);

  if (signedUrls.length === 0) {
    throw new Error('No valid download URLs returned');
  }

  // Create a map for quick lookup
  const urlMap = new Map(signedUrls.map((u) => [u.storageKey, u]));

  const total = signedUrls.length;
  let current = 0;

  // Download each file sequentially with native browser download
  for (const photo of photos) {
    const urlInfo = urlMap.get(photo.storageKey);
    if (!urlInfo) continue;

    const filename = photo.filename || urlInfo.filename;
    triggerBrowserDownload(urlInfo.url, filename);

    current++;
    onProgress?.(current, total);

    // Small delay between downloads to let the browser process each one
    if (current < total) {
      await sleep(800);
    }
  }
}

/**
 * Trigger a native browser download via <a> tag.
 * No fetch(), no CORS - just browser-native file save.
 */
function triggerBrowserDownload(url: string, filename: string): void {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  // target blank helps some browsers treat it as download
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
