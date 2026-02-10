/**
 * Cloudflare Worker: Gallery Upload, Serve & Download
 * 
 * Handles image uploads to R2, serves images, and downloads originals.
 * R2 bucket is PRIVATE - all access goes through this worker.
 * 
 * Routes:
 * - POST /upload          - Upload compressed preview to R2
 * - POST /upload-original - Upload original file to R2 (for download)
 * - POST /upload-watermark - Upload watermark PNG
 * - GET  /image/{path}    - Serve image from R2
 * - GET  /download/{path} - Download for SELECT galleries (requires finalized + allowDownload)
 * - GET  /deliver-download/{path} - Download for DELIVER galleries (no finalized check)
 * - GET  /health          - Health check
 * 
 * Authentication: JWT validated using JWKS (RS256)
 */

import * as jose from 'jose';

export interface Env {
  // R2 Bucket binding (configured in wrangler.toml)
  GALLERY_BUCKET: R2Bucket;
  // Supabase config
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

// CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
};

// JWKS configuration for Supabase JWT validation
const SUPABASE_JWKS_URL = 'https://tlnjspsywycbudhewsfv.supabase.co/auth/v1/.well-known/jwks.json';
const SUPABASE_ISSUER = 'https://tlnjspsywycbudhewsfv.supabase.co/auth/v1';

// Cache do JWKS (reutilizado entre requests)
let jwks: ReturnType<typeof jose.createRemoteJWKSet> | null = null;

function getJWKS(): ReturnType<typeof jose.createRemoteJWKSet> {
  if (!jwks) {
    jwks = jose.createRemoteJWKSet(new URL(SUPABASE_JWKS_URL));
  }
  return jwks;
}

// Validate Supabase JWT using JWKS (RS256)
async function validateAuth(
  request: Request
): Promise<{ userId: string; email: string } | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    console.log('Auth failed: No Authorization header');
    return null;
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    const { payload } = await jose.jwtVerify(token, getJWKS(), {
      issuer: SUPABASE_ISSUER,
    });

    const userId = payload.sub;
    const email = payload.email as string;

    if (!userId) {
      console.log('Auth failed: No sub claim in JWT');
      return null;
    }

    console.log(`Auth OK: user=${userId}, alg=RS256`);
    return { userId, email: email || '' };
  } catch (error) {
    console.error('JWT validation error:', {
      error: error instanceof Error ? error.message : String(error),
      errorName: error instanceof Error ? error.name : 'Unknown',
    });
    return null;
  }
}

