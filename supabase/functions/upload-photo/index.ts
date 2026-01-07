import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface B2AuthResponse {
  authorizationToken: string;
  apiUrl: string;
  downloadUrl: string;
  allowed: {
    bucketId: string;
    bucketName: string;
  };
}

interface B2UploadUrlResponse {
  uploadUrl: string;
  authorizationToken: string;
}

// B2 Authorization
async function authorizeB2(): Promise<B2AuthResponse> {
  const keyId = Deno.env.get("B2_APPLICATION_KEY_ID");
  const appKey = Deno.env.get("B2_APPLICATION_KEY");
  
  if (!keyId || !appKey) {
    throw new Error("B2 credentials not configured");
  }

  const credentials = btoa(`${keyId}:${appKey}`);
  
  const response = await fetch("https://api.backblazeb2.com/b2api/v2/b2_authorize_account", {
    method: "GET",
    headers: {
      Authorization: `Basic ${credentials}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`B2 authorization failed: ${error}`);
  }

  return await response.json();
}

// Get B2 Upload URL
async function getB2UploadUrl(auth: B2AuthResponse): Promise<B2UploadUrlResponse> {
  const bucketId = Deno.env.get("B2_BUCKET_ID");
  
  if (!bucketId) {
    throw new Error("B2_BUCKET_ID not configured");
  }

  const response = await fetch(`${auth.apiUrl}/b2api/v2/b2_get_upload_url`, {
    method: "POST",
    headers: {
      Authorization: auth.authorizationToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ bucketId }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get B2 upload URL: ${error}`);
  }

  return await response.json();
}

// Calculate SHA1 hash
async function calculateSHA1(data: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-1", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse FormData
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const galleryId = formData.get("galleryId") as string | null;
    const originalFilename = formData.get("originalFilename") as string | null;
    const width = parseInt(formData.get("width") as string || "0", 10);
    const height = parseInt(formData.get("height") as string || "0", 10);

    if (!file || !galleryId || !originalFilename) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: file, galleryId, originalFilename" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate content type
    const contentType = file.type;
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(contentType)) {
      return new Response(
        JSON.stringify({ error: "Invalid file type. Allowed: JPG, PNG, WEBP" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate file size (max 5MB after compression)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return new Response(
        JSON.stringify({ error: "File too large. Maximum 5MB allowed" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify gallery exists and belongs to user
    const { data: gallery, error: galleryError } = await supabase
      .from("galerias")
      .select("id, user_id")
      .eq("id", galleryId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (galleryError || !gallery) {
      return new Response(
        JSON.stringify({ error: "Gallery not found or access denied" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate unique photo ID and storage key
    const photoId = crypto.randomUUID();
    const extension = contentType.split("/")[1] === "jpeg" ? "jpg" : contentType.split("/")[1];
    const storageKey = `${user.id}/${galleryId}/${photoId}.${extension}`;
    const filename = `${photoId}.${extension}`;

    // Read file as ArrayBuffer
    const fileBuffer = await file.arrayBuffer();
    const fileBytes = new Uint8Array(fileBuffer);

    // Calculate SHA1 hash
    const sha1Hash = await calculateSHA1(fileBuffer);

    // Authorize with B2 and get upload URL
    console.log("Authorizing with B2...");
    const b2Auth = await authorizeB2();
    
    console.log("Getting upload URL...");
    const uploadUrlData = await getB2UploadUrl(b2Auth);

    // Upload file to B2
    console.log(`Uploading file to B2: ${storageKey} (${file.size} bytes)`);
    const uploadResponse = await fetch(uploadUrlData.uploadUrl, {
      method: "POST",
      headers: {
        Authorization: uploadUrlData.authorizationToken,
        "Content-Type": contentType,
        "Content-Length": file.size.toString(),
        "X-Bz-File-Name": encodeURIComponent(storageKey),
        "X-Bz-Content-Sha1": sha1Hash,
      },
      body: fileBytes,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error("B2 upload failed:", errorText);
      throw new Error(`B2 upload failed: ${errorText}`);
    }

    const b2Result = await uploadResponse.json();
    console.log("B2 upload successful:", b2Result.fileId);

    // Save photo metadata to database
    const { data: photo, error: photoError } = await supabase
      .from("galeria_fotos")
      .insert({
        id: photoId,
        galeria_id: galleryId,
        user_id: user.id,
        filename: filename,
        original_filename: originalFilename,
        storage_key: storageKey,
        file_size: file.size,
        width: width || null,
        height: height || null,
        mime_type: contentType,
        is_selected: false,
      })
      .select()
      .single();

    if (photoError) {
      console.error("Failed to save photo metadata:", photoError);
      throw new Error(`Failed to save photo metadata: ${photoError.message}`);
    }

    console.log("Photo saved successfully:", photo.id);

    // Return success
    return new Response(
      JSON.stringify({
        success: true,
        photo: {
          id: photo.id,
          storageKey: photo.storage_key,
          filename: photo.filename,
          originalFilename: photo.original_filename,
          fileSize: photo.file_size,
          width: photo.width,
          height: photo.height,
          mimeType: photo.mime_type,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error in upload-photo:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
