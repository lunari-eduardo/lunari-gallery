import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DeleteRequest {
  galleryId: string;
  photoIds: string[];
}

interface B2AuthResponse {
  authorizationToken: string;
  apiUrl: string;
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

// Delete file from B2
async function deleteB2File(auth: B2AuthResponse, fileName: string, fileId: string): Promise<boolean> {
  try {
    const response = await fetch(`${auth.apiUrl}/b2api/v2/b2_delete_file_version`, {
      method: "POST",
      headers: {
        Authorization: auth.authorizationToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fileName, fileId }),
    });

    return response.ok;
  } catch (error) {
    console.error(`Failed to delete B2 file ${fileName}:`, error);
    return false;
  }
}

// Get file info from B2 by name
async function getB2FileInfo(auth: B2AuthResponse, bucketId: string, fileName: string): Promise<{ fileId: string } | null> {
  try {
    const response = await fetch(`${auth.apiUrl}/b2api/v2/b2_list_file_names`, {
      method: "POST",
      headers: {
        Authorization: auth.authorizationToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        bucketId,
        prefix: fileName,
        maxFileCount: 1,
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (data.files && data.files.length > 0) {
      return { fileId: data.files[0].fileId };
    }
    return null;
  } catch (error) {
    console.error(`Failed to get B2 file info for ${fileName}:`, error);
    return null;
  }
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
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    // Use anon key for user auth check
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    
    // Use service role for database operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get user
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body: DeleteRequest = await req.json();
    const { galleryId, photoIds } = body;

    if (!galleryId || !photoIds || photoIds.length === 0) {
      return new Response(
        JSON.stringify({ error: "Missing galleryId or photoIds" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify gallery exists and belongs to user
    const { data: gallery, error: galleryError } = await supabaseAuth
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

    // Get photos to delete
    const { data: photos, error: photosError } = await supabaseAdmin
      .from("galeria_fotos")
      .select("id, storage_key")
      .eq("galeria_id", galleryId)
      .eq("user_id", user.id)
      .in("id", photoIds);

    if (photosError || !photos || photos.length === 0) {
      return new Response(
        JSON.stringify({ error: "No photos found to delete" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Authorize with B2
    const bucketId = Deno.env.get("B2_BUCKET_ID");
    let b2Auth: B2AuthResponse | null = null;
    
    if (bucketId) {
      try {
        b2Auth = await authorizeB2();
      } catch (error) {
        console.error("B2 auth failed, will skip B2 deletion:", error);
      }
    }

    // Delete from B2 (if authorized)
    const deletedFromB2: string[] = [];
    if (b2Auth && bucketId) {
      for (const photo of photos) {
        const fileInfo = await getB2FileInfo(b2Auth, bucketId, photo.storage_key);
        if (fileInfo) {
          const deleted = await deleteB2File(b2Auth, photo.storage_key, fileInfo.fileId);
          if (deleted) {
            deletedFromB2.push(photo.id);
          }
        }
      }
    }

    // Delete from database
    const { error: deleteError } = await supabaseAdmin
      .from("galeria_fotos")
      .delete()
      .eq("galeria_id", galleryId)
      .eq("user_id", user.id)
      .in("id", photoIds);

    if (deleteError) {
      return new Response(
        JSON.stringify({ error: "Failed to delete photos from database" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        deletedCount: photos.length,
        deletedFromB2: deletedFromB2.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error in delete-photos:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
