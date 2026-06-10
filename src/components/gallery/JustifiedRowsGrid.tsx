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

    const layoutRows: LayoutRow[] = [];
    let currentRow: LayoutItem[] = [];
    let currentRowWidth = 0;

    // Use a multiplier for featured photos to make them "heavier" in the row calculation
    const FEATURED_MULTIPLIER = 1.8;

    photos.forEach((photo) => {
      // Read peso_visual from photo (set by fotógrafo in backend)
      // peso_visual: 0 = normal, 1 = featured (2x in justified rows)
      const isFeatured = (photo as any).peso_visual === 1;


      // Calculate initial width at targetRowHeight
      const aspectRatio = photo.width && photo.height ? photo.width / photo.height : 1.5;
      const baseWidth = targetRowHeight * aspectRatio;
      const virtualWidth = isFeatured ? baseWidth * FEATURED_MULTIPLIER : baseWidth;

      // If adding this item exceeds container width, finalize row
      if (currentRowWidth + virtualWidth > internalWidth && currentRow.length > 0) {
        // Calculate the height that would make this row exactly internalWidth
        // Width = Height * sum(aspectRatio_i) + (n-1)*gap
        // Height = (internalWidth - (n-1)*gap) / sum(aspectRatio_i)
        
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
              width: finalHeight * (item.isFeatured ? ratio * FEATURED_MULTIPLIER : ratio)
            };
          }),
          rowHeight: finalHeight
        });

        currentRow = [];
        currentRowWidth = 0;
      }

      currentRow.push({ photo, width: virtualWidth, height: targetRowHeight, isFeatured });
      currentRowWidth += virtualWidth + gap;
    });

    // Handle last row (usually not justified to full width to avoid huge photos)
    if (currentRow.length > 0) {
      layoutRows.push({
        items: currentRow.map(item => {
          const ratio = item.photo.width && item.photo.height ? item.photo.width / item.photo.height : 1.5;
          return {
            ...item,
            width: targetRowHeight * (item.isFeatured ? ratio * FEATURED_MULTIPLIER : ratio),
            height: targetRowHeight
          };
        }),
        rowHeight: targetRowHeight
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
