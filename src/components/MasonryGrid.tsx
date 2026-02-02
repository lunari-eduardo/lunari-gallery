import { ReactNode } from 'react';
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
}

export function MasonryItem({ children, className }: MasonryItemProps) {
  return (
    <div className={cn('masonry-item', className)}>
      {children}
    </div>
  );
}
