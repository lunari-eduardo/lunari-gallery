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
 * Authentication: JWT validated locally using SUPABASE_JWT_SECRET
 */

import * as jose from 'jose';

export interface Env {
  // R2 Bucket binding (configured in wrangler.toml)
  GALLERY_BUCKET: R2Bucket;
  // Supabase config
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_JWT_SECRET: string;
}

// CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
};

/**
 * Decode a base64 string to Uint8Array
 * Works with both standard base64 and base64url
 */
function base64ToUint8Array(base64: string): Uint8Array {
  // Handle base64url format (replace - with + and _ with /)
  const normalizedBase64 = base64
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  
  // Decode base64 to binary string
  const binaryString = atob(normalizedBase64);
  
  // Convert to Uint8Array
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  return bytes;
}

/**
 * Check if a string appears to be base64 encoded
 */
function isBase64(str: string): boolean {
  // Check for base64 patterns: ends with = or ==, or has valid base64 chars only
  const base64Regex = /^[A-Za-z0-9+/]+=*$/;
  return str.length > 20 && base64Regex.test(str);
}

// Validate Supabase JWT - com suporte a Base64 JWT Secret
async function validateAuth(
  request: Request,
  env: Env
): Promise<{ userId: string; email: string } | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    console.log('Auth failed: No Authorization header');
    return null;
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    // Determine if secret is base64 encoded
    const rawSecret = env.SUPABASE_JWT_SECRET;
    let secret: Uint8Array;
    
    if (isBase64(rawSecret)) {
      // Decode base64 to bytes
      console.log('Using Base64-decoded JWT secret');
      secret = base64ToUint8Array(rawSecret);
    } else {
      // Use as plain text (fallback)
      console.log('Using plain text JWT secret');
      secret = new TextEncoder().encode(rawSecret);
    }
    
    // Verify JWT with explicit HS256 algorithm
    const { payload } = await jose.jwtVerify(token, secret, {
      algorithms: ['HS256'],
    });

    const userId = payload.sub;
    const email = payload.email as string;

    if (!userId) {
      console.log('Auth failed: No sub claim in JWT');
      return null;
    }

    console.log(`Auth OK: user=${userId}, iss=${payload.iss}`);
    return { userId, email: email || '' };
  } catch (error) {
    console.error('JWT validation error:', {
      error: error instanceof Error ? error.message : String(error),
      errorName: error instanceof Error ? error.name : 'Unknown',
      tokenLength: token.length,
      secretLength: env.SUPABASE_JWT_SECRET?.length || 0,
    });
    return null;
  }
}

// Handle image upload
async function handleUpload(
  request: Request,
  env: Env
): Promise<Response> {
  const user = await validateAuth(request, env);
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

    // Build storage path: /{user_id}/{gallery_id}/original/{photo_id}.jpg
    const basePath = `${user.userId}/${galleryId}`;
    const originalPath = `${basePath}/original/${filename}`;

    // Get file content as ArrayBuffer
    const fileBuffer = await file.arrayBuffer();

    // Upload original to R2
    await env.GALLERY_BUCKET.put(originalPath, fileBuffer, {
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

    console.log(`Uploaded: ${originalPath} (${fileBuffer.byteLength} bytes)`);

    // For Phase 1.2, we return the same path for all versions
    // In Phase 3.5, we'll generate actual thumbnails and previews
    const previewPath = originalPath;
    const thumbPath = originalPath;

    // Save photo record to Supabase
    const photoRecord = {
      galeria_id: galleryId,
      user_id: user.userId,
      filename,
      original_filename: originalFilename,
      storage_key: originalPath,
      original_path: originalPath,
      preview_path: previewPath,
      thumb_path: thumbPath,
      file_size: fileBuffer.byteLength,
      mime_type: file.type || 'image/jpeg',
      width,
      height,
      has_watermark: false,
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
      await env.GALLERY_BUCKET.delete(originalPath);
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
          storageKey: originalPath,
          originalPath,
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
  const user = await validateAuth(request, env);
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
