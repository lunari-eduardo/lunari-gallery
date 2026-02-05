/**
 * Edge Function: process-photos (Orquestrador)
 * 
 * Esta função NÃO processa imagens diretamente.
 * Ela orquestra o fluxo:
 * 1. Busca fotos com status = 'uploaded'
 * 2. Busca configurações de watermark do fotógrafo
 * 3. Envia lote para Cloudflare Worker processar
 * 
 * Triggered by pg_cron every minute
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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

interface WatermarkConfig {
  mode: 'system' | 'custom' | 'none';
  path?: string;
  opacity: number;
  scale: number;
  tiling: boolean; // true = mosaico, false = overlay único
}

interface PhotoPayload {
  id: string;
  userId: string;
  galleryId: string;
  filename: string;
  storageKey: string;
  width: number;
  height: number;
  watermark: WatermarkConfig;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID().slice(0, 8);
  const startTime = Date.now();

  try {
    console.log(`[${requestId}] Process-photos orchestrator started`);
    
    // Parse request body for batch size
    let batchSize = 10;
    try {
      const body = await req.json();
      batchSize = body.batchSize || 10;
    } catch {
      // Use default batch size
    }
    
    // Initialize clients and get config
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const workerUrl = Deno.env.get("IMAGE_PROCESSOR_URL");
    const workerSecret = Deno.env.get("IMAGE_PROCESSOR_SECRET");
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Check if Worker is configured
    if (!workerUrl || !workerSecret) {
      console.log(`[${requestId}] Worker not configured (IMAGE_PROCESSOR_URL/SECRET missing)`);
      return new Response(
        JSON.stringify({ 
          message: "Worker not configured", 
          processed: 0,
          hint: "Set IMAGE_PROCESSOR_URL and IMAGE_PROCESSOR_SECRET in Edge Function secrets"
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // 1. Get pending photos
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
    
    // 2. Mark as "processing" to prevent duplicate processing
    const photoIds = pendingPhotos.map((p: PhotoToProcess) => p.id);
    await supabase
      .from("galeria_fotos")
      .update({ processing_status: "processing" })
      .in("id", photoIds);
    
    // 3. Get unique user IDs to fetch watermark settings
    const userIds = [...new Set(pendingPhotos.map((p: PhotoToProcess) => p.user_id))];
    
    const { data: accounts } = await supabase
      .from("photographer_accounts")
      .select("user_id, watermark_mode, watermark_path, watermark_opacity, watermark_scale")
      .in("user_id", userIds);
    
    // Build watermark config map by user
    const watermarkByUser = new Map<string, WatermarkConfig>();
    for (const account of accounts || []) {
      const mode = (account.watermark_mode as WatermarkConfig['mode']) || 'system';
      watermarkByUser.set(account.user_id, {
        mode,
        path: account.watermark_path || undefined,
        opacity: account.watermark_opacity ?? 40,
        scale: account.watermark_scale ?? 30,
        // Tiling enabled only for custom mode (mosaic pattern)
        tiling: mode === 'custom',
      });
    }
    
    // Default watermark config for users without settings
    const defaultWatermark: WatermarkConfig = {
      mode: 'system',
      opacity: 40,
      scale: 30,
      tiling: false, // System mode uses overlay, not tiling
    };
    
    // 4. Build payload for Worker
    const photosPayload: PhotoPayload[] = pendingPhotos.map((photo: PhotoToProcess) => ({
      id: photo.id,
      userId: photo.user_id,
      galleryId: photo.galeria_id,
      filename: photo.filename,
      storageKey: photo.storage_key,
      width: photo.width || 0,
      height: photo.height || 0,
      watermark: watermarkByUser.get(photo.user_id) || defaultWatermark,
    }));
    
    // 5. Call Cloudflare Worker
    console.log(`[${requestId}] Calling Worker at ${workerUrl} with ${photosPayload.length} photos`);
    
    const workerResponse = await fetch(`${workerUrl}/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${workerSecret}`,
      },
      body: JSON.stringify({ photos: photosPayload }),
    });
    
    if (!workerResponse.ok) {
      const errorText = await workerResponse.text();
      console.error(`[${requestId}] Worker returned ${workerResponse.status}: ${errorText}`);
      
      // Revert status to 'uploaded' so they can be retried
      await supabase
        .from("galeria_fotos")
        .update({ processing_status: "uploaded" })
        .in("id", photoIds);
      
      throw new Error(`Worker failed: ${workerResponse.status} - ${errorText}`);
    }
    
    const workerResult = await workerResponse.json();
    console.log(`[${requestId}] Worker result: ${JSON.stringify(workerResult)}`);
    
    // 6. Count remaining photos to process
    const { count: remaining } = await supabase
      .from("galeria_fotos")
      .select("*", { count: "exact", head: true })
      .eq("processing_status", "uploaded");
    
    const duration = Date.now() - startTime;
    console.log(`[${requestId}] ✓ Orchestration complete in ${duration}ms: ${workerResult.successful || 0} ok, ${workerResult.failed || 0} failed, ${remaining || 0} remaining`);
    
    return new Response(
      JSON.stringify({
        ...workerResult,
        remaining: remaining || 0,
        duration,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[${requestId}] ✗ Orchestration failed after ${duration}ms:`, error);
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Internal error",
        duration,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
