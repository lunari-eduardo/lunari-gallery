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

// Helper functions for AWS Signature V4 (R2 S3-compatible)
async function sha256Hex(data: ArrayBuffer | Uint8Array | string): Promise<string> {
  const buffer = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function hmac(key: ArrayBuffer, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data));
}

async function hmacHex(key: ArrayBuffer, data: string): Promise<string> {
  const sig = await hmac(key, data);
  return Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function getSignatureKey(
  key: string, dateStamp: string, region: string, service: string
): Promise<ArrayBuffer> {
  const kDate = await hmac(new TextEncoder().encode('AWS4' + key), dateStamp);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, service);
  return hmac(kService, 'aws4_request');
}

// Delete a file from R2 using S3-compatible DELETE
async function deleteFromR2(
  accountId: string,
  accessKeyId: string,
  secretAccessKey: string,
  bucketName: string,
  key: string
): Promise<boolean> {
  try {
    const host = `${accountId}.r2.cloudflarestorage.com`;
    const date = new Date();
    const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);
    const region = 'auto';
    const service = 's3';

    const canonicalUri = `/${bucketName}/${key}`;
    const payloadHash = await sha256Hex('');

    const canonicalHeaders = [
      `host:${host}`,
      `x-amz-content-sha256:${payloadHash}`,
      `x-amz-date:${amzDate}`,
    ].join('\n') + '\n';

    const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';

    const canonicalRequest = [
      'DELETE', canonicalUri, '', canonicalHeaders, signedHeaders, payloadHash,
    ].join('\n');

    const algorithm = 'AWS4-HMAC-SHA256';
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const canonicalRequestHash = await sha256Hex(canonicalRequest);
    const stringToSign = [algorithm, amzDate, credentialScope, canonicalRequestHash].join('\n');

    const signingKey = await getSignatureKey(secretAccessKey, dateStamp, region, service);
    const signature = await hmacHex(signingKey, stringToSign);

    const authorization = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const response = await fetch(`https://${host}${canonicalUri}`, {
      method: 'DELETE',
      headers: {
        'x-amz-content-sha256': payloadHash,
        'x-amz-date': amzDate,
        'Authorization': authorization,
      },
    });

    return response.ok || response.status === 204;
  } catch (error) {
    console.error(`Failed to delete R2 file ${key}:`, error);
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: DeleteRequest = await req.json();
    const { galleryId, photoIds } = body;

    if (!galleryId || !photoIds || photoIds.length === 0) {
      return new Response(
        JSON.stringify({ error: "Missing galleryId or photoIds" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify gallery belongs to user
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

    // Get photos to delete (all path fields for complete R2 cleanup)
    const { data: photos, error: photosError } = await supabaseAdmin
      .from("galeria_fotos")
      .select("id, storage_key, original_path, preview_path, preview_wm_path, thumb_path")
      .eq("galeria_id", galleryId)
      .eq("user_id", user.id)
      .in("id", photoIds);

    if (photosError || !photos || photos.length === 0) {
      return new Response(
        JSON.stringify({ error: "No photos found to delete" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Delete ALL paths from R2 (deduplicated)
    const r2AccountId = Deno.env.get("R2_ACCOUNT_ID");
    const r2AccessKeyId = Deno.env.get("R2_ACCESS_KEY_ID");
    const r2SecretKey = Deno.env.get("R2_SECRET_ACCESS_KEY");
    const r2BucketName = "lunari-previews";

    let deletedFromStorage = 0;
    if (r2AccountId && r2AccessKeyId && r2SecretKey) {
      for (const photo of photos) {
        // Collect all unique paths for this photo
        const paths = new Set<string>();
        const pathFields = ['storage_key', 'original_path', 'preview_path', 'preview_wm_path', 'thumb_path'] as const;
        for (const field of pathFields) {
          const val = (photo as any)[field];
          if (val) paths.add(val);
        }
        // Delete each unique path from R2
        for (const path of paths) {
          const ok = await deleteFromR2(r2AccountId, r2AccessKeyId, r2SecretKey, r2BucketName, path);
          if (ok) deletedFromStorage++;
        }
      }
    } else {
      console.warn("R2 credentials not configured, skipping storage deletion");
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
        deletedFromStorage,
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
