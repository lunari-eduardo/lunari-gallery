/**
 * Cloudflare Worker: Gallery Upload & Serve
 * 
 * Handles image uploads to R2 and serves images from R2
 * R2 bucket is PRIVATE - all access goes through this worker
 * 
 * Routes:
 * - POST /upload - Upload image to R2
 * - GET /image/{path} - Serve image from R2
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
    // Verify JWT using JWKS (supports RS256 automatically)
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

// Handle image upload
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
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Generate unique photo ID
    const photoId = crypto.randomUUID();
    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const filename = `${photoId}.${extension}`;

    // Build storage path: galleries/{gallery_id}/{filename}
    // This path is used for both storage and serving via Image Resizing
    const storagePath = `galleries/${galleryId}/${filename}`;

    // Get file content as ArrayBuffer
    const fileBuffer = await file.arrayBuffer();

    // Upload to R2 (single file - Cloudflare Image Resizing handles thumbnails)
    await env.GALLERY_BUCKET.put(storagePath, fileBuffer, {
      httpMetadata: {
        contentType: file.type || 'image/jpeg',
      },
      customMetadata: {
        originalFilename,
        uploadedAt: new Date().toISOString(),
        userId: user.userId,
        galleryId,
      },
    });

    console.log(`Uploaded to R2: ${storagePath} (${fileBuffer.byteLength} bytes)`);

    // All paths point to the same file - Image Resizing applies width dynamically
    const previewPath = storagePath;
    const thumbPath = storagePath;

    // Save photo record to Supabase
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
      // Cleanup: delete the uploaded file
      await env.GALLERY_BUCKET.delete(storagePath);
      return new Response(
        JSON.stringify({ error: 'Erro ao salvar no banco de dados' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
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
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Upload error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Erro no upload',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
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
    // Get object from R2
    const object = await env.GALLERY_BUCKET.get(path);

    if (!object) {
      return new Response('Not found', {
        status: 404,
        headers: corsHeaders,
      });
    }

    // Return the image with caching headers
    const headers = new Headers(corsHeaders);
    headers.set('Content-Type', object.httpMetadata?.contentType || 'image/jpeg');
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    headers.set('ETag', object.etag);

    // Handle conditional requests
    const ifNoneMatch = request.headers.get('If-None-Match');
    if (ifNoneMatch === object.etag) {
      return new Response(null, { status: 304, headers });
    }

    return new Response(object.body, { headers });
  } catch (error) {
    console.error('Serve error:', error);
    return new Response('Internal server error', {
      status: 500,
      headers: corsHeaders,
    });
  }
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

    // Validate PNG
    if (!file.type.includes('png')) {
      return new Response(
        JSON.stringify({ error: 'Apenas arquivos PNG são permitidos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Max 2MB
    if (file.size > 2 * 1024 * 1024) {
      return new Response(
        JSON.stringify({ error: 'Arquivo muito grande (máximo 2MB)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build path: user-assets/{user_id}/watermark.png
    const watermarkPath = `user-assets/${user.userId}/watermark.png`;
    const fileBuffer = await file.arrayBuffer();

    // Upload to R2 (overwrites if exists)
    await env.GALLERY_BUCKET.put(watermarkPath, fileBuffer, {
      httpMetadata: {
        contentType: 'image/png',
      },
      customMetadata: {
        uploadedAt: new Date().toISOString(),
        userId: user.userId,
      },
    });

    console.log(`Watermark uploaded: ${watermarkPath} (${fileBuffer.byteLength} bytes)`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        path: watermarkPath,
        size: fileBuffer.byteLength,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Watermark upload error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Erro no upload da watermark' 
      }),
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

    // Route: POST /upload
    if (request.method === 'POST' && url.pathname === '/upload') {
      return handleUpload(request, env);
    }

    // Route: POST /upload-watermark
    if (request.method === 'POST' && url.pathname === '/upload-watermark') {
      return handleWatermarkUpload(request, env);
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
