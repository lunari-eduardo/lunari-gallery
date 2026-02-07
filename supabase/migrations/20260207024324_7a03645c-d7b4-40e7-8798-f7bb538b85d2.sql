-- Simplify galeria_fotos schema after migrating to Cloudflare Image Resizing
-- Watermarks are now applied on-the-fly via URL, no need for pre-processed files

-- Update all photos stuck in 'uploaded' or 'processing' status to 'ready'
-- Since we no longer have async processing, all photos are ready immediately
UPDATE galeria_fotos
SET 
  processing_status = 'ready',
  -- Set paths to storage_key if not already set
  thumb_path = COALESCE(thumb_path, storage_key),
  preview_path = COALESCE(preview_path, storage_key),
  updated_at = now()
WHERE processing_status IN ('uploaded', 'processing') OR processing_status IS NULL;

-- Note: We keep the following columns for backward compatibility but they may be removed later:
-- - preview_wm_path (no longer used - watermark is applied via URL)
-- - processing_status (always 'ready' now)
-- - has_watermark (determined at runtime from photographer settings)

-- Add comment to document the architectural change
COMMENT ON COLUMN galeria_fotos.processing_status IS 'Legacy column - always "ready" now. Watermarks are applied via Cloudflare Image Resizing URL params.';
COMMENT ON COLUMN galeria_fotos.preview_wm_path IS 'Deprecated - watermarks are now applied on-the-fly via Cloudflare Image Resizing';