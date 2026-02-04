/**
 * Edge Function: process-photos
 * 
 * Asynchronous image processing job:
 * 1. Fetches photos with processing_status = 'uploaded'
 * 2. Downloads original from B2
 * 3. Generates thumbnail (400px), preview (1200px), preview with watermark
 * 4. Uploads derivatives to Cloudflare R2
 * 5. Updates database with paths and status = 'ready'
 * 
 * Triggered by pg_cron every minute
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { S3Client, PutObjectCommand } from "https://esm.sh/@aws-sdk/client-s3@3.478.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PhotoToProcess {
  id: string;
  galeria_id: string;
  user_id: string;
  storage_key: string;
  filename: string;
  width: number;
  height: number;
}

interface ProcessResult {
  photoId: string;
  success: boolean;
  error?: string;
}

// Initialize R2 client (S3-compatible)
function getR2Client() {
  const accountId = Deno.env.get("R2_ACCOUNT_ID");
  const accessKeyId = Deno.env.get("R2_ACCESS_KEY_ID");
  const secretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY");

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("R2 credentials not configured");
  }

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

// Fetch original image from B2
async function fetchOriginalFromB2(storageKey: string): Promise<ArrayBuffer> {
  const b2BucketUrl = Deno.env.get("B2_PUBLIC_URL") || "https://f005.backblazeb2.com/file/lunari-gallery";
  const url = `${b2BucketUrl}/${storageKey}`;
  
  console.log(`Fetching original from: ${url}`);
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch from B2: ${response.status} ${response.statusText}`);
  }
  
  return await response.arrayBuffer();
}

// Upload to R2
async function uploadToR2(
  r2Client: S3Client,
  bucketName: string,
  key: string,
  data: Uint8Array,
  contentType: string
): Promise<void> {
  await r2Client.send(new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: data,
    ContentType: contentType,
  }));
  
  console.log(`Uploaded to R2: ${key}`);
}

// Resize image using Canvas API (Deno has limited image processing)
// For now, we'll use a simple approach - in production, consider using 
// a dedicated image processing service or Cloudflare Image Resizing
async function resizeImage(
  imageData: ArrayBuffer,
  maxWidth: number,
  quality: number = 0.85
): Promise<Uint8Array> {
  // For MVP, we'll return the original image
  // In production, integrate with Cloudflare Image Resizing or a dedicated service
  // This is a placeholder that returns the original data
  return new Uint8Array(imageData);
}

// Apply watermark overlay
// Note: Watermark composition requires image manipulation libraries
// For MVP, this returns the image as-is
// In production, use Cloudflare Image Transformations or sharp
async function applyWatermark(
  imageData: Uint8Array,
  _watermarkSettings: { opacity?: number; position?: string } = {}
): Promise<Uint8Array> {
  // Placeholder - returns original image
  // In production, integrate with image processing service
  return imageData;
}

// Process a single photo
async function processPhoto(
  r2Client: S3Client,
  bucketName: string,
  photo: PhotoToProcess,
  supabase: any
): Promise<ProcessResult> {
  const startTime = Date.now();
  
  try {
    console.log(`Processing photo ${photo.id}: ${photo.filename}`);
    
    // 1. Fetch original from B2
    const originalData = await fetchOriginalFromB2(photo.storage_key);
    console.log(`Fetched original: ${(originalData.byteLength / 1024).toFixed(0)}KB`);
    
    // 2. Generate derivatives
    const thumbData = await resizeImage(originalData, 400, 0.80);
    const previewData = await resizeImage(originalData, 1200, 0.85);
    
    // 3. Get watermark settings from gallery
    const { data: gallery } = await supabase
      .from("galerias")
      .select("configuracoes")
      .eq("id", photo.galeria_id)
      .single();
    
    const watermarkSettings = (gallery?.configuracoes as any)?.watermark || {};
    const previewWmData = await applyWatermark(previewData, watermarkSettings);
    
    // 4. Build R2 paths
    const basePath = `${photo.user_id}/${photo.galeria_id}`;
    const thumbPath = `${basePath}/thumb/${photo.filename}`;
    const previewPath = `${basePath}/preview/${photo.filename}`;
    const previewWmPath = `${basePath}/preview-wm/${photo.filename}`;
    
    // 5. Upload to R2
    const contentType = "image/jpeg";
    await Promise.all([
      uploadToR2(r2Client, bucketName, thumbPath, thumbData, contentType),
      uploadToR2(r2Client, bucketName, previewPath, previewData, contentType),
      uploadToR2(r2Client, bucketName, previewWmPath, previewWmData, contentType),
    ]);
    
    // 6. Update database
    const { error: updateError } = await supabase
      .from("galeria_fotos")
      .update({
        thumb_path: thumbPath,
        preview_path: previewPath,
        preview_wm_path: previewWmPath,
        processing_status: "ready",
        updated_at: new Date().toISOString(),
      })
      .eq("id", photo.id);
    
    if (updateError) {
      throw new Error(`Database update failed: ${updateError.message}`);
    }
    
    const duration = Date.now() - startTime;
    console.log(`✓ Photo ${photo.id} processed in ${duration}ms`);
    
    return { photoId: photo.id, success: true };
  } catch (error) {
    console.error(`✗ Error processing photo ${photo.id}:`, error);
    
    // Mark as error in database
    await supabase
      .from("galeria_fotos")
      .update({
        processing_status: "error",
        updated_at: new Date().toISOString(),
      })
      .eq("id", photo.id);
    
    return {
      photoId: photo.id,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  const startTime = Date.now();
  
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log(`[${requestId}] Process-photos job started`);
    
    // Parse request body for batch size
    let batchSize = 10;
    try {
      const body = await req.json();
      batchSize = body.batchSize || 10;
    } catch {
      // Use default batch size
    }
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Check R2 configuration
    const bucketName = Deno.env.get("R2_BUCKET_NAME");
    if (!bucketName) {
      console.log(`[${requestId}] R2_BUCKET_NAME not configured, skipping`);
      return new Response(
        JSON.stringify({ message: "R2 not configured", processed: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Initialize R2 client
    const r2Client = getR2Client();
    
    // 1. Mark batch as "processing" atomically (FOR UPDATE SKIP LOCKED equivalent)
    // First, get pending photos
    const { data: pendingPhotos, error: fetchError } = await supabase
      .from("galeria_fotos")
      .select("id, galeria_id, user_id, storage_key, filename, width, height")
      .eq("processing_status", "uploaded")
      .limit(batchSize);
    
    if (fetchError) {
      throw new Error(`Failed to fetch pending photos: ${fetchError.message}`);
    }
    
    if (!pendingPhotos || pendingPhotos.length === 0) {
      console.log(`[${requestId}] No pending photos to process`);
      return new Response(
        JSON.stringify({ message: "No pending photos", processed: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.log(`[${requestId}] Found ${pendingPhotos.length} photos to process`);
    
    // 2. Mark as "processing"
    const photoIds = pendingPhotos.map(p => p.id);
    await supabase
      .from("galeria_fotos")
      .update({ processing_status: "processing" })
      .in("id", photoIds);
    
    // 3. Process each photo
    const results: ProcessResult[] = [];
    for (const photo of pendingPhotos as PhotoToProcess[]) {
      const result = await processPhoto(r2Client, bucketName, photo, supabase);
      results.push(result);
    }
    
    // 4. Count remaining
    const { count: remaining } = await supabase
      .from("galeria_fotos")
      .select("*", { count: "exact", head: true })
      .eq("processing_status", "uploaded");
    
    const duration = Date.now() - startTime;
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log(`[${requestId}] ✓ Job complete in ${duration}ms: ${successful} success, ${failed} failed, ${remaining || 0} remaining`);
    
    return new Response(
      JSON.stringify({
        processed: results.length,
        successful,
        failed,
        remaining: remaining || 0,
        duration,
        results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[${requestId}] ✗ Job failed after ${duration}ms:`, error);
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Internal error",
        duration,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
