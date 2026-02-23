import { useRef, useEffect, useState, useCallback } from 'react';
import { Download, Share2 } from 'lucide-react';
import { getPhotoUrl, PhotoPaths } from '@/lib/photoUrl';
import type { MemoryPhoto } from './MemoryPhotoSelector';
import type { MemoryLayout } from './MemoryLayoutPicker';

const W = 1080;
const H = 1920;
const PAD = 60;

interface Props {
  photos: MemoryPhoto[];
  selectedIds: string[];
  text: string;
  layout: MemoryLayout;
  isDark: boolean;
  sessionFont?: string;
  sessionName?: string;
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  // Fetch as blob to avoid CORS tainted canvas
  const resp = await fetch(url);
  const blob = await resp.blob();
  const objectUrl = URL.createObjectURL(blob);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Image load failed'));
    };
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

export function MemoryCanvas({ photos, selectedIds, text, layout, isDark, sessionFont, sessionName }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hasRendered = useRef(false);
  const [rendering, setRendering] = useState(false);
  const [rendered, setRendered] = useState(false);

  const bgColor = isDark ? '#1C1917' : '#FAF9F7';
  const textColor = isDark ? '#F5F5F4' : '#2D2A26';
  const fontFamily = sessionFont || 'Georgia, serif';

  // Stable key for dependencies
  const selectedKey = selectedIds.join(',');

  const render = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Resolve photos inside callback to avoid unstable dependency
    const selectedPhotos = selectedIds
      .map(id => photos.find(p => p.id === id))
      .filter(Boolean) as MemoryPhoto[];

    if (selectedPhotos.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setRendering(true);

    // Background
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, W, H);

    // Load images via fetch->blob->objectURL (no CORS issues)
    const images: HTMLImageElement[] = [];
    for (const photo of selectedPhotos) {
      const paths: PhotoPaths = {
        storageKey: photo.storageKey,
        previewPath: photo.previewPath,
        width: photo.width,
        height: photo.height,
      };
      try {
        const img = await loadImage(getPhotoUrl(paths, 'preview'));
        images.push(img);
      } catch {
        // skip failed
      }
    }

    if (images.length === 0) {
      setRendering(false);
      return;
    }

    // Draw layout
    const gap = 8;
    if (layout === 'solo' || images.length === 1) {
      const photoH = H * 0.68;
      const photoY = PAD;
      drawImageCover(ctx, images[0], PAD, photoY, W - PAD * 2, photoH);
    } else if (layout === 'dupla' && images.length >= 2) {
      const photoH = (H * 0.6 - gap) / 2;
      const startY = PAD;
      drawImageCover(ctx, images[0], PAD, startY, W - PAD * 2, photoH);
      drawImageCover(ctx, images[1], PAD, startY + photoH + gap, W - PAD * 2, photoH);
    } else if (layout === 'colagem' && images.length >= 2) {
      const areaW = W - PAD * 2;
      const areaH = H * 0.65;
      const startY = PAD;
      const half = (areaW - gap) / 2;
      drawImageCover(ctx, images[0], PAD, startY, half, areaH);
      const rightX = PAD + half + gap;
      if (images.length === 2) {
        drawImageCover(ctx, images[1], rightX, startY, half, areaH);
      } else if (images.length === 3) {
        const topH = (areaH - gap) / 2;
        drawImageCover(ctx, images[1], rightX, startY, half, topH);
        drawImageCover(ctx, images[2], rightX, startY + topH + gap, half, topH);
      } else {
        const topH = (areaH - gap) / 2;
        drawImageCover(ctx, images[1], rightX, startY, half, topH);
        const bottomW = (half - gap) / 2;
        drawImageCover(ctx, images[2], rightX, startY + topH + gap, bottomW, topH);
        drawImageCover(ctx, images[3], rightX + bottomW + gap, startY + topH + gap, bottomW, topH);
      }
    }

    // Draw text
    if (text.trim()) {
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

    setRendering(false);
    setRendered(true);
    hasRendered.current = true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey, text, layout, bgColor, textColor, fontFamily]);

  useEffect(() => {
    if (!hasRendered.current) {
      render();
    }
  }, [render]);

  const getBlob = (): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const canvas = canvasRef.current;
      if (!canvas) return reject();
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject();
      }, 'image/png');
    });
  };

  const handleDownload = async () => {
    try {
      const blob = await getBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'lembranca.png';
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* ignore */ }
  };

  const handleShare = async () => {
    try {
      const blob = await getBlob();
      const file = new File([blob], 'lembranca.png', { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: sessionName || 'Lembrança',
        });
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
      <div className="w-full max-w-xs mx-auto" style={{ aspectRatio: '9/16' }}>
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="w-full h-full"
          style={{ borderRadius: 2 }}
        />
      </div>

      {rendering && (
        <p className="text-sm opacity-70" style={{ color: isDark ? '#A8A29E' : '#78716C' }}>
          Gerando...
        </p>
      )}

      {rendered && !rendering && (
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
