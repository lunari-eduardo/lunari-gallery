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

// Global cache for B2 authorization (23 hour TTL)
// This dramatically reduces API calls to B2 under load
let cachedAuth: CachedB2Auth | null = null;
const CACHE_TTL_MS = 23 * 60 * 60 * 1000; // 23 hours

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

// Get cached B2 upload credentials or fetch new ones
async function getB2UploadCredentials(
  keyId: string,
  appKey: string,
  bucketId: string
): Promise<{ auth: B2AuthResponse; uploadUrl: B2UploadUrlResponse }> {
  const now = Date.now();

  // Return cached credentials if still valid
  if (cachedAuth && cachedAuth.expiresAt > now) {
    console.log("[b2-upload] Using cached B2 credentials");
    return { auth: cachedAuth.auth, uploadUrl: cachedAuth.uploadUrl };
  }

  // Fetch new credentials
  console.log("[b2-upload] Fetching new B2 credentials");
  const startTime = Date.now();

  const auth = await b2Authorize(keyId, appKey);
  const uploadUrl = await b2GetUploadUrl(auth.apiUrl, auth.authorizationToken, bucketId);

  console.log(`[b2-upload] B2 auth completed in ${Date.now() - startTime}ms`);

  // Cache the credentials
  cachedAuth = {
    auth,
    uploadUrl,
    expiresAt: now + CACHE_TTL_MS,
  };

  return { auth, uploadUrl };
}

// Upload file to B2 with retry logic
async function b2UploadFile(
  uploadUrl: string,
  authToken: string,
  fileName: string,
  fileData: ArrayBuffer,
  contentType: string,
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
          console.log(`[b2-upload] Upload URL expired (${response.status}), invalidating cache`);
          cachedAuth = null;
          throw new Error(`B2 upload failed (${response.status}): ${error}`);
        }
        
        throw new Error(`B2 upload failed: ${error}`);
      }

      return response.json();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt <= maxRetries) {
        const delay = Math.pow(2, attempt - 1) * 500; // 500ms, 1000ms
        console.log(`[b2-upload] Upload attempt ${attempt} failed, retrying in ${delay}ms: ${lastError.message}`);
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
    console.log(`[b2-upload][${requestId}] Request started`);

    // Get auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.log(`[b2-upload][${requestId}] Missing authorization header`);
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
      console.log(`[b2-upload][${requestId}] Auth validation failed:`, authError?.message);
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[b2-upload][${requestId}] User authenticated: ${user.id}`);

    // Parse form data
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const galleryId = formData.get("galleryId") as string;
    const originalFilename = formData.get("originalFilename") as string;
    const width = parseInt(formData.get("width") as string) || 0;
    const height = parseInt(formData.get("height") as string) || 0;

    if (!file || !galleryId) {
      console.log(`[b2-upload][${requestId}] Missing required fields: file=${!!file}, galleryId=${!!galleryId}`);
      return new Response(JSON.stringify({ error: "Arquivo e galleryId são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[b2-upload][${requestId}] Processing: galleryId=${galleryId}, file=${file.name}, size=${file.size}`);

    // Verify gallery belongs to user
    const { data: gallery, error: galleryError } = await supabase
      .from("galerias")
      .select("id, user_id")
      .eq("id", galleryId)
      .single();

    if (galleryError || !gallery || gallery.user_id !== user.id) {
      console.log(`[b2-upload][${requestId}] Gallery access denied: error=${galleryError?.message}, match=${gallery?.user_id === user.id}`);
      return new Response(JSON.stringify({ error: "Galeria não encontrada ou sem permissão" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get B2 credentials
    const b2KeyId = Deno.env.get("B2_APPLICATION_KEY_ID");
    const b2AppKey = Deno.env.get("B2_APPLICATION_KEY");
    const b2BucketId = Deno.env.get("B2_BUCKET_ID");

    if (!b2KeyId || !b2AppKey || !b2BucketId) {
      console.error(`[b2-upload][${requestId}] B2 credentials not configured`);
      return new Response(JSON.stringify({ error: "Configuração de storage incompleta" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get cached or new B2 upload credentials
    const { uploadUrl: uploadUrlData } = await getB2UploadCredentials(b2KeyId, b2AppKey, b2BucketId);

    // Generate unique filename
    const timestamp = Date.now();
    const randomId = crypto.randomUUID().slice(0, 8);
    const extension = file.name.split(".").pop() || "jpg";
    const filename = `${timestamp}-${randomId}.${extension}`;
    const storagePath = `galleries/${galleryId}/${filename}`;

    // Read file data
    const fileData = await file.arrayBuffer();

    console.log(`[b2-upload][${requestId}] Uploading to B2: ${storagePath}, ${fileData.byteLength} bytes`);

    // Upload to B2 with retry logic
    const uploadResult = await b2UploadFile(
      uploadUrlData.uploadUrl,
      uploadUrlData.authorizationToken,
      storagePath,
      fileData,
      file.type || "image/jpeg"
    );

    console.log(`[b2-upload][${requestId}] B2 upload complete: ${uploadResult.fileId}`);

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
      console.error(`[b2-upload][${requestId}] Error saving photo metadata:`, insertError);
      return new Response(JSON.stringify({ error: "Erro ao salvar metadados" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[b2-upload][${requestId}] Photo saved: ${photo.id}`);

    // Update gallery photo count atomically via RPC
    const { error: rpcError } = await supabase.rpc('increment_gallery_photo_count', {
      gallery_id: galleryId,
    });

    if (rpcError) {
      console.warn(`[b2-upload][${requestId}] Failed to increment photo count (non-critical):`, rpcError.message);
      // Non-critical error - don't fail the upload
    }

    const duration = Date.now() - startTime;
    console.log(`[b2-upload][${requestId}] Complete in ${duration}ms`);

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
    console.error(`[b2-upload][${requestId}] Error after ${duration}ms:`, error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
