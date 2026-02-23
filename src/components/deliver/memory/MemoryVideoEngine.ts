/**
 * MemoryVideoEngine – client-side 9:16 video generator
 * Uses Canvas API + captureStream + MediaRecorder (no server needed)
 */

const VW = 1080;
const VH = 1920;
const FPS = 30;
const CROSSFADE_DURATION = 0.5; // seconds
const TEXT_FADE_DURATION = 0.6;
const FADE_OUT_DURATION = 0.8;
const KEN_BURNS_SCALE = 0.08; // 1.0 → 1.08

// ── Timeline config by photo count ──────────────────────────────

interface TimelineConfig {
  totalDuration: number;
  timePerPhoto: number;
  textPhotoIndex: number; // which photo shows text (-1 = none)
}

function getTimelineConfig(photoCount: number): TimelineConfig {
  switch (photoCount) {
    case 1:
      return { totalDuration: 6, timePerPhoto: 6, textPhotoIndex: 0 };
    case 2:
      return { totalDuration: 8, timePerPhoto: 4, textPhotoIndex: 1 };
    case 3:
      return { totalDuration: 9, timePerPhoto: 3, textPhotoIndex: 1 };
    case 4:
      return { totalDuration: 10, timePerPhoto: 2.5, textPhotoIndex: 2 };
    case 5:
      return { totalDuration: 10, timePerPhoto: 2, textPhotoIndex: 2 };
    case 6:
      return { totalDuration: 10, timePerPhoto: 10 / 6, textPhotoIndex: 3 };
    case 7:
      return { totalDuration: 10, timePerPhoto: 10 / 7, textPhotoIndex: 3 };
    default:
      return { totalDuration: 10, timePerPhoto: 10 / Math.min(photoCount, 7), textPhotoIndex: Math.floor(photoCount / 2) };
  }
}

// ── Drawing helpers ─────────────────────────────────────────────

function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number, y: number,
  w: number, h: number,
  zoom: number = 1,
) {
  const scale = Math.max(w / img.width, h / img.height) * zoom;
  const sw = w / scale;
  const sh = h / scale;
  const sx = (img.width - sw) / 2;
  const sy = (img.height - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  fontFamily: string,
  textColor: string,
  alpha: number,
) {
  if (!text.trim() || alpha <= 0) return;

  ctx.save();
  ctx.globalAlpha = alpha;
  const fontSize = 44;
  ctx.font = `${fontSize}px ${fontFamily}`;
  ctx.fillStyle = textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Subtle text shadow for readability
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 2;

  const maxWidth = VW - 120;
  const lines = wrapText(ctx, text.trim(), maxWidth);
  const lineHeight = fontSize * 1.5;
  const totalTextH = lines.length * lineHeight;
  const startY = VH * 0.78 - totalTextH / 2;

  lines.forEach((line, i) => {
    ctx.fillText(line, VW / 2, startY + i * lineHeight);
  });

  ctx.restore();
}

// ── Codec detection ─────────────────────────────────────────────

export function isVideoSupported(): boolean {
  if (typeof MediaRecorder === 'undefined') return false;
  return (
    MediaRecorder.isTypeSupported('video/webm; codecs=vp9') ||
    MediaRecorder.isTypeSupported('video/webm; codecs=vp8') ||
    MediaRecorder.isTypeSupported('video/webm')
  );
}

function pickMimeType(): string {
  if (MediaRecorder.isTypeSupported('video/webm; codecs=vp9')) return 'video/webm; codecs=vp9';
  if (MediaRecorder.isTypeSupported('video/webm; codecs=vp8')) return 'video/webm; codecs=vp8';
  return 'video/webm';
}

// ── Main engine ─────────────────────────────────────────────────

export interface VideoGenerateOptions {
  images: HTMLImageElement[];
  text: string;
  isDark: boolean;
  fontFamily: string;
  onProgress?: (pct: number) => void;
}

export async function generateVideo(opts: VideoGenerateOptions): Promise<Blob> {
  const { images, text, isDark, fontFamily, onProgress } = opts;

  const config = getTimelineConfig(images.length);
  const { totalDuration, timePerPhoto, textPhotoIndex } = config;

  const bgColor = isDark ? '#1C1917' : '#FAF9F7';
  const textColor = isDark ? '#F5F5F4' : '#2D2A26';

  // Create canvas
  const canvas = document.createElement('canvas');
  canvas.width = VW;
  canvas.height = VH;
  const ctx = canvas.getContext('2d')!;

  // Capture stream + MediaRecorder
  const stream = canvas.captureStream(FPS);
  const mimeType = pickMimeType();
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 4_000_000,
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  return new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      resolve(blob);
    };
    recorder.onerror = () => reject(new Error('MediaRecorder error'));

    recorder.start();
    const startTime = performance.now();

    const renderFrame = () => {
      const elapsed = (performance.now() - startTime) / 1000;

      if (elapsed >= totalDuration) {
        recorder.stop();
        onProgress?.(100);
        return;
      }

      onProgress?.(Math.min(99, Math.round((elapsed / totalDuration) * 100)));

      // Clear
      ctx.globalAlpha = 1;
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, VW, VH);

      // Determine current photo index
      const rawIndex = elapsed / timePerPhoto;
      const currentIndex = Math.min(Math.floor(rawIndex), images.length - 1);
      const nextIndex = Math.min(currentIndex + 1, images.length - 1);
      const progressInPhoto = rawIndex - currentIndex; // 0..1+

      // Ken Burns zoom: 1.0 → 1.0 + KEN_BURNS_SCALE
      const zoom = 1.0 + KEN_BURNS_SCALE * Math.min(progressInPhoto, 1);

      // Draw current photo fullscreen with zoom
      ctx.globalAlpha = 1;
      drawImageCover(ctx, images[currentIndex], 0, 0, VW, VH, zoom);

      // Crossfade to next photo
      if (currentIndex < images.length - 1) {
        const crossfadeStart = 1 - (CROSSFADE_DURATION / timePerPhoto);
        if (progressInPhoto > crossfadeStart) {
          const crossfadeProgress = (progressInPhoto - crossfadeStart) / (CROSSFADE_DURATION / timePerPhoto);
          const alpha = Math.min(1, Math.max(0, crossfadeProgress));
          ctx.globalAlpha = alpha;
          const nextZoom = 1.0 + KEN_BURNS_SCALE * (crossfadeProgress * 0.1); // slight initial zoom
          drawImageCover(ctx, images[nextIndex], 0, 0, VW, VH, nextZoom);
        }
      }

      // Text rendering
      if (text.trim() && currentIndex === textPhotoIndex) {
        const textLocalTime = progressInPhoto * timePerPhoto;
        const textAlpha = Math.min(1, textLocalTime / TEXT_FADE_DURATION);
        drawText(ctx, text, fontFamily, textColor, textAlpha);
      }

      // Fade to bg at the end
      const fadeOutStart = totalDuration - FADE_OUT_DURATION;
      if (elapsed > fadeOutStart) {
        const fadeProgress = (elapsed - fadeOutStart) / FADE_OUT_DURATION;
        ctx.globalAlpha = Math.min(1, fadeProgress);
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, VW, VH);
      }

      requestAnimationFrame(renderFrame);
    };

    requestAnimationFrame(renderFrame);
  });
}
