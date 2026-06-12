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

    const layoutRows: LayoutRow[] = [];
    let currentRow: LayoutItem[] = [];
    let currentRowWidth = 0;

    const FEATURED_MULTIPLIER = 1.8;

    photos.forEach((photo) => {
      const weight = (photo as any).pesoVisual || (photo as any).peso_visual || 0;
      const isFeatured = weight === 1;

      const aspectRatio = photo.width && photo.height ? photo.width / photo.height : 1.5;
      const baseWidth = effectiveRowHeight * aspectRatio;
      const virtualWidth = isFeatured ? baseWidth * FEATURED_MULTIPLIER : baseWidth;

      if (currentRowWidth + virtualWidth > internalWidth && currentRow.length >= minItemsPerRow) {
        const rowGaps = (currentRow.length - 1) * gap;
        const sumAspectRatios = currentRow.reduce((acc, item) => {
          const ratio = item.photo.width && item.photo.height ? item.photo.width / item.photo.height : 1.5;
          return acc + (item.isFeatured ? ratio * FEATURED_MULTIPLIER : ratio);
        }, 0);

        const finalHeight = (internalWidth - rowGaps) / sumAspectRatios;

        layoutRows.push({
          items: currentRow.map(item => {
            const ratio = item.photo.width && item.photo.height ? item.photo.width / item.photo.height : 1.5;
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
    // Evita "área vazia" à direita interpretada como erro de carregamento.
    // Se houver apenas 1 foto sobrando, é forçada a ocupar a largura total
    // mantendo seu aspect-ratio (crop por object-cover quando necessário).
    if (currentRow.length > 0) {
      const rowGaps = (currentRow.length - 1) * gap;
      const sumAspectRatios = currentRow.reduce((acc, item) => {
        const ratio = item.photo.width && item.photo.height ? item.photo.width / item.photo.height : 1.5;
        return acc + (item.isFeatured ? ratio * FEATURED_MULTIPLIER : ratio);
      }, 0);

      // Cap: se a altura final fosse desproporcional (linha solitária com 1 foto vertical),
      // limitamos pela altura média das linhas anteriores * 1.4 para não dominar a tela.
      let finalHeight = (internalWidth - rowGaps) / sumAspectRatios;
      if (currentRow.length === 1 && layoutRows.length > 0) {
        const avgPrev = layoutRows.reduce((a, r) => a + r.rowHeight, 0) / layoutRows.length;
        const cap = Math.min(finalHeight, avgPrev * 1.6);
        finalHeight = Math.max(cap, effectiveRowHeight);
      }

      layoutRows.push({
        items: currentRow.map(item => {
          const ratio = item.photo.width && item.photo.height ? item.photo.width / item.photo.height : 1.5;
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
  }, [photos, internalWidth, gap, targetRowHeight]);

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
