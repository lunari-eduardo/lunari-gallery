/**
 * Continuous upload pipeline with controlled concurrency,
 * aggressive memory cleanup, and real cancellation via AbortController.
 *
 * Replaces the old batch-based Promise.all approach with a two-stage queue:
 *   [Compression Queue] → [Upload Queue] → Done
 *
 * Each photo flows individually through the pipeline so uploads start
 * within ~2 seconds of file selection.
 */

import {
  compressImage,
  compressCover,
  clearWatermarkCache,
  type CompressionOptions,
  type CompressedImage,
  type WatermarkConfig,
} from '@/lib/imageCompression';
import { isVideoFile, generateVideoThumbnail, getVideoDimensions } from '@/lib/mediaValidation';
import { supabase } from '@/integrations/supabase/client';
import { retryWithBackoff, getUploadErrorMessage } from '@/lib/retryFetch';

// ── Types ────────────────────────────────────────────────────────────────────

export type PipelineItemStatus =
  | 'queued'
  | 'compressing'
  | 'uploading-original'
  | 'uploading-preview'
  | 'done'
  | 'error';

export interface PipelineItem {
  id: string;
  file: File;
  preview: string;
  status: PipelineItemStatus;
  progress: number;
  error?: string;
  retryCount: number;
  uploadKey?: string;
  result?: UploadResult;
  /** Internal – compressed blob, nulled after upload */
  _compressed?: CompressedImage | null;
  _abortController: AbortController;
}

export interface UploadResult {
  id: string;
  filename: string;
  originalFilename: string;
  storageKey: string;
  fileSize: number;
  mimeType: string;
  width: number;
  height: number;
}

export interface PipelineOptions {
  galleryId: string;
  folderId?: string | null;
  maxLongEdge: 1024 | 1920 | 2560;
  quality: number;
  watermarkConfig?: WatermarkConfig;
  allowDownload: boolean;
  skipCredits: boolean;
  /** Max parallel compressions (default 2) */
  maxCompressionSlots?: number;
  /** Max parallel uploads (default from network) */
  maxUploadSlots?: number;
  onItemUpdate: (item: PipelineItem) => void;
  onItemDone: (item: PipelineItem) => void;
  onPipelineComplete: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Default parallel upload slots, tuned to avoid overloading the Cloudflare Worker
 * and the browser's connection pool. Uploads include both originals (Worker)
 * and previews (Edge Function), so 3 slots = up to 6 concurrent connections.
 */
function getDefaultUploadSlots(): number {
  const conn = (navigator as any).connection;
  if (!conn) return 3;
  switch (conn.effectiveType) {
    case '4g': return 3;
    case '3g': return 2;
    case '2g': case 'slow-2g': return 1;
    default: return 3;
  }
}

/** Combine multiple AbortSignals into one (polyfill-safe). */
function combineSignals(signals: AbortSignal[]): AbortSignal {
  // Native API (modern browsers)
  if (typeof (AbortSignal as any).any === 'function') {
    return (AbortSignal as any).any(signals);
  }
  const controller = new AbortController();
  for (const s of signals) {
    if (s.aborted) {
      controller.abort((s as any).reason);
      break;
    }
    s.addEventListener('abort', () => controller.abort((s as any).reason), { once: true });
  }
  return controller.signal;
}

/** Structured warn for diagnostic visibility without spamming the console. */
function logUploadWarn(phase: string, item: { id: string; file: File }, err: unknown, extra: Record<string, unknown> = {}) {
  const e = err instanceof Error ? err : new Error(String(err));
  console.warn('[UploadPipeline]', {
    phase,
    itemId: item.id,
    file: item.file.name,
    size: item.file.size,
    errorName: e.name,
    errorMessage: e.message,
    ...extra,
  });
}

async function generateUploadKey(galleryId: string, fileName: string, fileSize: number): Promise<string> {
  const raw = `${galleryId}:${fileName}:${fileSize}`;
  const buffer = new TextEncoder().encode(raw);
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hash).slice(0, 12))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// ── Pipeline class ───────────────────────────────────────────────────────────

