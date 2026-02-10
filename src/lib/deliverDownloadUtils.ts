/**
 * Deliver Download Utilities - DEDICATED module for Deliver galleries.
 * 
 * Uses /deliver-download/ route which has NO finalized_at or allowDownload checks.
 * Completely independent from downloadUtils.ts (Select galleries).
 */

import JSZip from 'jszip';

const R2_WORKER_URL = import.meta.env.VITE_R2_UPLOAD_URL || 'https://cdn.lunarihub.com';

export interface DeliverDownloadablePhoto {
  storageKey: string;
  filename: string;
}

/**
 * Build a download URL through the Deliver-specific route.
 */
function buildDeliverDownloadUrl(storagePath: string, filename: string): string {
  const safePath = storagePath.split('/').map(encodeURIComponent).join('/');
  const encodedFilename = encodeURIComponent(filename);
  return `${R2_WORKER_URL}/download/${safePath}?filename=${encodedFilename}`;
}

/**
 * Detect mobile device.
 */
function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  ) || window.innerWidth < 768;
}

/**
 * Download a single photo from a Deliver gallery.
 */
export async function downloadDeliverPhoto(
  _galleryId: string,
  storagePath: string,
  filename: string
): Promise<void> {
  const url = buildDeliverDownloadUrl(storagePath, filename);
  triggerBrowserDownload(url, filename);
}

/**
 * Download all photos from a Deliver gallery.
 * Desktop → ZIP file
 * Mobile → sequential individual downloads
 */
export async function downloadAllDeliverPhotos(
  _galleryId: string,
  photos: DeliverDownloadablePhoto[],
  zipFilename: string,
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  if (photos.length === 0) {
    throw new Error('No photos to download');
  }

  if (isMobileDevice()) {
    return downloadSequential(photos, onProgress);
  }

  return downloadAsZip(photos, zipFilename, onProgress);
}

/**
 * Generate a ZIP with all photos and trigger download.
 */
async function downloadAsZip(
  photos: DeliverDownloadablePhoto[],
  zipFilename: string,
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  const zip = new JSZip();
  const total = photos.length;
  let current = 0;

  const usedNames = new Map<string, number>();

  for (const photo of photos) {
    if (!photo.storageKey) continue;

    const url = buildDeliverDownloadUrl(photo.storageKey, photo.filename);

    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.warn(`Failed to fetch ${photo.filename}: ${response.status}`);
        current++;
        onProgress?.(current, total);
        continue;
      }

      const blob = await response.blob();

      let finalName = photo.filename;
      const count = usedNames.get(finalName) || 0;
      if (count > 0) {
        const dotIndex = finalName.lastIndexOf('.');
        const name = dotIndex > 0 ? finalName.slice(0, dotIndex) : finalName;
        const ext = dotIndex > 0 ? finalName.slice(dotIndex) : '';
        finalName = `${name}_${count}${ext}`;
      }
      usedNames.set(photo.filename, count + 1);

      zip.file(finalName, blob);
    } catch (err) {
      console.warn(`Error fetching ${photo.filename}:`, err);
    }

    current++;
    onProgress?.(current, total);
  }

  const sanitizedName = zipFilename
    .replace(/[^a-zA-Z0-9\s_-]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 80);

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const blobUrl = URL.createObjectURL(zipBlob);

  triggerBrowserDownload(blobUrl, `${sanitizedName}.zip`);

  setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
}

/**
 * Sequential downloads for mobile.
 */
async function downloadSequential(
  photos: DeliverDownloadablePhoto[],
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  const total = photos.length;
  let current = 0;

  for (const photo of photos) {
    if (!photo.storageKey) continue;

    const url = buildDeliverDownloadUrl(photo.storageKey, photo.filename);
    triggerBrowserDownload(url, photo.filename);

    current++;
    onProgress?.(current, total);

    if (current < total) {
      await sleep(1500);
    }
  }
}

/**
 * Trigger a native browser download via <a> tag.
 */
function triggerBrowserDownload(url: string, filename: string): void {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
