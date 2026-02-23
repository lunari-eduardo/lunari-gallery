/**
 * MemoryVideoEngine – client-side 9:16 video generator
 * Supports slideshow (1-5 photos) and animated collage (6-10 photos)
 */

const VW = 1080;
const VH = 1920;
const FPS = 30;
const CROSSFADE_DURATION = 0.5;
const TEXT_FADE_DURATION = 0.6;
const FADE_OUT_DURATION = 0.8;
const KEN_BURNS_SCALE = 0.08;
const COLLAGE_KEN_BURNS = 0.04;
const COLLAGE_PAN_X = 20;
const COLLAGE_PAN_Y = 15;
const COLLAGE_GAP = 4;

// ── Timeline config (slideshow 1-5) ────────────────────────────

interface TimelineConfig {
  totalDuration: number;
  timePerPhoto: number;
  textPhotoIndex: number;
}

function getTimelineConfig(photoCount: number): TimelineConfig {
  switch (photoCount) {
    case 1: return { totalDuration: 6, timePerPhoto: 6, textPhotoIndex: 0 };
    case 2: return { totalDuration: 8, timePerPhoto: 4, textPhotoIndex: 1 };
    case 3: return { totalDuration: 9, timePerPhoto: 3, textPhotoIndex: 1 };
    case 4: return { totalDuration: 10, timePerPhoto: 2.5, textPhotoIndex: 2 };
    case 5: return { totalDuration: 10, timePerPhoto: 2, textPhotoIndex: 2 };
    default: return { totalDuration: 10, timePerPhoto: 2, textPhotoIndex: 2 };
  }
}

// ── Drawing helpers ─────────────────────────────────────────────

function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number, y: number,
  w: number, h: number,
  zoom: number = 1,
  offsetX: number = 0,
  offsetY: number = 0,
) {
  const scale = Math.max(w / img.width, h / img.height) * zoom;
  const sw = w / scale;
  const sh = h / scale;
  const sx = (img.width - sw) / 2 - offsetX / scale;
  const sy = (img.height - sh) / 2 - offsetY / scale;
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

function drawCollageText(
  ctx: CanvasRenderingContext2D,
  text: string,
  fontFamily: string,
  alpha: number,
) {
  if (!text.trim() || alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;

  // Semi-transparent overlay band
  const bandH = 260;
  const bandY = (VH - bandH) / 2;
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(0, bandY, VW, bandH);

  const fontSize = 40;
  ctx.font = `${fontSize}px ${fontFamily}`;
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 8;

  const maxWidth = VW - 120;
  const lines = wrapText(ctx, text.trim(), maxWidth);
  const lineHeight = fontSize * 1.5;
  const totalH = lines.length * lineHeight;
  const startY = VH / 2 - totalH / 2 + lineHeight / 2;
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

// ── Collage grid layouts ────────────────────────────────────────

interface Cell { x: number; y: number; w: number; h: number; isLarge: boolean }

function calculateCollageGrid(count: number, highlightIndex: number): Cell[] {
  const g = COLLAGE_GAP;
  const cells: Cell[] = [];

  switch (count) {
    case 6: {
      // 2x3
      const cw = (VW - g) / 2;
      const ch = (VH - g * 2) / 3;
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 2; c++) {
          cells.push({ x: c * (cw + g), y: r * (ch + g), w: cw, h: ch, isLarge: false });
        }
      }
      break;
    }
    case 7: {
      // 1 large top (40%) + 3+3 bottom
      const topH = VH * 0.4 - g;
      const botH = (VH * 0.6 - g) / 2;
      const colW = (VW - g * 2) / 3;
      cells.push({ x: 0, y: 0, w: VW, h: topH, isLarge: true });
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 3; c++) {
          cells.push({ x: c * (colW + g), y: topH + g + r * (botH + g), w: colW, h: botH, isLarge: false });
        }
      }
      break;
    }
    case 8: {
      // 2x4
      const cw = (VW - g) / 2;
      const ch = (VH - g * 3) / 4;
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 2; c++) {
          cells.push({ x: c * (cw + g), y: r * (ch + g), w: cw, h: ch, isLarge: false });
        }
      }
      break;
    }
    case 9: {
      // 3x3
      const cs = (VW - g * 2) / 3;
      const ch = (VH - g * 2) / 3;
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          cells.push({ x: c * (cs + g), y: r * (ch + g), w: cs, h: ch, isLarge: false });
        }
      }
      break;
    }
    case 10:
    default: {
      // 2 large top + 2 rows of 4 bottom
      const topH = VH * 0.35 - g;
      const topW = (VW - g) / 2;
      const botH = (VH * 0.65 - g) / 2;
      const botW = (VW - g * 3) / 4;
      cells.push({ x: 0, y: 0, w: topW, h: topH, isLarge: true });
      cells.push({ x: topW + g, y: 0, w: topW, h: topH, isLarge: true });
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 4; c++) {
          cells.push({ x: c * (botW + g), y: topH + g + r * (botH + g), w: botW, h: botH, isLarge: false });
        }
      }
      break;
    }
  }

  // Move highlight to the first large cell if applicable
  if (highlightIndex > 0 && cells.some(c => c.isLarge)) {
    const largeIdx = cells.findIndex(c => c.isLarge);
    if (largeIdx >= 0 && largeIdx !== highlightIndex) {
      // Swap cells
      [cells[largeIdx], cells[highlightIndex]] = [cells[highlightIndex], cells[largeIdx]];
    }
  }

  return cells;
}

