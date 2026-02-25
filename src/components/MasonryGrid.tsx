import { ReactNode, ReactElement, useState, useEffect, useMemo, Children, isValidElement } from 'react';
import { cn } from '@/lib/utils';

interface MasonryGridProps {
  children: ReactNode;
  className?: string;
}

function getColumnCount(width: number): number {
  if (width >= 1280) return 4;
  if (width >= 640) return 3;
  return 2;
}

export function MasonryGrid({ children, className }: MasonryGridProps) {
  const [numCols, setNumCols] = useState(() => getColumnCount(typeof window !== 'undefined' ? window.innerWidth : 1280));

  useEffect(() => {
    const onResize = () => setNumCols(getColumnCount(window.innerWidth));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

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
    <div className="masonry-container">
      <div className={cn('flex gap-[6px]', className)}>
        {columns.map((col, i) => (
          <div key={i} className="flex-1 flex flex-col gap-[6px]">
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
