import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

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

// B2 Authorization - returns the dynamic downloadUrl
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

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authorize with B2 to get the dynamic downloadUrl
    const b2Auth = await authorizeB2();
    
    const bucketName = Deno.env.get("B2_BUCKET_NAME") || "lunari-gallery";
    
    // Build the full bucket URL using the dynamic downloadUrl
    // Format: {downloadUrl}/file/{bucketName}
    const fullBucketUrl = `${b2Auth.downloadUrl}/file/${bucketName}`;
    
    console.log("B2 Config resolved:", {
      downloadUrl: b2Auth.downloadUrl,
      bucketName,
      fullBucketUrl,
    });

    return new Response(
      JSON.stringify({
        downloadUrl: b2Auth.downloadUrl,
        bucketName,
        fullBucketUrl,
      }),
      { 
        status: 200, 
        headers: { 
          ...corsHeaders, 
          "Content-Type": "application/json",
          // Cache for 1 hour - downloadUrl is stable
          "Cache-Control": "public, max-age=3600",
        } 
      }
    );

  } catch (error: unknown) {
    console.error("Error in get-b2-config:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
