import React from 'react';

/**
 * Simple Masonry Grid - para uso em previews/admin
 * Componente legado mantido para compatibilidade com GalleryPreview, GalleryDetail, etc.
 */

interface MasonryGridProps {
  gap?: number;
  children: React.ReactNode;
}

interface MasonryItemProps {
  photoWidth: number;
  photoHeight: number;
  children: React.ReactNode;
}

export function MasonryGrid({ gap = 8, children }: MasonryGridProps) {
  return (
    <div
      className="columns-2 sm:columns-3 md:columns-4 lg:columns-5 gap-0 px-1 sm:px-2 md:px-4"
      style={{
        columnGap: `${gap}px`,
      }}
    >
      {children}
    </div>
  );
}

export function MasonryItem({ photoWidth, photoHeight, children }: MasonryItemProps) {
  const aspectRatio = (photoHeight && photoWidth) ? (photoWidth / photoHeight) : 1;
  
  return (
    <div
      className="break-inside-avoid"
      style={{
        marginBottom: `var(--masonry-gap, 8px)`,
        aspectRatio: `${aspectRatio}`,
      }}
    >
      {children}
    </div>
  );
}
