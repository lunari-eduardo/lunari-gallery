/**
 * Utilities for downloading photos (individual and batch)
 * Uses signed URLs from edge function to bypass B2 CORS restrictions
 */

import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { supabase } from '@/integrations/supabase/client';

export interface DownloadablePhoto {
  storageKey: string;
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
 */
export async function downloadPhoto(
  galleryId: string,
  storageKey: string,
  filename: string
): Promise<void> {
  try {
    const urls = await getSignedDownloadUrls(galleryId, [storageKey]);
    
    if (urls.length === 0) {
      throw new Error('Failed to get download URL');
    }

    // Use native browser download via redirect
    const link = document.createElement('a');
    link.href = urls[0].url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error('Error downloading photo:', error);
    throw error;
  }
}

/**
 * Download multiple photos as a ZIP file using signed URLs
 * @param galleryId Gallery ID for authorization
 * @param photos Array of photos with storageKey and filename
 * @param zipFilename Name for the ZIP file (without extension)
 * @param onProgress Progress callback (current, total)
 */
export async function downloadAllPhotos(
  galleryId: string,
  photos: DownloadablePhoto[],
  zipFilename: string,
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  if (photos.length === 0) {
    throw new Error('No photos to download');
  }

  // Get signed URLs for all photos
  const storageKeys = photos.map((p) => p.storageKey).filter(Boolean);
  const signedUrls = await getSignedDownloadUrls(galleryId, storageKeys);

  // Create a map for quick lookup
  const urlMap = new Map(signedUrls.map((u) => [u.storageKey, u]));

  const zip = new JSZip();
  const total = signedUrls.length;
  let current = 0;

  // Fetch all photos in parallel with concurrency limit
  const concurrencyLimit = 3;
  const chunks: SignedUrlResult[][] = [];

  for (let i = 0; i < signedUrls.length; i += concurrencyLimit) {
    chunks.push(signedUrls.slice(i, i + concurrencyLimit));
  }

  for (const chunk of chunks) {
    await Promise.all(
      chunk.map(async (urlInfo) => {
        try {
          // Fetch using the signed URL (no CORS issues with Authorization in URL)
          const response = await fetch(urlInfo.url);

          if (!response.ok) {
            console.error(`Failed to fetch ${urlInfo.filename}: ${response.status}`);
            return;
          }

          const blob = await response.blob();
          
          // Use original filename from photo data or URL info
          const originalPhoto = photos.find((p) => p.storageKey === urlInfo.storageKey);
          const filename = originalPhoto?.filename || urlInfo.filename;
          
          zip.file(filename, blob);

          current++;
          onProgress?.(current, total);
        } catch (error) {
          console.error(`Error fetching ${urlInfo.filename}:`, error);
        }
      })
    );
  }

  // Generate and download the ZIP
  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  saveAs(zipBlob, `${zipFilename}.zip`);
}
