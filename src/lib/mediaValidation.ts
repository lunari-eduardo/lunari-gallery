/**
 * Media validation utilities for Transfer galleries (photos + videos)
 */

const VIDEO_MIME_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v'];
const VIDEO_EXTENSIONS = ['mp4', 'mov', 'webm', 'm4v'];

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/pjpeg', 'image/png', 'image/webp'];
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];

/** Max file sizes */
export const MAX_VIDEO_SIZE = 500 * 1024 * 1024; // 500MB
export const MAX_IMAGE_SIZE = 20 * 1024 * 1024; // 20MB

function getExtension(file: File): string {
  return (file.name.split('.').pop() || '').toLowerCase();
}

/** Check if a file is a video */
export function isVideoFile(file: File): boolean {
  if (file.type && VIDEO_MIME_TYPES.includes(file.type.toLowerCase())) return true;
  return VIDEO_EXTENSIONS.includes(getExtension(file));
}

/** Check if a file is a valid image */
export function isImageFile(file: File): boolean {
  if (file.type && IMAGE_MIME_TYPES.includes(file.type.toLowerCase())) return true;
  return IMAGE_EXTENSIONS.includes(getExtension(file));
}

/** Check if file is valid media for Transfer (image or video) */
export function isValidTransferMedia(file: File): boolean {
  return isImageFile(file) || isVideoFile(file);
}

/** Get max size for a file based on type */
export function getMaxFileSize(file: File): number {
  return isVideoFile(file) ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
}

/** Validate file size */
export function isWithinSizeLimit(file: File): boolean {
  return file.size <= getMaxFileSize(file);
}

/**
 * Generate a thumbnail from a video file using Canvas.
 * Seeks to 1s and captures a frame.
 * Returns a Blob (JPEG) and dimensions, or null on failure.
 */
export async function generateVideoThumbnail(
  file: File
): Promise<{ blob: Blob; width: number; height: number } | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';

    const url = URL.createObjectURL(file);
    let resolved = false;

    const cleanup = () => {
      if (!resolved) {
        resolved = true;
        URL.revokeObjectURL(url);
        video.removeAttribute('src');
        video.load();
      }
    };

    const timeout = setTimeout(() => {
      cleanup();
      resolve(null);
    }, 10000);

    video.onloadedmetadata = () => {
      // Seek to 1s or 10% of duration, whichever is smaller
      video.currentTime = Math.min(1, video.duration * 0.1);
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          cleanup();
          clearTimeout(timeout);
          resolve(null);
          return;
        }

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            clearTimeout(timeout);
            resolved = true;
            URL.revokeObjectURL(url);
            video.removeAttribute('src');
            video.load();
            if (blob) {
              resolve({ blob, width: canvas.width, height: canvas.height });
            } else {
              resolve(null);
            }
          },
          'image/jpeg',
          0.7
        );
      } catch {
        cleanup();
        clearTimeout(timeout);
        resolve(null);
      }
    };

    video.onerror = () => {
      cleanup();
      clearTimeout(timeout);
      resolve(null);
    };

    video.src = url;
  });
}

/**
 * Get video dimensions from a File.
 */
export async function getVideoDimensions(
  file: File
): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.muted = true;
    video.preload = 'metadata';
    const url = URL.createObjectURL(file);

    const timeout = setTimeout(() => {
      URL.revokeObjectURL(url);
      resolve({ width: 1920, height: 1080 }); // fallback
    }, 5000);

    video.onloadedmetadata = () => {
      clearTimeout(timeout);
      const dims = { width: video.videoWidth || 1920, height: video.videoHeight || 1080 };
      URL.revokeObjectURL(url);
      resolve(dims);
    };

    video.onerror = () => {
      clearTimeout(timeout);
      URL.revokeObjectURL(url);
      resolve({ width: 1920, height: 1080 });
    };

    video.src = url;
  });
}
