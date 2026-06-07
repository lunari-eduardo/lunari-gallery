import { ReactNode, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useGalleryDisplayTheme } from '@/hooks/useGalleryDisplayTheme';

interface EditorialGridProps {
  children: ReactNode;
  className?: string;
}

export function EditorialGrid({ children, className }: EditorialGridProps) {
  return (
    <div 
      className={cn(
        "grid grid-cols-[repeat(var(--gallery-cols-m),1fr)] sm:grid-cols-[repeat(var(--gallery-cols-t),1fr)] lg:grid-cols-[repeat(var(--gallery-cols-d),1fr)]",
        "grid-flow-row-dense",
        className
      )}
      style={{ gap: 'var(--gallery-gap)' }}
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

export function EditorialItem({ children, className, weight = 0 }: EditorialItemProps) {
  const { theme } = useGalleryDisplayTheme();
  
  const spanStyles = useMemo(() => {
    if (!weight || !theme.featured.enabled) return {};
    
    const rule = theme.featured.spanRules[weight.toString()];
    if (!rule) return {};

    const styles: any = {};
    
    // Na visualização mobile, restringimos spans para não quebrar o layout em 2 colunas
    // Se colSpan > 1 em mobile, ele ocupa a largura total
    if (rule.colSpan) {
      styles['--col-span'] = `span ${rule.colSpan}`;
      // Fallback para CSS inline se necessário, mas preferimos classes
    }
    
    if (rule.rowSpan) {
      styles['--row-span'] = `span ${rule.rowSpan}`;
    }
    
    return styles;
  }, [weight, theme]);

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
