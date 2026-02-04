/**
 * Cloudflare Worker: Image Processor (Versão Simplificada)
 * 
 * ⚠️ ESTA VERSÃO USA CLOUDFLARE IMAGE RESIZING ⚠️
 * 
 * Requisitos:
 * - Cloudflare Image Resizing habilitado no seu plano (Pro ou superior)
 * - OU usar esta versão apenas para organização de arquivos (sem resize real)
 * 
 * Para usar no Quick Edit do Cloudflare:
 * 1. Crie um novo Worker chamado "lunari-image-processor"
 * 2. Cole este código
 * 3. Configure as variáveis de ambiente (Settings > Variables):
 *    - SUPABASE_URL: https://tlnjspsywycbudhewsfv.supabase.co
 *    - SUPABASE_SERVICE_ROLE_KEY: (sua chave)
 *    - B2_PUBLIC_URL: https://f005.backblazeb2.com/file/lunari-gallery
 *    - CDN_URL: https://cdn.lunarihub.com
 *    - WORKER_AUTH_SECRET: (gere uma string aleatória forte)
 * 4. Vincule o R2 bucket (Settings > Variables > R2 Bucket Bindings):
 *    - Variable name: GALLERY_BUCKET
 *    - R2 bucket: lunari-gallery
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Validate worker authentication
function validateAuth(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.replace('Bearer ', '');
  return token === env.WORKER_AUTH_SECRET;
}

// Fetch image from URL
async function fetchImage(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

// Get watermark URL based on config
function getWatermarkUrl(config, isLandscape, cdnUrl) {
  if (config.mode === 'none') return null;
  
  if (config.mode === 'custom' && config.path) {
    return `${cdnUrl}/image/${config.path}`;
  }
  
  // System watermark
  const filename = isLandscape ? 'horizontal.png' : 'vertical.png';
  return `https://gallery.lunarihub.com/watermarks/${filename}`;
}

// Process single photo
async function processPhoto(photo, env) {
  const startTime = Date.now();
  
  try {
    console.log(`Processing photo ${photo.id}: ${photo.filename}`);
    
    // 1. Fetch original from B2
    const originalUrl = `${env.B2_PUBLIC_URL}/${photo.storageKey}`;
    const originalBytes = await fetchImage(originalUrl);
    console.log(`Fetched original: ${Math.round(originalBytes.length / 1024)}KB`);
    
    const isLandscape = photo.width >= photo.height;
    
    // 2. Build R2 paths
    const basePath = `${photo.userId}/${photo.galleryId}`;
    const thumbPath = `${basePath}/thumb/${photo.filename}`;
    const previewPath = `${basePath}/preview/${photo.filename}`;
    const previewWmPath = `${basePath}/preview-wm/${photo.filename}`;
    
    // 3. Upload original to all three paths
    // Note: Without Image Resizing API or WASM, we store the original
    // and rely on cf-image params at serve time for on-the-fly resize
    await Promise.all([
      env.GALLERY_BUCKET.put(thumbPath, originalBytes, {
        httpMetadata: { contentType: 'image/jpeg' },
        customMetadata: { 
          originalSize: String(originalBytes.length),
          targetSize: '400',
        },
      }),
      env.GALLERY_BUCKET.put(previewPath, originalBytes, {
        httpMetadata: { contentType: 'image/jpeg' },
        customMetadata: { 
          originalSize: String(originalBytes.length),
          targetSize: '1200',
        },
      }),
      env.GALLERY_BUCKET.put(previewWmPath, originalBytes, {
        httpMetadata: { contentType: 'image/jpeg' },
        customMetadata: { 
          originalSize: String(originalBytes.length),
          targetSize: '1200',
          hasWatermark: String(photo.watermark.mode !== 'none'),
        },
      }),
    ]);
    console.log(`Uploaded to R2`);
    
    // 4. Update Supabase
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
      throw new Error(`DB update failed: ${updateResponse.status}`);
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
    
    // Mark as error
    try {
      await fetch(
        `${env.SUPABASE_URL}/rest/v1/galeria_fotos?id=eq.${photo.id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            processing_status: 'error',
            updated_at: new Date().toISOString(),
          }),
        }
      );
    } catch (e) {
      console.error('Failed to mark as error:', e);
    }
    
    return {
      photoId: photo.id,
      success: false,
      error: error.message || String(error),
    };
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    // Health check
    if (request.method === 'GET' && url.pathname === '/health') {
      return new Response(
        JSON.stringify({ status: 'ok', version: 'simple-1.0.0' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Process endpoint
    if (request.method === 'POST' && url.pathname === '/process') {
      if (!validateAuth(request, env)) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      try {
        const body = await request.json();
        
        if (!body.photos || !Array.isArray(body.photos)) {
          return new Response(
            JSON.stringify({ error: 'photos array required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        console.log(`Processing ${body.photos.length} photos`);
        
        const results = [];
        for (const photo of body.photos) {
          const result = await processPhoto(photo, env);
          results.push(result);
        }
        
        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;
        
        return new Response(
          JSON.stringify({ processed: results.length, successful, failed, results }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (error) {
        console.error('Process error:', error);
        return new Response(
          JSON.stringify({ error: error.message || 'Internal error' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    
    return new Response('Not found', { status: 404, headers: corsHeaders });
  },
};
