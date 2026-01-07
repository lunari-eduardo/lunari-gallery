import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UploadRequest {
  galleryId: string;
  filename: string;
  contentType: string;
  fileSize: number;
  width: number;
  height: number;
}

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

    // Parse request body
    const body: UploadRequest = await req.json();
    const { galleryId, filename, contentType, fileSize, width, height } = body;

    // Validate content type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(contentType)) {
      return new Response(
        JSON.stringify({ error: "Invalid file type. Allowed: JPG, PNG, WEBP" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate file size (max 5MB after compression)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (fileSize > maxSize) {
      return new Response(
        JSON.stringify({ error: "File too large. Maximum 5MB allowed" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate dimensions (max 1920px)
    if (width > 1920 || height > 1920) {
      return new Response(
        JSON.stringify({ error: "Dimensions too large. Maximum 1920px allowed" }),
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

    // Authorize with B2 and get upload URL
    const b2Auth = await authorizeB2();
    const uploadUrlData = await getB2UploadUrl(b2Auth);

    // Return upload URL and metadata
    return new Response(
      JSON.stringify({
        uploadUrl: uploadUrlData.uploadUrl,
        authorizationToken: uploadUrlData.authorizationToken,
        storageKey,
        photoId,
        bucketName: Deno.env.get("B2_BUCKET_NAME"),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error in get-upload-url:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
