import React, { useMemo, useRef, useEffect, useState } from 'react';
import { GalleryPhoto } from '@/types/gallery';
import { cn } from '@/lib/utils';

interface EditorialGridProps {
  photos: GalleryPhoto[];
  gap: number;
  onPhotoClick?: (photo: GalleryPhoto) => void;
  renderItem?: (photo: GalleryPhoto, style: React.CSSProperties) => React.ReactNode;
  containerWidth?: number;
}

interface GridCell {
  photo: GalleryPhoto;
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
  height: number;
}

/**
 * Editorial Grid Component - Masonry-style using CSS Grid
 * Preserves photo aspect ratio without cropping.
 */
export const EditorialGrid: React.FC<EditorialGridProps> = ({
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
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setInternalWidth(entry.contentRect.width);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [externalWidth]);

  const columns = useMemo(() => {
    if (internalWidth < 640) return 2;
    if (internalWidth < 1024) return 3;
    return 4;
  }, [internalWidth]);

  const gridCells = useMemo(() => {
    if (internalWidth <= 0 || photos.length === 0) return [];

    const cells: GridCell[] = [];
    const colHeights = new Array(columns).fill(0);
    const columnWidth = (internalWidth - gap * (columns - 1)) / columns;

    photos.forEach((photo) => {
      const weight = (photo as any).pesoVisual || (photo as any).peso_visual || 0;
      const colSpan = weight === 1 && columns > 1 ? 2 : 1;
      
      // Find the column(s) with minimum height
      let bestCol = 0;
      let minHeight = Infinity;
      
      for (let c = 0; c <= columns - colSpan; c++) {
        const maxHeightInSpan = Math.max(...colHeights.slice(c, c + colSpan));
        if (maxHeightInSpan < minHeight) {
          minHeight = maxHeightInSpan;
          bestCol = c;
        }
      }

      const aspectRatio = photo.width && photo.height ? photo.width / photo.height : 1.5;
      const actualWidth = columnWidth * colSpan + (colSpan > 1 ? gap : 0);
      const height = actualWidth / aspectRatio;

      cells.push({
        photo,
        col: bestCol,
        row: 0, // Not strictly used for CSS Grid Masonry positioning via style
        colSpan,
        rowSpan: 1,
        height
      });

      // Update heights for all columns spanned
      const newHeight = minHeight + height + gap;
      for (let c = bestCol; c < bestCol + colSpan; c++) {
        colHeights[c] = newHeight;
      }
    });

    return { cells, totalHeight: Math.max(...colHeights) };
  }, [photos, columns, internalWidth, gap]);

  return (
    <div
      ref={containerRef}
      className="w-full relative"
      style={{ 
        height: `${gridCells.totalHeight}px`,
      }}
    >
      {gridCells.cells?.map((cell, idx) => {
        const columnWidth = (internalWidth - gap * (columns - 1)) / columns;
        const left = cell.col * (columnWidth + gap);
        
        // Find top offset for this cell (we need to recalculate or store it)
        // For simplicity in this layout, we'll use absolute positioning for true masonry
        let top = 0;
        const colHeights = new Array(columns).fill(0);
        for(let i=0; i<idx; i++) {
          const c = gridCells.cells[i];
          const h = c.height + gap;
          for(let col=c.col; col < c.col + c.colSpan; col++) {
            colHeights[col] += h;
          }
        }
        top = Math.max(...colHeights.slice(cell.col, cell.col + cell.colSpan));

        const style: React.CSSProperties = {
          position: 'absolute',
          left: `${left}px`,
          top: `${top}px`,
          width: `${columnWidth * cell.colSpan + (cell.colSpan > 1 ? gap : 0)}px`,
          height: `${cell.height}px`,
          cursor: 'pointer',
        };

        if (renderItem) {
          return renderItem(cell.photo, style);
        }

        const photoUrl = (cell.photo as any).previewPath || (cell.photo as any).previewUrl || (cell.photo as any).thumbnailUrl;

        return (
          <div
            key={cell.photo.id}
            style={style}
            onClick={() => onPhotoClick?.(cell.photo)}
            className="overflow-hidden"
          >
            <img
              src={photoUrl}
              alt={cell.photo.filename}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        );
      })}
    </div>
  );
};