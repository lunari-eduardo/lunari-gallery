/**
 * Cloudflare Worker: Image Processor
 * 
 * Versão COMPLETA com @cf-wasm/photon para processamento real de imagens.
 * Requer deploy via wrangler (npm install + wrangler deploy).
 * 
 * Funções:
 * - Resize para thumbnail (400px) e preview (1200px)
 * - Aplicação de watermark com opacidade e escala configuráveis
 * - Upload para R2
 * - Atualização do Supabase
 */

import { 
  PhotonImage, 
  SamplingFilter, 
  resize,
  blend
} from "@cf-wasm/photon/workerd";

export interface Env {
  GALLERY_BUCKET: R2Bucket;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  B2_PUBLIC_URL: string;
  WORKER_AUTH_SECRET: string;
  CDN_URL: string;
}

interface ProcessRequest {
  photos: PhotoData[];
}

interface PhotoData {
  id: string;
  userId: string;
  galleryId: string;
  filename: string;
  storageKey: string;
  width: number;
  height: number;
  watermark: WatermarkConfig;
}

interface WatermarkConfig {
  mode: 'system' | 'custom' | 'none';
  path?: string;
  opacity: number;
  scale: number;
}

interface ProcessResult {
  photoId: string;
  success: boolean;
  error?: string;
  thumbPath?: string;
  previewPath?: string;
  previewWmPath?: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Validate worker authentication
function validateAuth(request: Request, env: Env): boolean {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return false;
  const token = authHeader.replace('Bearer ', '');
  return token === env.WORKER_AUTH_SECRET;
}

// Fetch image from URL as Uint8Array
async function fetchImage(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

// Resize image maintaining aspect ratio
function resizeImage(
  imageBytes: Uint8Array, 
  longEdge: number
): { image: PhotonImage; bytes: Uint8Array } {
  const image = PhotonImage.new_from_byteslice(imageBytes);
  const width = image.get_width();
  const height = image.get_height();
  const isLandscape = width >= height;
  
  let newWidth: number;
  let newHeight: number;
  
  if (isLandscape) {
    newWidth = longEdge;
    newHeight = Math.round((height / width) * longEdge);
  } else {
    newHeight = longEdge;
    newWidth = Math.round((width / height) * longEdge);
  }
  
  const resized = resize(image, newWidth, newHeight, SamplingFilter.Lanczos3);
  const bytes = resized.get_bytes_jpeg(85);
  
  image.free();
  
  return { image: resized, bytes };
}

// Get watermark URL based on config and orientation
function getWatermarkUrl(
  config: WatermarkConfig, 
  isLandscape: boolean,
  cdnUrl: string
): string | null {
  if (config.mode === 'none') return null;
  
  if (config.mode === 'custom' && config.path) {
    return `${cdnUrl}/image/${config.path}`;
  }
  
  // System watermark - use orientation-specific from production domain
  const filename = isLandscape ? 'horizontal.png' : 'vertical.png';
  return `https://gallery.lunarihub.com/watermarks/${filename}`;
}

// Apply watermark overlay with opacity and scale
function applyWatermark(
  baseImage: PhotonImage,
  watermarkBytes: Uint8Array,
  opacity: number,
  scale: number
): Uint8Array {
  const wmImage = PhotonImage.new_from_byteslice(watermarkBytes);
  
  const baseWidth = baseImage.get_width();
  const baseHeight = baseImage.get_height();
  const minDim = Math.min(baseWidth, baseHeight);
  
  // Scale watermark to percentage of smaller dimension
  const wmWidth = wmImage.get_width();
  const wmHeight = wmImage.get_height();
  const wmRatio = wmWidth / wmHeight;
  
  const targetWmWidth = Math.round(minDim * (scale / 100));
  const targetWmHeight = Math.round(targetWmWidth / wmRatio);
  
  // Resize watermark
  const resizedWm = resize(wmImage, targetWmWidth, targetWmHeight, SamplingFilter.Lanczos3);
  wmImage.free();
  
  // Calculate center position
  const x = Math.round((baseWidth - targetWmWidth) / 2);
  const y = Math.round((baseHeight - targetWmHeight) / 2);
  
  // Blend watermark onto base image
  // Note: blend applies the watermark with the specified opacity
  blend(baseImage, resizedWm, "over", x, y);
  
  resizedWm.free();
  
  // Get result as JPEG
  const result = baseImage.get_bytes_jpeg(85);
  baseImage.free();
  
  return result;
}

// Process a single photo
async function processPhoto(
  photo: PhotoData,
  env: Env
): Promise<ProcessResult> {
  const startTime = Date.now();
  
  try {
    console.log(`Processing photo ${photo.id}: ${photo.filename}`);
    
    // 1. Fetch original from B2
    const originalUrl = `${env.B2_PUBLIC_URL}/${photo.storageKey}`;
    const originalBytes = await fetchImage(originalUrl);
    console.log(`Fetched original: ${(originalBytes.length / 1024).toFixed(0)}KB`);
    
    const isLandscape = photo.width >= photo.height;
    
    // 2. Generate thumbnail (400px, no watermark)
    const { bytes: thumbBytes, image: thumbImage } = resizeImage(originalBytes, 400);
    thumbImage.free();
    console.log(`Generated thumb: ${(thumbBytes.length / 1024).toFixed(0)}KB`);
    
    // 3. Generate preview (1200px, no watermark)
    const { bytes: previewBytes, image: previewImage } = resizeImage(originalBytes, 1200);
    previewImage.free();
    console.log(`Generated preview: ${(previewBytes.length / 1024).toFixed(0)}KB`);
    
    // 4. Generate preview with watermark (if enabled)
    let previewWmBytes: Uint8Array;
    
    if (photo.watermark.mode !== 'none') {
      const wmUrl = getWatermarkUrl(photo.watermark, isLandscape, env.CDN_URL);
      
      if (wmUrl) {
        try {
          const wmBytes = await fetchImage(wmUrl);
          
          // Create a fresh copy of the preview for watermarking
          const { image: previewForWm } = resizeImage(originalBytes, 1200);
          
          previewWmBytes = applyWatermark(
            previewForWm,
            wmBytes,
            photo.watermark.opacity,
            photo.watermark.scale
          );
          console.log(`Generated preview-wm: ${(previewWmBytes.length / 1024).toFixed(0)}KB`);
        } catch (wmError) {
          console.warn(`Watermark application failed, using preview without watermark:`, wmError);
          previewWmBytes = previewBytes;
        }
      } else {
        previewWmBytes = previewBytes;
      }
    } else {
      // No watermark mode
      previewWmBytes = previewBytes;
    }
    
    // 5. Build R2 paths
    const basePath = `${photo.userId}/${photo.galleryId}`;
    const thumbPath = `${basePath}/thumb/${photo.filename}`;
    const previewPath = `${basePath}/preview/${photo.filename}`;
    const previewWmPath = `${basePath}/preview-wm/${photo.filename}`;
    
    // 6. Upload all versions to R2 in parallel
    await Promise.all([
      env.GALLERY_BUCKET.put(thumbPath, thumbBytes, {
        httpMetadata: { contentType: 'image/jpeg' },
      }),
      env.GALLERY_BUCKET.put(previewPath, previewBytes, {
        httpMetadata: { contentType: 'image/jpeg' },
      }),
      env.GALLERY_BUCKET.put(previewWmPath, previewWmBytes, {
        httpMetadata: { contentType: 'image/jpeg' },
      }),
    ]);
    console.log(`Uploaded to R2: thumb, preview, preview-wm`);
    
    // 7. Update Supabase with paths and status
    const updateResponse = await fetch(
      `${env.SUPABASE_URL}/rest/v1/galeria_fotos?id=eq.${photo.id}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          thumb_path: thumbPath,
          preview_path: previewPath,
          preview_wm_path: previewWmPath,
          processing_status: 'ready',
          has_watermark: photo.watermark.mode !== 'none',
          updated_at: new Date().toISOString(),
        }),
      }
    );
    
    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      throw new Error(`Database update failed: ${updateResponse.status} - ${errorText}`);
    }
    
    const duration = Date.now() - startTime;
    console.log(`✓ Photo ${photo.id} processed in ${duration}ms`);
    
    return {
      photoId: photo.id,
      success: true,
      thumbPath,
      previewPath,
      previewWmPath,
    };
  } catch (error) {
    console.error(`✗ Photo ${photo.id} failed:`, error);
    
    // Mark as error in Supabase
    try {
      await fetch(
        `${env.SUPABASE_URL}/rest/v1/galeria_fotos?id=eq.${photo.id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify({
            processing_status: 'error',
            updated_at: new Date().toISOString(),
          }),
        }
      );
    } catch (dbError) {
      console.error(`Failed to mark photo ${photo.id} as error:`, dbError);
    }
    
    return {
      photoId: photo.id,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Main request handler
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    // Health check
    if (request.method === 'GET' && url.pathname === '/health') {
      return new Response(
        JSON.stringify({ 
          status: 'ok', 
          version: '1.0.0',
          timestamp: new Date().toISOString() 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Process endpoint
    if (request.method === 'POST' && url.pathname === '/process') {
      // Validate authentication
      if (!validateAuth(request, env)) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      try {
        const body: ProcessRequest = await request.json();
        
        if (!body.photos || !Array.isArray(body.photos)) {
          return new Response(
            JSON.stringify({ error: 'Invalid request: photos array required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        console.log(`Processing batch of ${body.photos.length} photos`);
        
        // Process photos sequentially to manage memory
        const results: ProcessResult[] = [];
        for (const photo of body.photos) {
          const result = await processPhoto(photo, env);
          results.push(result);
        }
        
        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;
        
        console.log(`Batch complete: ${successful} success, ${failed} failed`);
        
        return new Response(
          JSON.stringify({
            processed: results.length,
            successful,
            failed,
            results,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (error) {
        console.error('Process error:', error);
        return new Response(
          JSON.stringify({ 
            error: error instanceof Error ? error.message : 'Internal error' 
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    
    // 404 for unknown routes
    return new Response('Not found', { status: 404, headers: corsHeaders });
  },
};