// ── Main engine ─────────────────────────────────────────────────

export interface VideoGenerateOptions {
  images: HTMLImageElement[];
  text: string;
  isDark: boolean;
  fontFamily: string;
  highlightIndex?: number;
  onProgress?: (pct: number) => void;
}

export async function generateVideo(opts: VideoGenerateOptions): Promise<Blob> {
  const { images, text, isDark, fontFamily, highlightIndex = 0, onProgress } = opts;

  if (images.length >= 6) {
    return generateCollageVideo(opts);
  }

  // ── Slideshow mode (1-5 photos) ──
  const config = getTimelineConfig(images.length);
  const { totalDuration, timePerPhoto, textPhotoIndex } = config;
  const bgColor = isDark ? '#1C1917' : '#FAF9F7';
  const textColor = isDark ? '#F5F5F4' : '#2D2A26';

  const canvas = document.createElement('canvas');
  canvas.width = VW;
  canvas.height = VH;
  const ctx = canvas.getContext('2d')!;

  const stream = canvas.captureStream(FPS);
  const mimeType = pickMimeType();
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 4_000_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

  return new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }));
    recorder.onerror = () => reject(new Error('MediaRecorder error'));
    recorder.start();
    const startTime = performance.now();

    const renderFrame = () => {
      const elapsed = (performance.now() - startTime) / 1000;
      if (elapsed >= totalDuration) { recorder.stop(); onProgress?.(100); return; }
      onProgress?.(Math.min(99, Math.round((elapsed / totalDuration) * 100)));

      ctx.globalAlpha = 1;
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, VW, VH);

      const rawIndex = elapsed / timePerPhoto;
      const currentIndex = Math.min(Math.floor(rawIndex), images.length - 1);
      const nextIndex = Math.min(currentIndex + 1, images.length - 1);
      const progressInPhoto = rawIndex - currentIndex;
      const zoom = 1.0 + KEN_BURNS_SCALE * Math.min(progressInPhoto, 1);

      ctx.globalAlpha = 1;
      drawImageCover(ctx, images[currentIndex], 0, 0, VW, VH, zoom);

      if (currentIndex < images.length - 1) {
        const crossfadeStart = 1 - (CROSSFADE_DURATION / timePerPhoto);
        if (progressInPhoto > crossfadeStart) {
          const alpha = Math.min(1, Math.max(0, (progressInPhoto - crossfadeStart) / (CROSSFADE_DURATION / timePerPhoto)));
          ctx.globalAlpha = alpha;
          drawImageCover(ctx, images[nextIndex], 0, 0, VW, VH, 1.0 + KEN_BURNS_SCALE * alpha * 0.1);
        }
      }

      if (text.trim() && currentIndex === textPhotoIndex) {
        const textAlpha = Math.min(1, (progressInPhoto * timePerPhoto) / TEXT_FADE_DURATION);
        drawText(ctx, text, fontFamily, textColor, textAlpha);
      }

      const fadeOutStart = totalDuration - FADE_OUT_DURATION;
      if (elapsed > fadeOutStart) {
        ctx.globalAlpha = Math.min(1, (elapsed - fadeOutStart) / FADE_OUT_DURATION);
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, VW, VH);
      }

      requestAnimationFrame(renderFrame);
    };
    requestAnimationFrame(renderFrame);
  });
}

