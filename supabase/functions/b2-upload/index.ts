import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface B2AuthResponse {
  authorizationToken: string;
  apiUrl: string;
  downloadUrl: string;
}

interface B2UploadUrlResponse {
  uploadUrl: string;
  authorizationToken: string;
}

interface B2UploadResponse {
  fileId: string;
  fileName: string;
  contentLength: number;
  contentSha1: string;
  contentType: string;
}

interface CachedB2Auth {
  auth: B2AuthResponse;
  uploadUrl: B2UploadUrlResponse;
  expiresAt: number;
}

// In-memory cache (fast but lost on cold start)
let cachedAuth: CachedB2Auth | null = null;
const CACHE_TTL_MS = 23 * 60 * 60 * 1000; // 23 hours
const CACHE_KEY = "b2_auth_credentials";

// Authorize with B2
async function b2Authorize(keyId: string, appKey: string): Promise<B2AuthResponse> {
  const credentials = btoa(`${keyId}:${appKey}`);
  const response = await fetch("https://api.backblazeb2.com/b2api/v2/b2_authorize_account", {
    method: "GET",
    headers: {
      Authorization: `Basic ${credentials}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`B2 auth failed: ${error}`);
  }

  return response.json();
}

// Get upload URL
async function b2GetUploadUrl(apiUrl: string, authToken: string, bucketId: string): Promise<B2UploadUrlResponse> {
  const response = await fetch(`${apiUrl}/b2api/v2/b2_get_upload_url`, {
    method: "POST",
    headers: {
      Authorization: authToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ bucketId }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`B2 get upload URL failed: ${error}`);
  }

  return response.json();
}

// Get B2 upload credentials with PERSISTENT caching (Supabase table)
async function getB2UploadCredentials(
  supabaseAdmin: any,
  keyId: string,
  appKey: string,
  bucketId: string,
  requestId: string
): Promise<{ auth: B2AuthResponse; uploadUrl: B2UploadUrlResponse }> {
  const now = Date.now();

  // 1. Check memory cache first (fastest path)
  if (cachedAuth && cachedAuth.expiresAt > now) {
    console.log(`[${requestId}] Using memory cached B2 credentials`);
    return { auth: cachedAuth.auth, uploadUrl: cachedAuth.uploadUrl };
  }

  // 2. Check persistent cache (survives cold starts)
  try {
    const { data: dbCache } = await supabaseAdmin
      .from("system_cache")
      .select("value, expires_at")
      .eq("key", CACHE_KEY)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (dbCache?.value) {
      const cached = dbCache.value as { auth: B2AuthResponse; uploadUrl: B2UploadUrlResponse };
      console.log(`[${requestId}] Using persistent cached B2 credentials`);
      
      // Update memory cache
      cachedAuth = {
        ...cached,
        expiresAt: new Date(dbCache.expires_at as string).getTime(),
      };
      
      return cached;
    }
  } catch {
    // No cache found, continue to fetch fresh
  }

  // 3. Fetch fresh credentials
  console.log(`[${requestId}] Fetching fresh B2 credentials...`);
  const authStart = Date.now();
  
  const auth = await b2Authorize(keyId, appKey);
  const uploadUrl = await b2GetUploadUrl(auth.apiUrl, auth.authorizationToken, bucketId);
  
  console.log(`[${requestId}] B2 auth completed in ${Date.now() - authStart}ms`);

  const expiresAt = new Date(now + CACHE_TTL_MS).toISOString();

  // 4. Save to persistent cache
  try {
    await supabaseAdmin
      .from("system_cache")
      .upsert({
        key: CACHE_KEY,
        value: { auth, uploadUrl },
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      });
    console.log(`[${requestId}] B2 credentials persisted for 23 hours`);
  } catch (err) {
    console.warn(`[${requestId}] Failed to persist B2 cache:`, err);
  }

  // 5. Update memory cache
  cachedAuth = {
    auth,
    uploadUrl,
    expiresAt: now + CACHE_TTL_MS,
  };

  return { auth, uploadUrl };
}

// Invalidate cache (called when B2 returns 401/503)
async function invalidateB2Cache(
  supabaseAdmin: any,
  requestId: string
): Promise<void> {
  cachedAuth = null;
  try {
    await supabaseAdmin
      .from("system_cache")
      .delete()
      .eq("key", CACHE_KEY);
    console.log(`[${requestId}] B2 cache invalidated`);
  } catch (err) {
    console.warn(`[${requestId}] Failed to invalidate B2 cache:`, err);
  }
}

// Upload file to B2 with retry logic
async function b2UploadFile(
  supabaseAdmin: any,
  uploadUrl: string,
  authToken: string,
  fileName: string,
  fileData: ArrayBuffer,
  contentType: string,
  requestId: string,
  maxRetries: number = 2
): Promise<B2UploadResponse> {
  // Calculate SHA1 hash
  const hashBuffer = await crypto.subtle.digest("SHA-1", fileData);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const sha1 = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          Authorization: authToken,
          "Content-Type": contentType,
          "Content-Length": fileData.byteLength.toString(),
          "X-Bz-File-Name": encodeURIComponent(fileName),
          "X-Bz-Content-Sha1": sha1,
        },
        body: fileData,
      });

      if (!response.ok) {
        const error = await response.text();
        
        // If upload URL expired (401/503), invalidate cache and retry
        if (response.status === 401 || response.status === 503) {
          console.log(`[${requestId}] Upload URL expired (${response.status}), invalidating cache`);
          await invalidateB2Cache(supabaseAdmin, requestId);
          throw new Error(`B2 upload failed (${response.status}): ${error}`);
        }
        
        throw new Error(`B2 upload failed: ${error}`);
      }

      return response.json();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt <= maxRetries) {
        const delay = Math.pow(2, attempt - 1) * 500; // 500ms, 1000ms
        console.log(`[${requestId}] Upload attempt ${attempt} failed, retrying in ${delay}ms: ${lastError.message}`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  throw lastError || new Error("B2 upload failed after retries");
}

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  const startTime = Date.now();
  
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log(`[${requestId}] Upload request started`);

    // Get auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.log(`[${requestId}] Missing authorization header`);
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate user with Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.log(`[${requestId}] Auth validation failed:`, authError?.message);
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[${requestId}] User: ${user.id.slice(0, 8)}`);

    // Parse form data
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const galleryId = formData.get("galleryId") as string;
    const originalFilename = formData.get("originalFilename") as string;
    const width = parseInt(formData.get("width") as string) || 0;
    const height = parseInt(formData.get("height") as string) || 0;

    if (!file || !galleryId) {
      console.log(`[${requestId}] Missing required fields`);
      return new Response(JSON.stringify({ error: "Arquivo e galleryId são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[${requestId}] File: ${file.name} (${(file.size / 1024).toFixed(0)}KB)`);

    // Verify gallery belongs to user
    const { data: gallery, error: galleryError } = await supabase
      .from("galerias")
      .select("id, user_id")
      .eq("id", galleryId)
      .single();

    if (galleryError || !gallery || gallery.user_id !== user.id) {
      console.log(`[${requestId}] Gallery access denied`);
      return new Response(JSON.stringify({ error: "Galeria não encontrada ou sem permissão" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user is admin (bypass credit check)
    const { data: isAdmin } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });

    if (!isAdmin) {
      // Try to consume 1 credit atomically
      const { data: creditConsumed, error: creditError } = await supabase.rpc(
        'consume_photo_credits',
        {
          _user_id: user.id,
          _gallery_id: galleryId,
          _photo_count: 1
        }
      );

      if (creditError) {
        console.error(`[${requestId}] Credit check error:`, creditError);
        return new Response(
          JSON.stringify({ 
            error: 'Erro ao verificar créditos',
            code: 'CREDIT_CHECK_ERROR'
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!creditConsumed) {
        console.log(`[${requestId}] Insufficient credits for user ${user.id}`);
        return new Response(
          JSON.stringify({ 
            error: 'Créditos insuficientes. Compre mais créditos para continuar.',
            code: 'INSUFFICIENT_CREDITS'
          }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[${requestId}] Credit consumed for user ${user.id}`);
    } else {
      console.log(`[${requestId}] Admin bypass - no credit consumed`);
    }

    // Get B2 credentials
    const b2KeyId = Deno.env.get("B2_APPLICATION_KEY_ID");
    const b2AppKey = Deno.env.get("B2_APPLICATION_KEY");
    const b2BucketId = Deno.env.get("B2_BUCKET_ID");

    if (!b2KeyId || !b2AppKey || !b2BucketId) {
      console.error(`[${requestId}] B2 credentials not configured`);
      return new Response(JSON.stringify({ error: "Configuração de storage incompleta" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get B2 credentials (with persistent caching)
    const { uploadUrl: uploadUrlData } = await getB2UploadCredentials(
      supabase,
      b2KeyId,
      b2AppKey,
      b2BucketId,
      requestId
    );

    // Generate unique filename
    const timestamp = Date.now();
    const randomId = crypto.randomUUID().slice(0, 8);
    const extension = file.name.split(".").pop() || "jpg";
    const filename = `${timestamp}-${randomId}.${extension}`;
    const storagePath = `galleries/${galleryId}/${filename}`;

    // Read file data
    const fileData = await file.arrayBuffer();

    console.log(`[${requestId}] Uploading to B2: ${storagePath}`);

    // Upload to B2 with retry logic
    const uploadResult = await b2UploadFile(
      supabase,
      uploadUrlData.uploadUrl,
      uploadUrlData.authorizationToken,
      storagePath,
      fileData,
      file.type || "image/jpeg",
      requestId
    );

    const uploadDuration = Date.now() - startTime;
    console.log(`[${requestId}] B2 upload complete in ${uploadDuration}ms: ${uploadResult.fileId}`);

    // Save metadata to Supabase
    const { data: photo, error: insertError } = await supabase
      .from("galeria_fotos")
      .insert({
        galeria_id: galleryId,
        user_id: user.id,
        filename: filename,
        original_filename: originalFilename || file.name,
        storage_key: storagePath,
        file_size: fileData.byteLength,
        mime_type: file.type || "image/jpeg",
        width: width,
        height: height,
        is_selected: false,
        order_index: 0,
      })
      .select()
      .single();

    if (insertError) {
      console.error(`[${requestId}] Error saving photo metadata:`, insertError);
      return new Response(JSON.stringify({ error: "Erro ao salvar metadados" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[${requestId}] Photo saved: ${photo.id}`);

    // Update gallery photo count atomically via RPC
    const { error: rpcError } = await supabase.rpc('increment_gallery_photo_count', {
      gallery_id: galleryId,
    });

    if (rpcError) {
      console.warn(`[${requestId}] Failed to increment photo count:`, rpcError.message);
      // Non-critical error - don't fail the upload
    }

    // Record credit usage in ledger (non-blocking, for audit trail)
    if (!isAdmin) {
      supabase.rpc('record_photo_credit_usage', {
        _user_id: user.id,
        _gallery_id: galleryId,
        _photo_id: photo.id,
        _description: `Upload: ${file.name}`
      }).then(({ error: ledgerError }) => {
        if (ledgerError) {
          console.warn(`[${requestId}] Failed to record credit usage:`, ledgerError.message);
        }
      });
    }

    const totalDuration = Date.now() - startTime;
    console.log(`[${requestId}] ✓ Complete in ${totalDuration}ms (upload: ${uploadDuration}ms)`);

    return new Response(
      JSON.stringify({
        success: true,
        photo: {
          id: photo.id,
          filename: photo.filename,
          originalFilename: photo.original_filename,
          storageKey: photo.storage_key,
          fileSize: photo.file_size,
          mimeType: photo.mime_type,
          width: photo.width,
          height: photo.height,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[${requestId}] ✗ Error after ${duration}ms:`, error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
