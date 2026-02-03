/**
 * Utilities for downloading photos (individual and batch)
 */

import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { getOriginalPhotoUrl } from './cloudinaryUrl';

export interface DownloadablePhoto {
  storageKey: string;
  filename: string;
}

/**
 * Download a single photo directly from B2 (without watermark)
 */
export async function downloadPhoto(
  storageKey: string,
  filename: string
): Promise<void> {
  try {
    const url = getOriginalPhotoUrl(storageKey);
    const response = await fetch(url, { mode: 'cors' });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch photo: ${response.status}`);
    }
    
    const blob = await response.blob();
    saveAs(blob, filename);
  } catch (error) {
    console.error('Error downloading photo:', error);
    throw error;
  }
}

/**
 * Download multiple photos as a ZIP file
 * @param photos Array of photos with storageKey and filename
 * @param zipFilename Name for the ZIP file (without extension)
 * @param onProgress Progress callback (current, total)
 */
export async function downloadAllPhotos(
  photos: DownloadablePhoto[],
  zipFilename: string,
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  const zip = new JSZip();
  const total = photos.length;
  let current = 0;
  
  // Fetch all photos in parallel with concurrency limit
  const concurrencyLimit = 3;
  const chunks: DownloadablePhoto[][] = [];
  
  for (let i = 0; i < photos.length; i += concurrencyLimit) {
    chunks.push(photos.slice(i, i + concurrencyLimit));
  }
  
  for (const chunk of chunks) {
    await Promise.all(
      chunk.map(async (photo) => {
        try {
          const url = getOriginalPhotoUrl(photo.storageKey);
          const response = await fetch(url, { mode: 'cors' });
          
          if (!response.ok) {
            console.error(`Failed to fetch ${photo.filename}: ${response.status}`);
            return;
          }
          
          const blob = await response.blob();
          zip.file(photo.filename, blob);
          
          current++;
          onProgress?.(current, total);
        } catch (error) {
          console.error(`Error fetching ${photo.filename}:`, error);
        }
      })
    );
  }
  
  // Generate and download the ZIP
  const zipBlob = await zip.generateAsync({ 
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });
  
  saveAs(zipBlob, `${zipFilename}.zip`);
}
