import { ReactNode, useMemo } from 'react';
import { cn } from '@/lib/utils';

interface MasonryGridProps {
  children: ReactNode;
  className?: string;
}

export function MasonryGrid({ children, className }: MasonryGridProps) {
  return (
    <div className="masonry-container">
      <div className={cn('masonry-grid', className)}>
        {children}
      </div>
    </div>
  );
}

interface MasonryItemProps {
  children: ReactNode;
  className?: string;
  photoWidth?: number;
  photoHeight?: number;
}

const BASE_SPAN = 25;
const GAP_COMPENSATION = 1;

export function MasonryItem({ children, className, photoWidth, photoHeight }: MasonryItemProps) {
  const rowSpan = useMemo(() => {
    if (!photoWidth || !photoHeight) return BASE_SPAN + GAP_COMPENSATION;
    const aspectRatio = photoWidth / photoHeight;
    return Math.round(BASE_SPAN / aspectRatio) + GAP_COMPENSATION;
  }, [photoWidth, photoHeight]);

  return (
    <div
      className={cn('masonry-item overflow-hidden', className)}
      style={{ gridRowEnd: `span ${rowSpan}` }}
    >
      {children}
    </div>
  );
}