// ── Collage mode (6-10 photos) ──────────────────────────────────

async function generateCollageVideo(opts: VideoGenerateOptions): Promise<Blob> {
  const { images, text, isDark, fontFamily, highlightIndex = 0, onProgress } = opts;

  const totalDuration = 10;
  const bgColor = isDark ? '#1C1917' : '#FAF9F7';
  const cells = calculateCollageGrid(images.length, highlightIndex);

  const canvas = document.createElement('canvas');
  canvas.width = VW;
  canvas.height = VH;
  const ctx = canvas.getContext('2d')!;

  const stream = canvas.captureStream(FPS);
  const mimeType = pickMimeType();
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 5_000_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

  return new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }));
    recorder.onerror = () => reject(new Error('MediaRecorder error'));
    recorder.start();
    const startTime = performance.now();

    const renderFrame = () => {
      const elapsed = (performance.now() - startTime) / 1000;
      if (elapsed >= totalDuration) { recorder.stop(); onProgress?.(100); return; }
      onProgress?.(Math.min(99, Math.round((elapsed / totalDuration) * 100)));

      ctx.globalAlpha = 1;
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, VW, VH);

      // Draw each cell with independent movement
      cells.forEach((cell, i) => {
        if (i >= images.length) return;

        const seed = i * 137;
        const moveType = seed % 3;
        const speed = 0.8 + (seed % 5) * 0.1;
        const progress = (elapsed * speed) / totalDuration;

        ctx.save();
        ctx.beginPath();
        ctx.rect(cell.x, cell.y, cell.w, cell.h);
        ctx.clip();

        let zoom = 1.0;
        let offsetX = 0;
        let offsetY = 0;

        if (moveType === 0) {
          // Slow zoom
          zoom = 1.0 + COLLAGE_KEN_BURNS * progress;
        } else if (moveType === 1) {
          // Horizontal pan
          offsetX = COLLAGE_PAN_X * progress * (i % 2 === 0 ? 1 : -1);
        } else {
          // Vertical pan
          offsetY = COLLAGE_PAN_Y * progress * (i % 2 === 0 ? 1 : -1);
        }

        drawImageCover(ctx, images[i], cell.x, cell.y, cell.w, cell.h, zoom, offsetX, offsetY);
        ctx.restore();
      });

      // Text overlay (appears at 40% of duration)
      if (text.trim() && elapsed > totalDuration * 0.4) {
        const textProgress = (elapsed - totalDuration * 0.4) / TEXT_FADE_DURATION;
        const textAlpha = Math.min(1, textProgress);
        drawCollageText(ctx, text, fontFamily, textAlpha);
      }

      // Fade out
      const fadeOutStart = totalDuration - FADE_OUT_DURATION;
      if (elapsed > fadeOutStart) {
        ctx.globalAlpha = Math.min(1, (elapsed - fadeOutStart) / FADE_OUT_DURATION);
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, VW, VH);
      }

      requestAnimationFrame(renderFrame);
    };
    requestAnimationFrame(renderFrame);
  });
}
