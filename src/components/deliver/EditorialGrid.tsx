import { ReactNode, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useGalleryDisplayTheme } from '@/hooks/useGalleryDisplayTheme';

interface EditorialGridProps {
  children: ReactNode;
  className?: string;
}

export function EditorialGrid({ children, className }: EditorialGridProps) {
  const { theme } = useGalleryDisplayTheme();
  const { gap = 6 } = theme.layout;

  return (
    <div 
      className={cn(
        "grid grid-cols-[repeat(var(--gallery-cols-m),1fr)] sm:grid-cols-[repeat(var(--gallery-cols-t),1fr)] lg:grid-cols-[repeat(var(--gallery-cols-d),1fr)]",
        "grid-flow-row-dense",
        className
      )}
      style={{ gap: `${gap}px` }}
    >
      {children}
    </div>
  );
}

interface EditorialItemProps {
  children: ReactNode;
  className?: string;
  weight?: number; // 0 = normal, 1 = destaque, 2 = hero etc
  photoWidth?: number;
  photoHeight?: number;
}

export function EditorialItem({ children, className, weight = 0, photoWidth = 1, photoHeight = 1 }: EditorialItemProps) {
  const { theme } = useGalleryDisplayTheme();
  
  const spanStyles = useMemo(() => {
    if (!weight || !theme.featured.enabled) return {};
    
    const rule = theme.featured.spanRules[weight.toString()];
    if (!rule) return {};

    const styles: any = {};
    if (rule.colSpan) styles.gridColumn = `span ${rule.colSpan}`;
    if (rule.rowSpan) styles.gridRow = `span ${rule.rowSpan}`;
    
    return styles;
  }, [weight, theme]);

  return (
    <div 
      className={cn('relative overflow-hidden w-full h-full', className)}
      style={spanStyles}
    >
      {children}
    </div>
  );
}
