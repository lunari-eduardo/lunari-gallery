/**
 * R2 Upload Edge Function
 * 
 * Uploads compressed preview images directly to Cloudflare R2
 * using S3-compatible API with AWS Signature V4.
 * 
 * Features:
 * - Auth via Supabase JWT
 * - Credit check BEFORE upload, consume AFTER success
 * - Server-side retry for R2 uploads (transient errors)
 * - Idempotency via upload_key (prevents duplicates on retry)
 * - Direct R2 upload (no B2 for previews)
 * - Metadata saved to galeria_fotos
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

async function sha256Hex(data: ArrayBuffer | Uint8Array | string): Promise<string> {
  const buffer = typeof data === 'string' 
    ? new TextEncoder().encode(data) 
    : data;
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

// ── R2 Upload with Server-Side Retry ─────────────────────────────────────────

async function uploadToR2WithRetry(
  accountId: string,
  accessKeyId: string,
  secretAccessKey: string,
  bucketName: string,
  key: string,
  body: ArrayBuffer,
  contentType: string,
  requestId: string,
): Promise<void> {
  const maxAttempts = 3;
  const delays = [0, 1000, 2000]; // immediate, 1s, 2s

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`[${requestId}] R2 retry ${attempt}/${maxAttempts - 1}, waiting ${delays[attempt]}ms`);
        await new Promise(r => setTimeout(r, delays[attempt]));
      }
      await uploadToR2(accountId, accessKeyId, secretAccessKey, bucketName, key, body, contentType);
      return; // success
    } catch (err) {
      console.error(`[${requestId}] R2 attempt ${attempt + 1} failed:`, err);
      if (attempt === maxAttempts - 1) throw err;
    }
  }
}

async function uploadToR2(
  accountId: string,
  accessKeyId: string,
  secretAccessKey: string,
  bucketName: string,
  key: string,
  body: ArrayBuffer,
  contentType: string
): Promise<void> {
  const host = `${accountId}.r2.cloudflarestorage.com`;
  const url = `https://${host}/${bucketName}/${key}`;
  
  const date = new Date();
  const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const region = 'auto';
  const service = 's3';
  const method = 'PUT';
  const canonicalUri = `/${bucketName}/${key}`;
  
  const payloadHash = await sha256Hex(body);
  
  const canonicalHeaders = [
    `content-type:${contentType}`,
    `host:${host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${amzDate}`,
  ].join('\n') + '\n';
  
  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
  
  const canonicalRequest = [
    method, canonicalUri, '', canonicalHeaders, signedHeaders, payloadHash,
  ].join('\n');
  
  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const canonicalRequestHash = await sha256Hex(canonicalRequest);
  const stringToSign = [algorithm, amzDate, credentialScope, canonicalRequestHash].join('\n');
  
  const signingKey = await getSignatureKey(secretAccessKey, dateStamp, region, service);
  const signature = await hmacHex(signingKey, stringToSign);
  const authorization = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      'Authorization': authorization,
    },
    body,
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`R2 upload failed: ${response.status} - ${error}`);
  }
}

// ── Main Handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  const startTime = Date.now();
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log(`[${requestId}] R2 upload request started`);

    // ── 1. Auth ──────────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error(`[${requestId}] Auth error:`, authError);
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[${requestId}] User authenticated: ${user.id}`);

    // ── 2. Parse form data ───────────────────────────────────────────────────
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const galleryId = formData.get("galleryId") as string;
    const originalFilename = formData.get("originalFilename") as string;
    const width = parseInt(formData.get("width") as string) || 0;
    const height = parseInt(formData.get("height") as string) || 0;
    const originalPath = formData.get("originalPath") as string | null;
    const uploadKey = formData.get("uploadKey") as string | null;
    const skipCredits = formData.get("skipCredits") === "true";
    const originalFileSizeRaw = formData.get("originalFileSize") as string | null;
    const originalFileSize = originalFileSizeRaw ? parseInt(originalFileSizeRaw, 10) : null;

    if (!file || !galleryId) {
      return new Response(JSON.stringify({ error: "Arquivo e galleryId são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[${requestId}] File: ${file.name}, Gallery: ${galleryId}, Size: ${(file.size / 1024).toFixed(0)}KB, UploadKey: ${uploadKey || 'none'}`);

    // ── 3. Verify gallery ownership ──────────────────────────────────────────
    const { data: gallery, error: galleryError } = await supabase
      .from("galerias")
      .select("id, user_id")
      .eq("id", galleryId)
      .single();

    if (galleryError || !gallery || gallery.user_id !== user.id) {
      console.error(`[${requestId}] Gallery access denied:`, galleryError);
      return new Response(JSON.stringify({ error: "Galeria não encontrada ou sem permissão" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 4. Idempotency check ─────────────────────────────────────────────────
    if (uploadKey) {
      const { data: existing } = await supabase
        .from("galeria_fotos")
        .select("id, filename, original_filename, storage_key, file_size, mime_type, width, height")
        .eq("galeria_id", galleryId)
        .eq("upload_key", uploadKey)
        .maybeSingle();

      if (existing) {
        console.log(`[${requestId}] Idempotent hit: photo already exists with upload_key=${uploadKey}`);
        return new Response(
          JSON.stringify({
            success: true,
            idempotent: true,
            photo: {
              id: existing.id,
              filename: existing.filename,
              originalFilename: existing.original_filename,
              storageKey: existing.storage_key,
              fileSize: existing.file_size,
              mimeType: existing.mime_type,
              width: existing.width,
              height: existing.height,
            },
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ── 5. Check credits (without consuming) — skip for deliver galleries ──
    if (!skipCredits) {
      const { data: isAdmin } = await supabase.rpc('has_role', {
        _user_id: user.id,
        _role: 'admin'
      });

      if (!isAdmin) {
        const { data: hasCredits, error: creditError } = await supabase.rpc(
          'check_photo_credits',
          { _user_id: user.id, _photo_count: 1 }
        );

        if (creditError || !hasCredits) {
          console.error(`[${requestId}] Credit check failed:`, creditError);
          return new Response(
            JSON.stringify({ 
              error: 'Créditos insuficientes',
              code: 'INSUFFICIENT_CREDITS'
            }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        console.log(`[${requestId}] Credits verified (not consumed yet)`);
      }
    } else {
      console.log(`[${requestId}] skipCredits=true, skipping credit check`);
    }

    // ── 6. R2 credentials ────────────────────────────────────────────────────
    const r2AccountId = Deno.env.get("R2_ACCOUNT_ID");
    const r2AccessKeyId = Deno.env.get("R2_ACCESS_KEY_ID");
    const r2SecretKey = Deno.env.get("R2_SECRET_ACCESS_KEY");
    const r2BucketName = "lunari-previews";

    if (!r2AccountId || !r2AccessKeyId || !r2SecretKey) {
      console.error(`[${requestId}] R2 credentials not configured`);
      return new Response(JSON.stringify({ error: "Configuração de storage incompleta" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 7. Upload to R2 (with server-side retry) ─────────────────────────────
    const timestamp = Date.now();
    const randomId = crypto.randomUUID().slice(0, 8);
    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const filename = `${timestamp}-${randomId}.${extension}`;
    const storagePath = `galleries/${galleryId}/${filename}`;

    const fileData = await file.arrayBuffer();

    console.log(`[${requestId}] Uploading to R2: ${storagePath} (${(fileData.byteLength / 1024).toFixed(0)}KB)`);

    await uploadToR2WithRetry(
      r2AccountId, r2AccessKeyId, r2SecretKey, r2BucketName,
      storagePath, fileData, file.type || "image/jpeg", requestId
    );

    console.log(`[${requestId}] R2 upload complete`);

    // ── 8. Save to database ──────────────────────────────────────────────────
    const { data: photo, error: insertError } = await supabase
      .from("galeria_fotos")
      .insert({
        galeria_id: galleryId,
        user_id: user.id,
        filename,
        original_filename: originalFilename || file.name,
        storage_key: storagePath,
        thumb_path: storagePath,
        preview_path: storagePath,
        original_path: originalPath || null,
        file_size: fileData.byteLength,
        original_file_size: originalFileSize,
        mime_type: file.type || "image/jpeg",
        width,
        height,
        is_selected: false,
        order_index: 0,
        processing_status: 'ready',
        upload_key: uploadKey || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error(`[${requestId}] DB insert error:`, insertError);
      // If unique constraint on upload_key, treat as idempotent hit
      if (insertError.code === '23505' && uploadKey) {
        console.log(`[${requestId}] Duplicate upload_key detected, fetching existing`);
        const { data: existing } = await supabase
          .from("galeria_fotos")
          .select("id, filename, original_filename, storage_key, file_size, mime_type, width, height")
          .eq("galeria_id", galleryId)
          .eq("upload_key", uploadKey)
          .single();

        if (existing) {
          return new Response(
            JSON.stringify({
              success: true,
              idempotent: true,
              photo: {
                id: existing.id,
                filename: existing.filename,
                originalFilename: existing.original_filename,
                storageKey: existing.storage_key,
                fileSize: existing.file_size,
                mimeType: existing.mime_type,
                width: existing.width,
                height: existing.height,
              },
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
      return new Response(JSON.stringify({ error: "Erro ao salvar metadados" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[${requestId}] Photo saved to DB: ${photo.id}`);

    // ── 9. Consume credits AFTER success — skip for deliver galleries ──────
    if (!skipCredits) {
      const { data: isAdmin } = await supabase.rpc('has_role', {
        _user_id: user.id,
        _role: 'admin'
      });

      if (!isAdmin) {
        const { data: creditConsumed, error: consumeError } = await supabase.rpc(
          'consume_photo_credits',
          { _user_id: user.id, _gallery_id: galleryId, _photo_count: 1 }
        );

        if (consumeError || !creditConsumed) {
          console.error(`[${requestId}] ⚠️ Credit consumption failed after successful upload:`, consumeError);
        } else {
          console.log(`[${requestId}] Credit consumed successfully`);
        }
      }
    } else {
      console.log(`[${requestId}] skipCredits=true, skipping credit consumption`);
    }

    // ── 10. Update gallery photo count ───────────────────────────────────────
    await supabase.rpc('increment_gallery_photo_count', { gallery_id: galleryId });

    const duration = Date.now() - startTime;
    console.log(`[${requestId}] ✓ Complete in ${duration}ms`);

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
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(`[${requestId}] Error:`, error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
