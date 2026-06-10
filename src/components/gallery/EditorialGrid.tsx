import React, { useMemo, useRef, useEffect, useState } from 'react';
import { GalleryPhoto } from '@/types/gallery';

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
}

/**
 * Editorial Grid Component - CSS Grid-based mosaico layout
 * 
 * Rules:
 * - peso_visual = 0: normal 1x1 block
 * - peso_visual = 1: featured 2x2 block
 * - peso_visual = 2: reserved for future large featured
 * 
 * Desktop: 4 cols base
 * Tablet: 3 cols base
 * Mobile: 2 cols base
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

  // Determine columns based on width
  const getColumns = (width: number): number => {
    if (width < 640) return 2; // Mobile
    if (width < 1024) return 3; // Tablet
    return 4; // Desktop
  };

  const columns = getColumns(internalWidth);

  // Compute grid layout with packing algorithm
  const gridCells = useMemo(() => {
    if (internalWidth <= 0 || photos.length === 0) return [];

    const cells: GridCell[] = [];
    const grid: boolean[][] = Array.from({ length: Math.ceil(photos.length * 2) }, () =>
      Array(columns).fill(false)
    );

    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      const weight = (photo as any).peso_visual || 0;
      const colSpan = weight === 1 ? 2 : 1;
      const rowSpan = weight === 1 ? 2 : 1;

      // Find first available position
      let placed = false;
      for (let row = 0; row < grid.length && !placed; row++) {
        for (let col = 0; col <= columns - colSpan && !placed; col++) {
          // Check if space is available
          let canPlace = true;
          for (let r = row; r < row + rowSpan && r < grid.length; r++) {
            for (let c = col; c < col + colSpan; c++) {
              if (grid[r][c]) {
                canPlace = false;
                break;
              }
            }
            if (!canPlace) break;
          }

          if (canPlace) {
            // Mark grid as occupied
            for (let r = row; r < row + rowSpan; r++) {
              for (let c = col; c < col + colSpan; c++) {
                grid[r][c] = true;
              }
            }
            cells.push({ photo, col, row, colSpan, rowSpan });
            placed = true;
          }
        }
      }

      // If no space found (shouldn't happen), add at end as overflow
      if (!placed) {
        cells.push({ photo, col: 0, row: grid.length, colSpan: 1, rowSpan: 1 });
      }
    }

    return cells;
  }, [photos, columns, internalWidth]);

  // Calculate grid height based on used rows
  const maxRow = gridCells.length > 0 ? Math.max(...gridCells.map(c => c.row + c.rowSpan)) : 1;

  return (
    <div
      ref={containerRef}
      className="w-full"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: `${gap}px`,
        gridAutoRows: `${(internalWidth / columns - gap * (columns - 1) / columns) / (columns === 2 ? 0.75 : 1)}px`,
      }}
    >
      {gridCells.map((cell) => {
        const style: React.CSSProperties = {
          gridColumn: `${cell.col + 1} / span ${cell.colSpan}`,
          gridRow: `${cell.row + 1} / span ${cell.rowSpan}`,
          cursor: 'pointer',
        };

        if (renderItem) {
          return renderItem(cell.photo, style);
        }

        const photoUrl =
          (cell.photo as any).previewPath || cell.photo.previewUrl || cell.photo.thumbnailUrl;

        return (
          <div
            key={cell.photo.id}
            style={style}
            onClick={() => onPhotoClick?.(cell.photo)}
            className="overflow-hidden rounded-none"
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