export class UploadPipeline {
  private queue: PipelineItem[] = [];
  private activeCompressions = 0;
  private activeUploads = 0;
  private destroyed = false;
  private opts: Required<PipelineOptions> & PipelineOptions;

  private maxCompress: number;
  private maxUpload: number;

  // ── Session token cache (avoid concurrent getSession calls during uploads) ──
  private cachedAccessToken: string | null = null;
  private cachedTokenExpiresAt = 0; // epoch ms
  private sessionFetchPromise: Promise<string> | null = null;

  constructor(options: PipelineOptions) {
    this.opts = options as any;
    this.maxCompress = options.maxCompressionSlots ?? Math.min(Math.max(2, Math.floor((navigator.hardwareConcurrency || 4) / 2)), 4);
    this.maxUpload = options.maxUploadSlots ?? getDefaultUploadSlots();
  }

  /**
   * Get a valid access token, cached across uploads.
   * Refreshes only when <60s remain. Coalesces concurrent fetches into one promise.
   */
  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.cachedAccessToken && this.cachedTokenExpiresAt - now > 60_000) {
      return this.cachedAccessToken;
    }
    if (this.sessionFetchPromise) {
      return this.sessionFetchPromise;
    }
    this.sessionFetchPromise = (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error('Sessão expirada. Faça login novamente.');
        this.cachedAccessToken = session.access_token;
        // expires_at is epoch seconds; fall back to 50 min if missing
        this.cachedTokenExpiresAt = session.expires_at
          ? session.expires_at * 1000
          : Date.now() + 50 * 60 * 1000;
        return session.access_token;
      } finally {
        this.sessionFetchPromise = null;
      }
    })();
    return this.sessionFetchPromise;
  }

  /** Add files to the pipeline – processing starts immediately */
  add(files: File[]): PipelineItem[] {
    const items: PipelineItem[] = files.map(file => ({
      id: crypto.randomUUID(),
      file,
      preview: URL.createObjectURL(file),
      status: 'queued' as const,
      progress: 0,
      retryCount: 0,
      _abortController: new AbortController(),
    }));
    this.queue.push(...items);
    // Kick processing on next microtask so caller can read returned items
    queueMicrotask(() => this.tick());
    return items;
  }

  /** Cancel a single item or all */
  cancel(id?: string) {
    if (!id) {
      // Cancel everything: abort all active controllers
      for (const item of this.queue) {
        if (item.status !== 'done' && item.status !== 'error') {
          item._abortController.abort();
          this.cleanupItem(item);
          item.status = 'error';
          item.error = 'Cancelado';
          this.opts.onItemUpdate(item);
        }
      }
      this.queue = [];
      this.activeCompressions = 0;
      this.activeUploads = 0;
    } else {
      // Cancel specific item
      const item = this.queue.find(i => i.id === id);
      if (item && item.status !== 'done' && item.status !== 'error') {
        item._abortController.abort();
        this.cleanupItem(item);
        item.status = 'error';
        item.error = 'Cancelado';
        this.opts.onItemUpdate(item);
      }
    }
  }

  /**
   * Retry a failed item.
   * If the original was already uploaded and the preview was already compressed,
   * we resume from where we left off instead of starting from scratch.
   */
  retry(id: string) {
    const item = this.queue.find(i => i.id === id);
    if (!item || item.status !== 'error') return;
    // If previous failure was watermark-related, the browser may have a
    // poisoned image cache entry. Clear the in-memory watermark blob cache
    // so the next attempt refetches with a cache-buster.
    if (item.error && /marca d'água|watermark/i.test(item.error)) {
      try { clearWatermarkCache(); } catch { /* noop */ }
      // Drop cached compression so we recompress with a fresh watermark
      item._compressed = undefined;
    }
    item.status = 'queued';
    item.progress = 0;
    item.error = undefined;
    item.retryCount += 1;
    item._abortController = new AbortController();
    this.opts.onItemUpdate(item);
    this.tick();
  }

  /** Clean up everything */
  destroy() {
    this.destroyed = true;
    this.cancel();
    for (const item of this.queue) {
      this.cleanupItem(item);
    }
    this.queue = [];
  }

  get items(): PipelineItem[] {
    return this.queue;
  }

  get folderId(): string | null | undefined {
    return this.opts.folderId;
  }

  get isActive(): boolean {
    return this.queue.some(i =>
      i.status === 'queued' ||
      i.status === 'compressing' ||
      i.status === 'uploading-original' ||
      i.status === 'uploading-preview'
    );
  }

  get isDestroyed(): boolean {
    return this.destroyed;
  }

  // ── Internal scheduling ──────────────────────────────────────────────────

  private tick() {
    if (this.destroyed) return;

    // Fill compression slots
    while (this.activeCompressions < this.maxCompress) {
      const next = this.queue.find(i => i.status === 'queued');
      if (!next) break;
      this.activeCompressions++;
      next.status = 'compressing';
      this.opts.onItemUpdate(next);
      this.processItem(next);
    }

    // Fill upload slots
    // Items waiting for upload have _compressed set and status still 'compressing' finished
    // We use a transitional approach: after compression, status is set to uploading-original or uploading-preview
    // So upload slot filling happens inside processItem after compression completes.

    // Check if pipeline is complete
    if (!this.isActive) {
      this.opts.onPipelineComplete();
    }
  }

  private async processItem(item: PipelineItem) {
    const signal = item._abortController.signal;
    let compressionSlotHeld = true; // We entered processItem with a compression slot held

    try {
      // ── Step 1: Upload original (if allowDownload and not yet done) ──
      const alreadyHasOriginal = !!(item as any)._originalPath;
      if (this.opts.allowDownload && !alreadyHasOriginal) {
        item.status = 'uploading-original';
        item.progress = 5;
        this.opts.onItemUpdate(item);

        // Wait for an upload slot
        await this.waitForUploadSlot(signal);
        this.activeUploads++;

        try {
          await this.uploadOriginal(item, signal);
        } finally {
          this.activeUploads--;
        }

        if (signal.aborted) throw new Error('Cancelado');
        item.progress = 20;
        this.opts.onItemUpdate(item);
      }

      // ── Step 2: Compress (or skip for video / reuse cached compression) ──
      const isVideo = isVideoFile(item.file);
      let compressed: CompressedImage;

      if (item._compressed) {
        // Resume from previous attempt — already compressed
        compressed = item._compressed;
        item.progress = this.opts.allowDownload ? 40 : 30;
        this.opts.onItemUpdate(item);
      } else {
        item.status = 'compressing';
        item.progress = this.opts.allowDownload ? 25 : 10;
        this.opts.onItemUpdate(item);

        if (isVideo) {
          const dims = await getVideoDimensions(item.file);
          compressed = {
            blob: item.file,
            width: dims.width,
            height: dims.height,
            originalSize: item.file.size,
            compressedSize: item.file.size,
            filename: item.file.name,
          };
          console.log('[Pipeline] Video detected, skipping compression:', item.file.name);
        } else {
          const compressionOptions: Partial<CompressionOptions> = {
            maxLongEdge: this.opts.maxLongEdge,
            quality: this.opts.quality,
            removeExif: true,
            watermark: this.opts.watermarkConfig,
          };

          try {
            if (signal.aborted) throw new Error('Cancelado');
            compressed = await compressImage(item.file, compressionOptions);
          } catch (err) {
            if (this.opts.watermarkConfig && this.opts.watermarkConfig.mode !== 'none') {
              throw err; // Watermark is mandatory – do not fallback
            }
            logUploadWarn('compress-fallback', item, err);
            compressed = {
              blob: item.file,
              width: 0,
              height: 0,
              originalSize: item.file.size,
              compressedSize: item.file.size,
              filename: item.file.name,
            };
          }
        }

        item._compressed = compressed;
        item.progress = this.opts.allowDownload ? 40 : 30;
        this.opts.onItemUpdate(item);
      }

      // Compression slot done (release before waiting for upload slot)
      this.activeCompressions--;
      compressionSlotHeld = false;

      // ── Step 3: Upload preview ──
      if (signal.aborted) throw new Error('Cancelado');

      await this.waitForUploadSlot(signal);
      this.activeUploads++;
      item.status = 'uploading-preview';
      item.progress = this.opts.allowDownload ? 50 : 40;
      this.opts.onItemUpdate(item);

      try {
        const result = await this.uploadPreview(item, signal);
        item.result = result;
      } finally {
        this.activeUploads--;
      }

      // ── Done ──
      item.status = 'done';
      item.progress = 100;
      item.error = undefined;
      this.cleanupItem(item, /* keepResumeState */ false);
      this.opts.onItemUpdate(item);
      this.opts.onItemDone(item);

      // ── Background: Upload cover variant (non-blocking) ──
      if (!isVideo) {
        this.uploadCoverInBackground(item).catch(err => {
          logUploadWarn('cover-upload', item, err);
        });
      }
    } catch (err) {
      if (item.status !== 'error') {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        item.status = 'error';
        item.error = signal.aborted ? 'Cancelado' : getUploadErrorMessage(errorObj);
        logUploadWarn('item-failed', item, err, {
          retryCount: item.retryCount,
          hasCompressed: !!item._compressed,
          hasOriginal: !!(item as any)._originalPath,
        });
      }
      if (compressionSlotHeld) {
        this.activeCompressions = Math.max(0, this.activeCompressions - 1);
      }
      // Keep _compressed and _originalPath so retry can resume cheaply
      this.cleanupItem(item, /* keepResumeState */ true);
      this.opts.onItemUpdate(item);
    }

    // Schedule next items
    this.tick();
  }

  private async waitForUploadSlot(signal: AbortSignal): Promise<void> {
    while (this.activeUploads >= this.maxUpload) {
      if (signal.aborted) throw new Error('Cancelado');
      await new Promise(r => setTimeout(r, 100));
    }
  }

  private async uploadOriginal(item: PipelineItem, signal: AbortSignal): Promise<string> {
    const R2_WORKER_URL = import.meta.env.VITE_R2_UPLOAD_URL || 'https://cdn.lunarihub.com';

    const result = await retryWithBackoff(
      async () => {
        if (signal.aborted) throw new Error('Cancelado');

        // Build a fresh FormData per attempt (some browsers consume the body on retry)
        const formData = new FormData();
        formData.append('file', item.file, item.file.name);
        formData.append('galleryId', this.opts.galleryId);
        formData.append('originalFilename', item.file.name);

        const accessToken = await this.getAccessToken();

        // Combine caller signal with a 90s per-attempt timeout to avoid stuck fetches
        const timeoutSignal = (AbortSignal as any).timeout
          ? (AbortSignal as any).timeout(90_000)
          : (() => {
              const c = new AbortController();
              setTimeout(() => c.abort(new Error('Timeout')), 90_000);
              return c.signal;
            })();
        const combined = combineSignals([signal, timeoutSignal]);

        let resp: Response;
        try {
          resp = await fetch(`${R2_WORKER_URL}/upload-original`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}` },
            body: formData,
            signal: combined,
          });
        } catch (netErr) {
          // Network or timeout error — let retryWithBackoff handle it
          throw new Error(`NETWORK ${netErr instanceof Error ? netErr.message : String(netErr)}`);
        }

        if (!resp.ok) {
          const data = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
          // Mark 5xx as retryable via prefix matching in retryFetch defaults
          throw new Error(`${resp.status} ${data.error || 'Upload original falhou'}`);
        }

        const data = await resp.json();
        if (!data?.success || !data?.photo?.storageKey) {
          throw new Error('Falha no upload do original: resposta inválida');
        }
        return data.photo.storageKey as string;
      },
      {
        maxAttempts: 3,
        baseDelay: 2000,
        signal,
        onRetry: (attempt, error) => {
          logUploadWarn('upload-original-retry', item, error, { attempt });
        },
      }
    );

    (item as any)._originalPath = result;
    return result;
  }

  private async uploadPreview(item: PipelineItem, signal: AbortSignal): Promise<UploadResult> {
    const compressed = item._compressed!;
    const uploadKey = item.uploadKey || await generateUploadKey(this.opts.galleryId, item.file.name, item.file.size);
    item.uploadKey = uploadKey;

    const formData = new FormData();
    formData.append('file', compressed.blob, compressed.filename);
    formData.append('galleryId', this.opts.galleryId);
    formData.append('originalFilename', item.file.name);
    formData.append('width', compressed.width.toString());
    formData.append('height', compressed.height.toString());
    formData.append('uploadKey', uploadKey);
    formData.append('originalFileSize', item.file.size.toString());

    if (this.opts.folderId) {
      formData.append('folderId', this.opts.folderId);
    }

    if (this.opts.skipCredits) {
      formData.append('skipCredits', 'true');
    }

    const originalPath = (item as any)._originalPath;
    if (originalPath) {
      formData.append('originalPath', originalPath);
    }

    const result = await retryWithBackoff(
      async () => {
        if (signal.aborted) throw new Error('Cancelado');

        const { data, error } = await supabase.functions.invoke('r2-upload', {
          body: formData,
        });

        if (error) throw new Error(error.message || 'Falha ao enviar foto');
        if (!data?.success) {
          if (data?.code === 'INSUFFICIENT_CREDITS') throw new Error('Créditos insuficientes');
          throw new Error(data?.error || 'Falha ao enviar foto');
        }
        return data;
      },
      {
        maxAttempts: 3,
        baseDelay: 2000,
        signal,
        onRetry: (attempt, error, delay) => {
          item.progress = this.opts.allowDownload ? 50 : 40;
          item.error = `Tentativa ${attempt + 1}...`;
          this.opts.onItemUpdate(item);
        },
      }
    );

    return {
      id: result.photo.id,
      filename: result.photo.filename,
      originalFilename: result.photo.originalFilename,
      storageKey: result.photo.storageKey,
      fileSize: result.photo.fileSize,
      mimeType: result.photo.mimeType,
      width: result.photo.width,
      height: result.photo.height,
    };
  }

  /**
   * Release memory for an item.
   * @param item - the pipeline item
   * @param keepResumeState - when true, preserve compressed blob and original path
   *   so a retry can skip already-completed phases. Use false when the item is done.
   */
  private cleanupItem(item: PipelineItem, keepResumeState: boolean = false) {
    if (!keepResumeState) {
      if (item._compressed) {
        item._compressed = null;
      }
      delete (item as any)._originalPath;
    }
    // Preview URL stays alive until the item is removed from the UI list
  }

  /** Call this when removing an item from the UI list */
  revokePreview(id: string) {
    const item = this.queue.find(i => i.id === id);
    if (item) {
      URL.revokeObjectURL(item.preview);
    }
  }

  /** Upload a cover variant in the background (non-blocking, best-effort) */
  private async uploadCoverInBackground(item: PipelineItem) {
    if (!item.result?.id) return;

    try {
      const coverCompressed = await compressCover(item.file);
      
      const formData = new FormData();
      formData.append('file', coverCompressed.blob, coverCompressed.filename);
      formData.append('galleryId', this.opts.galleryId);
      formData.append('photoId', item.result.id);
      formData.append('uploadType', 'cover');

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const R2_WORKER_URL = import.meta.env.VITE_R2_UPLOAD_URL || 'https://cdn.lunarihub.com';
      const resp = await fetch(`${R2_WORKER_URL}/upload-cover`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      });

      if (resp.ok) {
        console.log('[Pipeline] Cover uploaded for:', item.file.name);
      } else {
        console.warn('[Pipeline] Cover upload response not ok:', resp.status);
      }
    } catch (err) {
      console.warn('[Pipeline] Cover generation/upload error:', err);
    }
  }
}
