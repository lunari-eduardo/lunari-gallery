/**
 * Image compression utilities for client-side processing
 * Compresses images before upload to B2
 */

export interface CompressionOptions {
  maxWidth: 800 | 1024 | 1920;
  quality: number; // 0.7-0.85
  removeExif: boolean;
}

export interface CompressedImage {
  blob: Blob;
  width: number;
  height: number;
  originalSize: number;
  compressedSize: number;
  filename: string;
}

/**
 * Default compression options
 */
export const defaultCompressionOptions: CompressionOptions = {
  maxWidth: 1920,
  quality: 0.8,
  removeExif: true,
};

/**
 * Load an image from a File object
 */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Calculate new dimensions maintaining aspect ratio
 */
function calculateDimensions(
  width: number,
  height: number,
  maxWidth: number
): { width: number; height: number } {
  if (width <= maxWidth) {
    return { width, height };
  }

  const ratio = maxWidth / width;
  return {
    width: maxWidth,
    height: Math.round(height * ratio),
  };
}

/**
 * Compress a single image file
 */
export async function compressImage(
  file: File,
  options: Partial<CompressionOptions> = {}
): Promise<CompressedImage> {
  const opts = { ...defaultCompressionOptions, ...options };

  // Load the image
  const img = await loadImage(file);
  const originalWidth = img.naturalWidth;
  const originalHeight = img.naturalHeight;

  // Calculate new dimensions
  const { width, height } = calculateDimensions(
    originalWidth,
    originalHeight,
    opts.maxWidth
  );

  // Create canvas and draw resized image
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to get canvas context");
  }

  // Draw with high quality
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, width, height);

  // Convert to blob
  // Using JPEG for photos (better compression), keep PNG for transparency
  const mimeType = file.type === "image/png" ? "image/png" : "image/jpeg";
  const quality = mimeType === "image/png" ? 1 : opts.quality;

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error("Failed to compress image"));
      },
      mimeType,
      quality
    );
  });

  // Clean up
  URL.revokeObjectURL(img.src);

  // Generate filename
  const extension = mimeType === "image/jpeg" ? "jpg" : "png";
  const baseName = file.name.replace(/\.[^/.]+$/, "");
  const filename = `${baseName}.${extension}`;

  return {
    blob,
    width,
    height,
    originalSize: file.size,
    compressedSize: blob.size,
    filename,
  };
}

/**
 * Compress multiple images in parallel
 */
export async function compressImages(
  files: File[],
  options: Partial<CompressionOptions> = {},
  onProgress?: (completed: number, total: number) => void
): Promise<CompressedImage[]> {
  const results: CompressedImage[] = [];
  let completed = 0;

  // Process in batches to avoid memory issues
  const batchSize = 3;
  
  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((file) => compressImage(file, options))
    );
    
    results.push(...batchResults);
    completed += batch.length;
    onProgress?.(completed, files.length);
  }

  return results;
}

/**
 * Get image dimensions from a file
 */
export async function getImageDimensions(
  file: File
): Promise<{ width: number; height: number }> {
  const img = await loadImage(file);
  const dimensions = {
    width: img.naturalWidth,
    height: img.naturalHeight,
  };
  URL.revokeObjectURL(img.src);
  return dimensions;
}

/**
 * Validate if a file is a supported image type
 */
export function isValidImageType(file: File): boolean {
  const validTypes = ["image/jpeg", "image/png", "image/webp"];
  return validTypes.includes(file.type);
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
