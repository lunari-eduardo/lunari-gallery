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
  type CompressionOptions,
  type CompressedImage,
  type WatermarkConfig,
} from '@/lib/imageCompression';
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

function getDefaultUploadSlots(): number {
  const conn = (navigator as any).connection;
  if (!conn) return 4;
  switch (conn.effectiveType) {
    case '4g': return 5;
    case '3g': return 2;
    case '2g': case 'slow-2g': return 1;
    default: return 4;
  }
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

  constructor(options: PipelineOptions) {
    this.opts = options as any;
    this.maxCompress = options.maxCompressionSlots ?? 2;
    this.maxUpload = options.maxUploadSlots ?? getDefaultUploadSlots();
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
    for (const item of this.queue) {
      if (id && item.id !== id) continue;
      if (item.status === 'done' || item.status === 'error') continue;
      item._abortController.abort();
      this.cleanupItem(item);
      item.status = 'error';
      item.error = 'Cancelado';
      this.opts.onItemUpdate(item);
    }
    if (!id) {
      this.queue = [];
      this.activeCompressions = 0;
      this.activeUploads = 0;
    }
  }

  /** Retry a failed item */
  retry(id: string) {
    const item = this.queue.find(i => i.id === id);
    if (!item || item.status !== 'error') return;
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

  get isActive(): boolean {
    return this.queue.some(i =>
      i.status === 'queued' ||
      i.status === 'compressing' ||
      i.status === 'uploading-original' ||
      i.status === 'uploading-preview'
    );
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

    try {
      // ── Step 1: Upload original (if allowDownload) ──
      if (this.opts.allowDownload) {
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

      // ── Step 2: Compress ──
      item.status = 'compressing';
      item.progress = this.opts.allowDownload ? 25 : 10;
      this.opts.onItemUpdate(item);

      const compressionOptions: Partial<CompressionOptions> = {
        maxLongEdge: this.opts.maxLongEdge,
        quality: this.opts.quality,
        removeExif: true,
        watermark: this.opts.watermarkConfig,
      };

      let compressed: CompressedImage;
      try {
        if (signal.aborted) throw new Error('Cancelado');
        compressed = await compressImage(item.file, compressionOptions);
      } catch (err) {
        // Fallback: send original if compression fails and no watermark required
        if (this.opts.watermarkConfig && this.opts.watermarkConfig.mode !== 'none') {
          throw err; // Watermark is mandatory – do not fallback
        }
        console.warn('[Pipeline] Compression failed, using original as fallback:', err);
        compressed = {
          blob: item.file,
          width: 0,
          height: 0,
          originalSize: item.file.size,
          compressedSize: item.file.size,
          filename: item.file.name,
        };
      }

      item._compressed = compressed;
      item.progress = this.opts.allowDownload ? 40 : 30;
      this.opts.onItemUpdate(item);

      // Compression slot done
      this.activeCompressions--;

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
      this.cleanupItem(item);
      this.opts.onItemUpdate(item);
      this.opts.onItemDone(item);
    } catch (err) {
      // Track if we were still in compression phase to release the slot
      const wasCompressing = item.status === 'compressing';
      if (item.status !== 'error') {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        item.status = 'error';
        item.error = signal.aborted ? 'Cancelado' : getUploadErrorMessage(errorObj);
        console.error('[Pipeline] Item error:', item.file.name, err);
      }
      if (wasCompressing) {
        this.activeCompressions = Math.max(0, this.activeCompressions - 1);
      }
      this.cleanupItem(item);
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

    const formData = new FormData();
    formData.append('file', item.file, item.file.name);
    formData.append('galleryId', this.opts.galleryId);
    formData.append('originalFilename', item.file.name);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Sessão expirada. Faça login novamente.');

    const resp = await fetch(`${R2_WORKER_URL}/upload-original`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
      body: formData,
      signal,
    });

    if (!resp.ok) {
      const data = await resp.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(`Falha no upload do original: ${data.error || 'Erro desconhecido'}`);
    }

    const data = await resp.json();
    if (!data?.success || !data?.photo?.storageKey) {
      throw new Error('Falha no upload do original: resposta inválida');
    }

    // Store originalPath on item for later use
    (item as any)._originalPath = data.photo.storageKey;
    return data.photo.storageKey;
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

  /** Release memory for an item */
  private cleanupItem(item: PipelineItem) {
    if (item._compressed) {
      item._compressed = null;
    }
    // Keep preview URL alive for UI display until item is removed from list
    // The component should call revokePreview when removing items
    delete (item as any)._originalPath;
  }

  /** Call this when removing an item from the UI list */
  revokePreview(id: string) {
    const item = this.queue.find(i => i.id === id);
    if (item) {
      URL.revokeObjectURL(item.preview);
    }
  }
}
