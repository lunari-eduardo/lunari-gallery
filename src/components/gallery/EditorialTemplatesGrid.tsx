import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GalleryPhoto } from '@/types/gallery';
import {
  Template,
  selectTemplateBatch,
  computeStripHeight,
  orientationFromAR,
  PhotoOrientation,
} from './editorialTemplates';

interface EditorialTemplatesGridProps {
  photos: GalleryPhoto[];
  gap: number;
  onPhotoClick?: (photo: GalleryPhoto) => void;
  renderItem?: (photo: GalleryPhoto, style: React.CSSProperties) => React.ReactNode;
  containerWidth?: number;
}

interface PlannedStrip {
  height: number;
  cells: Array<{
    photo: GalleryPhoto;
    width: number;
  }>;
}

/**
 * Editorial Templates Grid — engine "revista".
 *
 * Preenche a galeria usando sequência cíclica de templates editoriais.
 * Cada strip ocupa 100% da largura por construção (justified math),
 * portanto NÃO existem espaços vazios dentro ou entre templates.
 *
 * A ordem narrativa das fotos é preservada: photos[i] entra no slot i.
 */
export const EditorialTemplatesGrid: React.FC<EditorialTemplatesGridProps> = ({
  photos,
  gap,
  onPhotoClick,
  renderItem,
  containerWidth: externalWidth,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [internalWidth, setInternalWidth] = useState(0);

  useEffect(() => {
    if (externalWidth !== undefined) {
      setInternalWidth(externalWidth);
      return;
    }
    if (!containerRef.current) return;
    const obs = new ResizeObserver((entries) => {
      for (const e of entries) setInternalWidth(e.contentRect.width);
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, [externalWidth]);

  const strips: PlannedStrip[] = useMemo(() => {
    if (internalWidth <= 0 || photos.length === 0) return [];

    const isMobile = internalWidth < 640;
    const out: PlannedStrip[] = [];
    let cursor = 0;
    let idx = 0;

    while (idx < photos.length) {
      const remaining = photos.length - idx;
      const nextPhoto = photos[idx];
      const isFeatured = ((nextPhoto as any).pesoVisual || (nextPhoto as any).peso_visual || 0) === 1;

      const { template, nextCursor } = selectTemplateBatch(
        remaining,
        cursor,
        isMobile,
        isFeatured,
      );
      cursor = nextCursor;

      const batchPhotos = photos.slice(idx, idx + template.slots.length);
      idx += template.slots.length;

      for (const strip of template.strips) {
        const h = computeStripHeight(strip, template, internalWidth, gap);
        const cells = strip.slotIndexes.map((slotIdx) => {
          const ar = template.slots[slotIdx].ar;
          return {
            photo: batchPhotos[slotIdx],
            width: h * ar,
          };
        });
        out.push({ height: h, cells });
      }
    }

    return out;
  }, [photos, internalWidth, gap]);

  return (
    <div
      ref={containerRef}
      className="w-full flex flex-col"
      style={{ gap: `${gap}px` }}
    >
      {strips.map((strip, i) => (
        <div
          key={i}
          className="flex flex-row overflow-hidden"
          style={{ gap: `${gap}px`, height: strip.height }}
        >
          {strip.cells.map((cell, ci) => {
            const style: React.CSSProperties = {
              width: cell.width,
              height: strip.height,
              flexShrink: 0,
              cursor: 'pointer',
            };
            if (!cell.photo) return null;
            if (renderItem) return renderItem(cell.photo, style);

            const url =
              (cell.photo as any).previewPath ||
              (cell.photo as any).previewUrl ||
              (cell.photo as any).thumbnailUrl;

            return (
              <div
                key={cell.photo.id ?? ci}
                style={style}
                onClick={() => onPhotoClick?.(cell.photo)}
                className="overflow-hidden"
              >
                <img
                  src={url}
                  alt={cell.photo.filename}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};
