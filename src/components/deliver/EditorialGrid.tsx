import { ReactNode, useMemo, useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useGalleryDisplayTheme } from '@/hooks/useGalleryDisplayTheme';

interface EditorialGridProps {
  children: ReactNode;
  className?: string;
  forcedViewport?: 'mobile' | 'tablet' | 'desktop';
}

export function EditorialGrid({ children, className, forcedViewport }: EditorialGridProps) {
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

  const gridColsClass = useMemo(() => {
    // Se estivermos em um preview forçado (modal), usamos o containerWidth em vez de media queries
    let viewport = forcedViewport;
    if (!viewport) {
      if (containerWidth < 480) viewport = 'mobile';
      else if (containerWidth < 1024) viewport = 'tablet';
      else viewport = 'desktop';
    }

    if (viewport === 'mobile') return 'grid-cols-[repeat(var(--gallery-cols-m),1fr)]';
    if (viewport === 'tablet') return 'grid-cols-[repeat(var(--gallery-cols-t),1fr)]';
    if (viewport === 'desktop') return 'grid-cols-[repeat(var(--gallery-cols-d),1fr)]';
    
    return "grid-cols-[repeat(var(--gallery-cols-m),1fr)] sm:grid-cols-[repeat(var(--gallery-cols-t),1fr)] lg:grid-cols-[repeat(var(--gallery-cols-d),1fr)]";
  }, [forcedViewport, containerWidth]);

  return (
    <div 
      ref={containerRef}
      className={cn(
        "grid",
        gridColsClass,
        "grid-flow-row-dense",
        className
      )}
      style={{ 
        gap: 'var(--gallery-gap)',
        gridAutoRows: 'var(--gallery-row-unit, 220px)'
      }}
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

export function EditorialItem({ children, className, weight = 0, photoWidth = 800, photoHeight = 600 }: EditorialItemProps) {
  const { theme } = useGalleryDisplayTheme();
  
  const spanStyles = useMemo(() => {
    const styles: any = {};
    
    if (weight && theme.featured.enabled) {
      const rule = theme.featured.spanRules[weight.toString()];
      if (rule) {
        if (rule.colSpan) styles['gridColumn'] = `span ${rule.colSpan}`;
        if (rule.rowSpan) styles['gridRow'] = `span ${rule.rowSpan}`;
        return styles;
      }
    }

    // Auto row-span calculation based on aspect ratio
    if (theme.featured.enabled) {
      const ratio = photoHeight / photoWidth;
      // Default col is 1, so rowSpan = ratio * cellWidth / rowUnit
      // Simplified: assume 1 col = ~300px width on desktop
      const rowSpan = Math.max(1, Math.round(ratio * 1.5)); // Heuristic for editorial masonry
      styles['gridRow'] = `span ${rowSpan}`;
    }
    
    return styles;
  }, [weight, theme, photoWidth, photoHeight]);

  return (
    <div 
      className={cn(
        'relative overflow-hidden w-full h-full',
        // Destaque nível 1 (weight=1) geralmente ocupa 2x2 no Editorial
        weight === 1 && "col-span-2 row-span-2",
        className
      )}
      style={spanStyles as any}
    >
      {children}
    </div>
  );
}
