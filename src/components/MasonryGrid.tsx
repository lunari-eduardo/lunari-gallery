import { ReactNode, ReactElement, useState, useEffect, useMemo, Children, isValidElement } from 'react';
import { cn } from '@/lib/utils';

interface MasonryGridProps {
  children: ReactNode;
  className?: string;
  gap?: number;
  forcedCols?: number;
}

export function MasonryGrid({ children, className, gap = 6, forcedCols }: MasonryGridProps) {
  const [containerWidth, setContainerWidth] = useState(1200);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const numCols = useMemo(() => {
    if (forcedCols) return forcedCols;
    if (containerWidth < 480) return 2;
    if (containerWidth < 768) return 3;
    if (containerWidth < 1024) return 4;
    return 5;
  }, [containerWidth, forcedCols]);


  const columns = useMemo(() => {
    const cols: ReactElement[][] = Array.from({ length: numCols }, () => []);
    const heights = new Array(numCols).fill(0);

    Children.forEach(children, (child) => {
      if (!isValidElement(child)) return;
      const props = child.props as { photoWidth?: number; photoHeight?: number };
      const w = props.photoWidth || 1;
      const h = props.photoHeight || 1;

      // Find shortest column
      let minIdx = 0;
      for (let i = 1; i < numCols; i++) {
        if (heights[i] < heights[minIdx]) minIdx = i;
      }

      cols[minIdx].push(child);
      heights[minIdx] += h / w; // normalized height
    });

    return cols;
  }, [children, numCols]);

  return (
    <div className="masonry-container" ref={containerRef}>
      <div 
        className={cn('flex', className)} 
        style={{ gap: `${gap}px` }}
      >
        {columns.map((col, i) => (
          <div 
            key={i} 
            className="flex-1 flex flex-col" 
            style={{ gap: `${gap}px` }}
          >
            {col}
          </div>
        ))}
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

export function MasonryItem({ children, className }: MasonryItemProps) {
  return (
    <div className={cn('overflow-hidden', className)}>
      {children}
    </div>
  );
}
