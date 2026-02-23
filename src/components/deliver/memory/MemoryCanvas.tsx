import { useRef, useEffect, useState, useCallback } from 'react';
import { Download, Share2 } from 'lucide-react';
import { getPhotoUrl, PhotoPaths } from '@/lib/photoUrl';
import type { MemoryPhoto } from './MemoryPhotoSelector';

const W = 1080;
const H = 1920;
const PAD = 60;
const GAP = 8;

interface Props {
  photos: MemoryPhoto[];
  selectedIds: string[];
  highlightId?: string | null;
  text: string;
  isDark: boolean;
  sessionFont?: string;
  sessionName?: string;
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  const resp = await fetch(url);
  const blob = await resp.blob();
  const objectUrl = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(objectUrl); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Image load failed')); };
    img.src = objectUrl;
  });
}

function drawImageCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const ratio = Math.max(w / img.width, h / img.height);
  const sw = w / ratio;
  const sh = h / ratio;
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

// Reorder images so highlight is first (gets the "big" slot)
function reorderForHighlight(images: HTMLImageElement[], ids: string[], highlightId: string | null): HTMLImageElement[] {
  if (!highlightId) return images;
  const idx = ids.indexOf(highlightId);
  if (idx <= 0) return images;
  const reordered = [...images];
  const [item] = reordered.splice(idx, 1);
  reordered.unshift(item);
  return reordered;
}

interface Rect { x: number; y: number; w: number; h: number }

function getLayoutRects(count: number): Rect[] {
  const aW = W - PAD * 2;
  const aH = H * 0.65;
  const sY = PAD;

  switch (count) {
    case 1:
      return [{ x: PAD, y: sY, w: aW, h: H * 0.68 }];
    case 2: {
      const bigH = aH * 0.6;
      const smallH = aH - bigH - GAP;
      return [
        { x: PAD, y: sY, w: aW, h: bigH },
        { x: PAD, y: sY + bigH + GAP, w: aW, h: smallH },
      ];
    }
    case 3: {
      const leftW = aW * 0.6;
      const rightW = aW - leftW - GAP;
      const halfH = (aH - GAP) / 2;
      return [
        { x: PAD, y: sY, w: leftW, h: aH },
        { x: PAD + leftW + GAP, y: sY, w: rightW, h: halfH },
        { x: PAD + leftW + GAP, y: sY + halfH + GAP, w: rightW, h: halfH },
      ];
    }
    case 4: {
      const topH = aH * 0.6;
      const botH = aH - topH - GAP;
      const colW = (aW - GAP * 2) / 3;
      return [
        { x: PAD, y: sY, w: aW, h: topH },
        { x: PAD, y: sY + topH + GAP, w: colW, h: botH },
        { x: PAD + colW + GAP, y: sY + topH + GAP, w: colW, h: botH },
        { x: PAD + (colW + GAP) * 2, y: sY + topH + GAP, w: colW, h: botH },
      ];
    }
    case 5:
    default: {
      const leftW = aW * 0.6;
      const rightW = aW - leftW - GAP;
      const cellH = (aH - GAP) / 2;
      const cellW = (rightW - GAP) / 2;
      return [
        { x: PAD, y: sY, w: leftW, h: aH },
        { x: PAD + leftW + GAP, y: sY, w: cellW, h: cellH },
        { x: PAD + leftW + GAP + cellW + GAP, y: sY, w: cellW, h: cellH },
        { x: PAD + leftW + GAP, y: sY + cellH + GAP, w: cellW, h: cellH },
        { x: PAD + leftW + GAP + cellW + GAP, y: sY + cellH + GAP, w: cellW, h: cellH },
      ];
    }
  }
}

function drawTextOnCanvas(ctx: CanvasRenderingContext2D, text: string, fontFamily: string, textColor: string) {
  if (!text.trim()) return;
  const fontSize = 42;
  ctx.font = `${fontSize}px ${fontFamily}`;
  ctx.fillStyle = textColor;
  ctx.textAlign = 'center';
  const lines = wrapText(ctx, text.trim(), W - PAD * 2);
  const lineHeight = fontSize * 1.5;
  const textStartY = H - PAD - (lines.length - 1) * lineHeight - 40;
  lines.forEach((line, i) => {
    ctx.fillText(line, W / 2, textStartY + i * lineHeight);
  });
}

async function renderBlock(
  images: HTMLImageElement[],
  ids: string[],
  highlightId: string | null,
  text: string,
  bgColor: string,
  textColor: string,
  fontFamily: string,
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, W, H);

  const ordered = reorderForHighlight(images, ids, highlightId);
  const rects = getLayoutRects(ordered.length);

  ordered.forEach((img, i) => {
    if (rects[i]) drawImageCover(ctx, img, rects[i].x, rects[i].y, rects[i].w, rects[i].h);
  });

  drawTextOnCanvas(ctx, text, fontFamily, textColor);
  return canvas;
}

