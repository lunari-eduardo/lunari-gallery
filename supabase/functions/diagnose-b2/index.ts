import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const keyId = Deno.env.get("B2_APPLICATION_KEY_ID");
    const appKey = Deno.env.get("B2_APPLICATION_KEY");
    const bucketId = Deno.env.get("B2_BUCKET_ID");
    const bucketName = Deno.env.get("B2_BUCKET_NAME");

    // Check if secrets are configured
    if (!keyId || !appKey) {
      return new Response(
        JSON.stringify({
          status: "error",
          message: "B2 credentials not configured",
          hasKeyId: !!keyId,
          hasAppKey: !!appKey,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Authorize with B2 to get real download URL
    const credentials = btoa(`${keyId}:${appKey}`);
    const response = await fetch("https://api.backblazeb2.com/b2api/v2/b2_authorize_account", {
      method: "GET",
      headers: { Authorization: `Basic ${credentials}` },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(
        JSON.stringify({
          status: "error",
          message: "B2 authorization failed",
          httpStatus: response.status,
          error: errorText,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authData = await response.json();
    const expectedFrontendUrl = "https://f002.backblazeb2.com";
    const realDownloadUrl = authData.downloadUrl;
    const urlMatch = realDownloadUrl === expectedFrontendUrl;

    return new Response(
      JSON.stringify({
        status: "ok",
        downloadUrl: realDownloadUrl,
        bucketId,
        bucketName,
        expectedFrontendUrl,
        urlMatch,
        fullBucketUrl: `${realDownloadUrl}/file/${bucketName}`,
        recommendation: urlMatch 
          ? "URLs match - problem may be bucket visibility or file existence"
          : `UPDATE B2_BUCKET_URL to: ${realDownloadUrl}/file/${bucketName}`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ status: "error", message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
