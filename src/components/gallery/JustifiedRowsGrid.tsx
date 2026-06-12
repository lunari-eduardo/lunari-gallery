import React, { useMemo, useEffect, useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import { GalleryPhoto } from '@/types/gallery';

interface JustifiedRowsGridProps {
  photos: GalleryPhoto[];
  gap: number;
  targetRowHeight: number;
  onPhotoClick?: (photo: GalleryPhoto) => void;
  renderItem?: (photo: GalleryPhoto, style: React.CSSProperties) => React.ReactNode;
  containerWidth?: number;
  /** Quando false, ignora pesoVisual e nunca amplia fotos destacadas. Default: true. */
  featuredEnabled?: boolean;
  /** Quando definido, força N colunas por breakpoint preservando ordem e proporção. */
  fixedColumns?: { mobile: number; tablet: number; desktop: number };
}

interface LayoutItem {
  photo: GalleryPhoto;
  width: number;
  height: number;
  isFeatured: boolean;
}

interface LayoutRow {
  items: LayoutItem[];
  rowHeight: number;
}

export const JustifiedRowsGrid: React.FC<JustifiedRowsGridProps> = ({
  photos,
  gap,
  targetRowHeight,
  onPhotoClick,
  renderItem,
  containerWidth: externalWidth,
  featuredEnabled = true,
  fixedColumns,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [internalWidth, setInternalWidth] = useState(0);

  useEffect(() => {
    if (externalWidth !== undefined) {
      setInternalWidth(externalWidth);
      return;
    }

    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setInternalWidth(entry.contentRect.width);
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [externalWidth]);

  const rows = useMemo(() => {
    if (internalWidth <= 0 || photos.length === 0) return [];

    const isMobile = internalWidth < 500;
    const effectiveRowHeight = isMobile ? Math.max(220, internalWidth * 0.55) : targetRowHeight;
    const minItemsPerRow = isMobile ? 1 : 2;

    const ratioOf = (p: GalleryPhoto) =>
      p.width && p.height ? p.width / p.height : 1.5;

    // ============ MODO COLUNAS FIXAS (Clean) ============
    // Particiona fotos na ordem original em chunks de N colunas e justifica
    // cada chunk preservando proporção de cada item. Última linha parcial
    // herda altura média e fica alinhada à esquerda sem buracos visíveis.
    if (fixedColumns) {
      const cols = internalWidth < 640
        ? fixedColumns.mobile
        : internalWidth < 1024
        ? fixedColumns.tablet
        : fixedColumns.desktop;

      const chunks: GalleryPhoto[][] = [];
      for (let i = 0; i < photos.length; i += cols) {
        chunks.push(photos.slice(i, i + cols));
      }

      const fullChunks = chunks.filter(c => c.length === cols);
      const avgRatio = fullChunks.length > 0
        ? fullChunks.reduce((acc, c) => acc + c.reduce((a, p) => a + ratioOf(p), 0), 0)
          / (fullChunks.length * cols)
        : 1.5;

      const layoutRows: LayoutRow[] = chunks.map((chunk) => {
        const N = chunk.length;
        const sumRatio = chunk.reduce((a, p) => a + ratioOf(p), 0);
        const rowGaps = (cols - 1) * gap;
        const denom = N === cols
          ? sumRatio
          : sumRatio + (cols - N) * avgRatio;
        const rowHeight = (internalWidth - rowGaps) / denom;
        return {
          rowHeight,
          items: chunk.map(p => ({
            photo: p,
            isFeatured: false,
            height: rowHeight,
            width: rowHeight * ratioOf(p),
          })),
        };
      });

      return layoutRows;
    }

    // ============ MODO JUSTIFICADO PADRÃO ============
    const layoutRows: LayoutRow[] = [];
    let currentRow: LayoutItem[] = [];
    let currentRowWidth = 0;

    const FEATURED_MULTIPLIER = 1.8;

    photos.forEach((photo) => {
      const weight = (photo as any).pesoVisual || (photo as any).peso_visual || 0;
      const isFeatured = featuredEnabled && weight === 1;

      const aspectRatio = ratioOf(photo);
      const baseWidth = effectiveRowHeight * aspectRatio;
      const virtualWidth = isFeatured ? baseWidth * FEATURED_MULTIPLIER : baseWidth;

      if (currentRowWidth + virtualWidth > internalWidth && currentRow.length >= minItemsPerRow) {
        const rowGaps = (currentRow.length - 1) * gap;
        const sumAspectRatios = currentRow.reduce((acc, item) => {
          const ratio = ratioOf(item.photo);
          return acc + (item.isFeatured ? ratio * FEATURED_MULTIPLIER : ratio);
        }, 0);

        const finalHeight = (internalWidth - rowGaps) / sumAspectRatios;

        layoutRows.push({
          items: currentRow.map(item => {
            const ratio = ratioOf(item.photo);
            return {
              ...item,
              height: finalHeight,
              width: finalHeight * (item.isFeatured ? ratio * FEATURED_MULTIPLIER : ratio),
            };
          }),
          rowHeight: finalHeight,
        });

        currentRow = [];
        currentRowWidth = 0;
      }

      currentRow.push({ photo, width: virtualWidth, height: effectiveRowHeight, isFeatured });
      currentRowWidth += virtualWidth + gap;
    });

    // Última linha: SEMPRE justificada para preencher 100% da largura.
    if (currentRow.length > 0) {
      const rowGaps = (currentRow.length - 1) * gap;
      const sumAspectRatios = currentRow.reduce((acc, item) => {
        const ratio = ratioOf(item.photo);
        return acc + (item.isFeatured ? ratio * FEATURED_MULTIPLIER : ratio);
      }, 0);

      let finalHeight = (internalWidth - rowGaps) / sumAspectRatios;
      if (currentRow.length === 1 && layoutRows.length > 0) {
        const avgPrev = layoutRows.reduce((a, r) => a + r.rowHeight, 0) / layoutRows.length;
        const cap = Math.min(finalHeight, avgPrev * 1.6);
        finalHeight = Math.max(cap, effectiveRowHeight);
      }

      layoutRows.push({
        items: currentRow.map(item => {
          const ratio = ratioOf(item.photo);
          return {
            ...item,
            height: finalHeight,
            width: finalHeight * (item.isFeatured ? ratio * FEATURED_MULTIPLIER : ratio),
          };
        }),
        rowHeight: finalHeight,
      });
    }

    return layoutRows;
  }, [photos, internalWidth, gap, targetRowHeight, featuredEnabled, fixedColumns]);

  return (
    <div 
      ref={containerRef} 
      className="w-full flex flex-col" 
      style={{ gap: `${gap}px` }}
    >
      {rows.map((row, rowIndex) => (
        <div 
          key={rowIndex} 
          className="flex flex-row overflow-hidden" 
          style={{ gap: `${gap}px`, height: row.rowHeight }}
        >
          {row.items.map((item) => {
            const style: React.CSSProperties = {
              width: item.width,
              height: item.height,
              flexShrink: 0,
              cursor: 'pointer'
            };

            if (renderItem) {
              return renderItem(item.photo, style);
            }

            // Fallback render (important for theme previews with demo photos)
            const photoUrl = (item.photo as any).previewPath || item.photo.previewUrl || item.photo.thumbnailUrl;

            return (
              <div 
                key={item.photo.id} 
                style={style}
                onClick={() => onPhotoClick?.(item.photo)}
                className="overflow-hidden"
              >
                <img
                  src={photoUrl}
                  alt={item.photo.filename}
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