export function MemoryCanvas({ photos, selectedIds, highlightId, text, isDark, sessionFont, sessionName }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const hasRendered = useRef(false);
  const [rendering, setRendering] = useState(false);
  const [canvases, setCanvases] = useState<HTMLCanvasElement[]>([]);

  const bgColor = isDark ? '#1C1917' : '#FAF9F7';
  const textColor = isDark ? '#F5F5F4' : '#2D2A26';
  const fontFamily = sessionFont || 'Georgia, serif';
  const selectedKey = selectedIds.join(',');

  const render = useCallback(async () => {
    const selectedPhotos = selectedIds.map(id => photos.find(p => p.id === id)).filter(Boolean) as MemoryPhoto[];
    if (selectedPhotos.length === 0) return;
    setRendering(true);

    // Load all images
    const allImages: HTMLImageElement[] = [];
    for (const photo of selectedPhotos) {
      const paths: PhotoPaths = {
        storageKey: photo.storageKey,
        previewPath: photo.previewPath,
        width: photo.width,
        height: photo.height,
      };
      try {
        allImages.push(await loadImage(getPhotoUrl(paths, 'preview')));
      } catch { /* skip */ }
    }
    if (allImages.length === 0) { setRendering(false); return; }

    const results: HTMLCanvasElement[] = [];

    if (allImages.length <= 5) {
      // Single image
      results.push(await renderBlock(allImages, selectedIds, highlightId ?? null, text, bgColor, textColor, fontFamily));
    } else {
      // Split into 2 blocks
      const mid = Math.ceil(allImages.length / 2);
      const block1Imgs = allImages.slice(0, mid);
      const block1Ids = selectedIds.slice(0, mid);
      const block2Imgs = allImages.slice(mid);
      const block2Ids = selectedIds.slice(mid);

      results.push(await renderBlock(block1Imgs, block1Ids, highlightId ?? null, text, bgColor, textColor, fontFamily));
      results.push(await renderBlock(block2Imgs, block2Ids, highlightId ?? null, '', bgColor, textColor, fontFamily));
    }

    setCanvases(results);
    setRendering(false);
    hasRendered.current = true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey, text, highlightId, bgColor, textColor, fontFamily]);

  useEffect(() => {
    if (!hasRendered.current) render();
  }, [render]);

  // Mount canvases to DOM
  useEffect(() => {
    const container = containerRef.current;
    if (!container || canvases.length === 0) return;
    container.innerHTML = '';
    canvases.forEach((c) => {
      c.style.width = '100%';
      c.style.height = 'auto';
      c.style.borderRadius = '2px';
      container.appendChild(c);
    });
  }, [canvases]);

  const getBlobs = async (): Promise<Blob[]> => {
    return Promise.all(canvases.map(c => new Promise<Blob>((res, rej) => {
      c.toBlob(b => b ? res(b) : rej(), 'image/png');
    })));
  };

  const handleDownload = async () => {
    try {
      const blobs = await getBlobs();
      blobs.forEach((blob, i) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = blobs.length > 1 ? `lembranca-${i + 1}.png` : 'lembranca.png';
        a.click();
        URL.revokeObjectURL(url);
      });
    } catch { /* ignore */ }
  };

  const handleShare = async () => {
    try {
      const blobs = await getBlobs();
      const files = blobs.map((b, i) =>
        new File([b], blobs.length > 1 ? `lembranca-${i + 1}.png` : 'lembranca.png', { type: 'image/png' })
      );
      if (navigator.canShare && navigator.canShare({ files })) {
        await navigator.share({ files, title: sessionName || 'Lembrança' });
      } else {
        handleDownload();
      }
    } catch {
      handleDownload();
    }
  };

  const canShare = typeof navigator !== 'undefined' && !!navigator.share;

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      <div ref={containerRef} className="w-full max-w-xs mx-auto flex flex-col gap-4" style={{ minHeight: canvases.length === 0 ? 200 : undefined }} />

      {rendering && (
        <p className="text-sm opacity-70" style={{ color: isDark ? '#A8A29E' : '#78716C' }}>
          Gerando...
        </p>
      )}

      {canvases.length > 0 && !rendering && (
        <div className="flex gap-3">
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-5 py-2.5 text-sm tracking-wide transition-all duration-300"
            style={{
              backgroundColor: isDark ? '#F5F5F4' : '#1C1917',
              color: isDark ? '#1C1917' : '#F5F5F4',
            }}
          >
            <Download className="w-4 h-4" />
            Salvar
          </button>
          {canShare && (
            <button
              onClick={handleShare}
              className="flex items-center gap-2 px-5 py-2.5 text-sm tracking-wide transition-all duration-300 border"
              style={{
                borderColor: isDark ? '#44403C' : '#D6D3D1',
                color: isDark ? '#F5F5F4' : '#1C1917',
                backgroundColor: 'transparent',
              }}
            >
              <Share2 className="w-4 h-4" />
              Compartilhar
            </button>
          )}
        </div>
      )}
    </div>
  );
}
