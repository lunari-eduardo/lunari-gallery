/**
 * Download utilities - R2 Worker Proxy Downloads
 * 
 * Downloads go through the Cloudflare Worker which reads from R2 and
 * returns with Content-Disposition: attachment, forcing browser download.
 * 
 * No CORS issues, no signed URLs, no B2 auth.
 */

const R2_WORKER_URL = import.meta.env.VITE_R2_UPLOAD_URL || 'https://cdn.lunarihub.com';

export interface DownloadablePhoto {
  storageKey: string; // original_path in R2 (originals/{galleryId}/...)
  filename: string;
}

/**
 * Build a download URL that goes through the Cloudflare Worker.
 * The Worker reads from R2 and returns with Content-Disposition: attachment.
 */
function buildDownloadUrl(storagePath: string, filename: string): string {
  const encodedPath = encodeURIComponent(storagePath);
  const encodedFilename = encodeURIComponent(filename);
  return `${R2_WORKER_URL}/download/${encodedPath}?filename=${encodedFilename}`;
}

/**
 * Download a single photo via Worker proxy.
 */
export async function downloadPhoto(
  _galleryId: string,
  storagePath: string,
  filename: string
): Promise<void> {
  const url = buildDownloadUrl(storagePath, filename);
  triggerBrowserDownload(url, filename);
}

/**
 * Download multiple photos sequentially via Worker proxy.
 * Each download is a direct browser navigation to the Worker URL.
 */
export async function downloadAllPhotos(
  _galleryId: string,
  photos: DownloadablePhoto[],
  _zipFilename: string,
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  if (photos.length === 0) {
    throw new Error('No photos to download');
  }

  const total = photos.length;
  let current = 0;

  for (const photo of photos) {
    if (!photo.storageKey) continue;

    const url = buildDownloadUrl(photo.storageKey, photo.filename);
    triggerBrowserDownload(url, photo.filename);

    current++;
    onProgress?.(current, total);

    // Delay between downloads to let the browser process each one
    if (current < total) {
      await sleep(800);
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
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
