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

// Upload file to B2
async function b2UploadFile(
  uploadUrl: string,
  authToken: string,
  fileName: string,
  fileData: ArrayBuffer,
  contentType: string
): Promise<B2UploadResponse> {
  // Calculate SHA1 hash
  const hashBuffer = await crypto.subtle.digest("SHA-1", fileData);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const sha1 = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

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
    throw new Error(`B2 upload failed: ${error}`);
  }

  return response.json();
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
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
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse form data
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const galleryId = formData.get("galleryId") as string;
    const originalFilename = formData.get("originalFilename") as string;
    const width = parseInt(formData.get("width") as string) || 0;
    const height = parseInt(formData.get("height") as string) || 0;

    if (!file || !galleryId) {
      return new Response(JSON.stringify({ error: "Arquivo e galleryId são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify gallery belongs to user
    const { data: gallery, error: galleryError } = await supabase
      .from("galerias")
      .select("id, user_id")
      .eq("id", galleryId)
      .single();

    if (galleryError || !gallery || gallery.user_id !== user.id) {
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
      console.error("B2 credentials not configured");
      return new Response(JSON.stringify({ error: "Configuração de storage incompleta" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Authorize with B2
    const b2Auth = await b2Authorize(b2KeyId, b2AppKey);

    // Get upload URL
    const uploadUrlData = await b2GetUploadUrl(b2Auth.apiUrl, b2Auth.authorizationToken, b2BucketId);

    // Generate unique filename
    const timestamp = Date.now();
    const randomId = crypto.randomUUID().slice(0, 8);
    const extension = file.name.split(".").pop() || "jpg";
    const filename = `${timestamp}-${randomId}.${extension}`;
    const storagePath = `galleries/${galleryId}/${filename}`;

    // Read file data
    const fileData = await file.arrayBuffer();

    // Upload to B2
    const uploadResult = await b2UploadFile(
      uploadUrlData.uploadUrl,
      uploadUrlData.authorizationToken,
      storagePath,
      fileData,
      file.type || "image/jpeg"
    );

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
      console.error("Error saving photo metadata:", insertError);
      return new Response(JSON.stringify({ error: "Erro ao salvar metadados" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update gallery photo count - get current count and increment
    const { data: currentGallery } = await supabase
      .from("galerias")
      .select("total_fotos")
      .eq("id", galleryId)
      .single();
    
    const currentCount = currentGallery?.total_fotos || 0;
    await supabase
      .from("galerias")
      .update({ total_fotos: currentCount + 1 })
      .eq("id", galleryId);

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
    console.error("Upload error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
