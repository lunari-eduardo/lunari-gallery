/**
 * Image compression utilities for client-side processing
 * Compresses images before upload to R2 and optionally applies watermark (burn-in)
 */

const R2_PUBLIC_URL = import.meta.env.VITE_R2_PUBLIC_URL || 'https://media.lunarihub.com';

export interface CompressionOptions {
  maxLongEdge: 1024 | 1920 | 2560;
  quality: number; // 0.7-0.85
  removeExif: boolean;
  watermark?: WatermarkConfig;
}

export interface WatermarkConfig {
  mode: 'system' | 'custom' | 'none';
  /** Custom watermark path in R2 (for custom mode) */
  customPathHorizontal?: string | null;
  customPathVertical?: string | null;
  /** Opacity from 0 to 100 (default: 40) */
  opacity: number;
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
  maxLongEdge: 1920,
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
 * Load an image from a URL (for watermark assets)
 * Throws error if CORS or network fails - this MUST succeed
 */
function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous'; // Required for canvas access
    
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Falha ao carregar watermark: ${url}`));
    
    img.src = url;
  });
}

/**
 * Calculate new dimensions maintaining aspect ratio based on long edge
 */
function calculateDimensions(
  width: number,
  height: number,
  maxLongEdge: number
): { width: number; height: number } {
  // Determine which is the long edge
  const longEdge = Math.max(width, height);
  
  // If long edge is already within limit, keep original
  if (longEdge <= maxLongEdge) {
    return { width, height };
  }

  // Calculate ratio based on long edge
  const ratio = maxLongEdge / longEdge;
  return {
    width: Math.round(width * ratio),
    height: Math.round(height * ratio),
  };
}

/**
 * Apply watermark to canvas
 * CRITICAL: If this fails, the entire compression should fail
 * We do NOT upload photos without watermark when watermark is configured
 */
async function applyWatermark(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  config: WatermarkConfig
): Promise<void> {
  if (config.mode === 'none') return;

  const { width, height } = canvas;
  const orientation = width > height ? 'horizontal' : 'vertical';

  // Determine URL of watermark asset
  let watermarkUrl: string;
  
  if (config.mode === 'system') {
    // System watermarks: orientation-specific high-res assets
    const suffix = orientation === 'horizontal' ? 'h' : 'v';
    watermarkUrl = `${R2_PUBLIC_URL}/system-assets/default-watermark-${suffix}.png`;
  } else if (config.mode === 'custom') {
    // Custom watermarks: photographer's uploaded assets
    const customPath = orientation === 'horizontal' 
      ? config.customPathHorizontal 
      : config.customPathVertical;
    
    // Fallback: if only one orientation is uploaded, use it for both
    const fallbackPath = config.customPathHorizontal || config.customPathVertical;
    const pathToUse = customPath || fallbackPath;
    
    if (!pathToUse) {
      throw new Error('Nenhuma watermark personalizada configurada');
    }
    
    watermarkUrl = `${R2_PUBLIC_URL}/${pathToUse}`;
  } else {
    return; // Unknown mode, skip
  }

  // Load watermark image - MUST succeed
  const watermarkImg = await loadImageFromUrl(watermarkUrl);

  // Apply watermark with opacity using globalAlpha
  ctx.globalAlpha = config.opacity / 100;

  // Calculate dimensions to fit watermark (contain mode)
  const scale = Math.min(width / watermarkImg.width, height / watermarkImg.height);
  const wmWidth = watermarkImg.width * scale;
  const wmHeight = watermarkImg.height * scale;
  
  // Center the watermark
  const x = (width - wmWidth) / 2;
  const y = (height - wmHeight) / 2;

  // Draw watermark onto canvas
  ctx.drawImage(watermarkImg, x, y, wmWidth, wmHeight);

  // Restore full opacity for any subsequent operations
  ctx.globalAlpha = 1;
}

/**
 * Compress a single image file
 * If watermark is configured and fails to load, the entire operation fails
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

  // Calculate new dimensions based on long edge
  const { width, height } = calculateDimensions(
    originalWidth,
    originalHeight,
    opts.maxLongEdge
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

  // Apply watermark if configured (MUST succeed or fail the upload)
  if (opts.watermark && opts.watermark.mode !== 'none') {
    await applyWatermark(canvas, ctx, opts.watermark);
  }

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
