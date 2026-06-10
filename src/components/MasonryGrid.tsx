import { ReactNode, ReactElement, useState, useEffect, useMemo, Children, isValidElement, useRef } from 'react';
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
    return 4; // Max 4 based on requirement for Lunari/Editorial
  }, [containerWidth, forcedCols]);

  const columns = useMemo(() => {
    const cols: ReactElement[][] = Array.from({ length: numCols }, () => []);
    const heights = new Array(numCols).fill(0);

    Children.forEach(children, (child) => {
      if (!isValidElement(child)) return;
      const props = child.props as MasonryItemProps;
      const w = props.photoWidth || 1;
      const h = props.photoHeight || 1;
      const span = props.span || 1;

      // Handle multi-column spans
      const effectiveSpan = Math.min(span, numCols);
      
      // Find a spot where we can place this span
      // For simplicity in column-masonry, if span > 1, we find the index where span cols start
      // and have the minimum average height.
      let bestStartIdx = 0;
      let minAvgHeight = Infinity;

      for (let i = 0; i <= numCols - effectiveSpan; i++) {
        let currentAvg = 0;
        for (let j = 0; j < effectiveSpan; j++) {
          currentAvg += heights[i + j];
        }
        currentAvg /= effectiveSpan;

        if (currentAvg < minAvgHeight) {
          minAvgHeight = currentAvg;
          bestStartIdx = i;
        }
      }

      // Add to first column of the span and set CSS to expand
      cols[bestStartIdx].push(child);
      
      const normalizedHeight = (h / w) * effectiveSpan;
      for (let j = 0; j < effectiveSpan; j++) {
        heights[bestStartIdx + j] += normalizedHeight;
      }
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
  span?: number;
}

export function MasonryItem({ children, className, span = 1 }: MasonryItemProps) {
  return (
    <div 
      className={cn('overflow-hidden w-full', className)}
      style={{
        gridColumn: span > 1 ? `span ${span}` : 'auto',
        // In a flex-based column layout, span is harder. 
        // We'll use a CSS-trick or handle it via width if needed, 
        // but since we're using flex-1 columns, we should stick to it.
        // For now, let's keep it simple.
      }}
    >
      {children}
    </div>
  );
}