// Handle compressed preview upload (existing route)
async function handleUpload(
  request: Request,
  env: Env
): Promise<Response> {
  const user = await validateAuth(request);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Não autorizado' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const galleryId = formData.get('galleryId') as string;
    const originalFilename = formData.get('originalFilename') as string;
    const width = parseInt(formData.get('width') as string) || 0;
    const height = parseInt(formData.get('height') as string) || 0;

    if (!file || !galleryId) {
      return new Response(
        JSON.stringify({ error: 'File e galleryId são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const photoId = crypto.randomUUID();
    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const filename = `${photoId}.${extension}`;
    const storagePath = `galleries/${galleryId}/${filename}`;

    const fileBuffer = await file.arrayBuffer();

    await env.GALLERY_BUCKET.put(storagePath, fileBuffer, {
      httpMetadata: { contentType: file.type || 'image/jpeg' },
      customMetadata: {
        originalFilename,
        uploadedAt: new Date().toISOString(),
        userId: user.userId,
        galleryId,
      },
    });

    console.log(`Uploaded to R2: ${storagePath} (${fileBuffer.byteLength} bytes)`);

    const previewPath = storagePath;
    const thumbPath = storagePath;

    const photoRecord = {
      galeria_id: galleryId,
      user_id: user.userId,
      filename,
      original_filename: originalFilename,
      storage_key: storagePath,
      original_path: storagePath,
      preview_path: previewPath,
      thumb_path: thumbPath,
      file_size: fileBuffer.byteLength,
      mime_type: file.type || 'image/jpeg',
      width,
      height,
      has_watermark: false,
      processing_status: 'ready',
    };

    const dbResponse = await fetch(
      `${env.SUPABASE_URL}/rest/v1/galeria_fotos`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          Prefer: 'return=representation',
        },
        body: JSON.stringify(photoRecord),
      }
    );

    if (!dbResponse.ok) {
      const dbError = await dbResponse.text();
      console.error('DB insert failed:', dbError);
      await env.GALLERY_BUCKET.delete(storagePath);
      return new Response(
        JSON.stringify({ error: 'Erro ao salvar no banco de dados' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const [savedPhoto] = await dbResponse.json();

    return new Response(
      JSON.stringify({
        success: true,
        photo: {
          id: savedPhoto.id,
          filename,
          originalFilename,
          storageKey: storagePath,
          originalPath: storagePath,
          previewPath,
          thumbPath,
          fileSize: fileBuffer.byteLength,
          mimeType: file.type || 'image/jpeg',
          width,
          height,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Upload error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro no upload' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Handle original file upload to R2 (for download).
 * Stores in originals/{galleryId}/{filename} to separate from previews.
 * No DB record created - just returns the R2 path.
 */
async function handleUploadOriginal(
  request: Request,
  env: Env
): Promise<Response> {
  const user = await validateAuth(request);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Não autorizado' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const galleryId = formData.get('galleryId') as string;
    const originalFilename = formData.get('originalFilename') as string;

    if (!file || !galleryId) {
      return new Response(
        JSON.stringify({ error: 'File e galleryId são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify gallery belongs to user via Supabase
    const galleryCheckRes = await fetch(
      `${env.SUPABASE_URL}/rest/v1/galerias?id=eq.${galleryId}&user_id=eq.${user.userId}&select=id`,
      {
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    );
    const galleryCheck = await galleryCheckRes.json();
    if (!galleryCheck || galleryCheck.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Galeria não encontrada ou sem permissão' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Store original in separate path: originals/{galleryId}/{timestamp}-{uuid}.{ext}
    const timestamp = Date.now();
    const randomId = crypto.randomUUID().slice(0, 8);
    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const filename = `${timestamp}-${randomId}.${extension}`;
    const storagePath = `originals/${galleryId}/${filename}`;

    const fileBuffer = await file.arrayBuffer();

    await env.GALLERY_BUCKET.put(storagePath, fileBuffer, {
      httpMetadata: { contentType: file.type || 'image/jpeg' },
      customMetadata: {
        originalFilename: originalFilename || file.name,
        uploadedAt: new Date().toISOString(),
        userId: user.userId,
        galleryId,
      },
    });

    console.log(`Original uploaded to R2: ${storagePath} (${fileBuffer.byteLength} bytes)`);

    return new Response(
      JSON.stringify({
        success: true,
        photo: {
          storageKey: storagePath,
          filename,
          originalFilename: originalFilename || file.name,
          fileSize: fileBuffer.byteLength,
          mimeType: file.type || 'image/jpeg',
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Upload original error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro no upload do original' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

// Handle image serving from R2
async function handleServe(
  request: Request,
  env: Env,
  path: string
): Promise<Response> {
  try {
    const object = await env.GALLERY_BUCKET.get(path);

    if (!object) {
      return new Response('Not found', { status: 404, headers: corsHeaders });
    }

    const headers = new Headers(corsHeaders);
    headers.set('Content-Type', object.httpMetadata?.contentType || 'image/jpeg');
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    headers.set('ETag', object.etag);

    const ifNoneMatch = request.headers.get('If-None-Match');
    if (ifNoneMatch === object.etag) {
      return new Response(null, { status: 304, headers });
    }

    return new Response(object.body, { headers });
  } catch (error) {
    console.error('Serve error:', error);
    return new Response('Internal server error', { status: 500, headers: corsHeaders });
  }
}

/**
 * Handle file download from R2 for SELECT galleries.
 * Requires finalized_at + allowDownload.
 * 
 * URL format: GET /download/{storagePath}?filename=original_name.jpg
 */
async function handleDownload(
  request: Request,
  env: Env,
  path: string
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const requestedFilename = url.searchParams.get('filename') || path.split('/').pop() || 'photo.jpg';

    const pathParts = path.split('/');
    if (pathParts.length < 3) {
      return new Response(JSON.stringify({ error: 'Invalid path' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const galleryId = pathParts[1];

    // Select galleries: verify finalized + allowDownload
    const galleryRes = await fetch(
      `${env.SUPABASE_URL}/rest/v1/galerias?id=eq.${galleryId}&select=id,tipo,finalized_at,configuracoes`,
      {
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    );
    const galleries = await galleryRes.json();
    
    if (!galleries || galleries.length === 0) {
      return new Response(JSON.stringify({ error: 'Gallery not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const gallery = galleries[0];
    const isDeliver = gallery.tipo === 'entrega';

    // Deliver galleries: skip finalized_at and allowDownload checks
    if (!isDeliver) {
      if (!gallery.finalized_at) {
        return new Response(JSON.stringify({ error: 'Gallery not finalized' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const config = gallery.configuracoes as Record<string, unknown> | null;
      if (config?.allowDownload !== true) {
        return new Response(JSON.stringify({ error: 'Download not allowed' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Verify photo belongs to gallery (check both original_path and storage_key for Deliver compatibility)
    const photoRes = await fetch(
      `${env.SUPABASE_URL}/rest/v1/galeria_fotos?galeria_id=eq.${galleryId}&or=(original_path.eq.${encodeURIComponent(path)},storage_key.eq.${encodeURIComponent(path)})&select=id`,
      {
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    );
    const photos = await photoRes.json();

    if (!photos || photos.length === 0) {
      return new Response(JSON.stringify({ error: 'Photo not found in gallery' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return await serveFileAsDownload(env, path, requestedFilename);
  } catch (error) {
    console.error('Download error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Download failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

// handleDeliverDownload removed - Deliver downloads now handled by handleDownload with tipo check

/**
 * Shared helper: fetch file from R2 and serve with Content-Disposition: attachment.
 */
async function serveFileAsDownload(
  env: Env,
  path: string,
  filename: string
): Promise<Response> {
  const object = await env.GALLERY_BUCKET.get(path);

  if (!object) {
    return new Response(JSON.stringify({ error: 'File not found in storage' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const headers = new Headers(corsHeaders);
  headers.set('Content-Type', object.httpMetadata?.contentType || 'image/jpeg');
  headers.set('Content-Disposition', `attachment; filename="${filename}"`);
  headers.set('Cache-Control', 'private, no-cache');
  if (object.size) {
    headers.set('Content-Length', object.size.toString());
  }

  console.log(`Download: ${path} -> ${filename} (${object.size} bytes)`);

  return new Response(object.body, { headers });
}

// Handle watermark upload
async function handleWatermarkUpload(
  request: Request,
  env: Env
): Promise<Response> {
  const user = await validateAuth(request);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Não autorizado' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return new Response(
        JSON.stringify({ error: 'Arquivo obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!file.type.includes('png')) {
      return new Response(
        JSON.stringify({ error: 'Apenas arquivos PNG são permitidos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (file.size > 2 * 1024 * 1024) {
      return new Response(
        JSON.stringify({ error: 'Arquivo muito grande (máximo 2MB)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const watermarkPath = `user-assets/${user.userId}/watermark.png`;
    const fileBuffer = await file.arrayBuffer();

    await env.GALLERY_BUCKET.put(watermarkPath, fileBuffer, {
      httpMetadata: { contentType: 'image/png' },
      customMetadata: {
        uploadedAt: new Date().toISOString(),
        userId: user.userId,
      },
    });

    console.log(`Watermark uploaded: ${watermarkPath} (${fileBuffer.byteLength} bytes)`);

    return new Response(
      JSON.stringify({ success: true, path: watermarkPath, size: fileBuffer.byteLength }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Watermark upload error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro no upload da watermark' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

// Main request handler
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Route: POST /upload (compressed preview)
    if (request.method === 'POST' && url.pathname === '/upload') {
      return handleUpload(request, env);
    }

    // Route: POST /upload-original (original file for download)
    if (request.method === 'POST' && url.pathname === '/upload-original') {
      return handleUploadOriginal(request, env);
    }

    // Route: POST /upload-watermark
    if (request.method === 'POST' && url.pathname === '/upload-watermark') {
      return handleWatermarkUpload(request, env);
    }

    // Route: GET /download/{path} - Download for both Select and Deliver galleries
    if (request.method === 'GET' && url.pathname.startsWith('/download/')) {
      const downloadPath = url.pathname.replace('/download/', '');
      return handleDownload(request, env, decodeURIComponent(downloadPath));
    }

    // Route: GET /image/{path}
    if (request.method === 'GET' && url.pathname.startsWith('/image/')) {
      const imagePath = url.pathname.replace('/image/', '');
      return handleServe(request, env, imagePath);
    }

    // Health check
    if (request.method === 'GET' && url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 404 for unknown routes
    return new Response('Not found', { status: 404, headers: corsHeaders });
  },
};
