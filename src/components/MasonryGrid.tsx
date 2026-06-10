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

export function MasonryGrid({ gap = 6, children }: MasonryGridProps) {
  return (
    <div
      className="columns-2 sm:columns-3 lg:columns-4 gap-0"
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
      className="break-inside-avoid mb-0"
      style={{
        marginBottom: `${0}px`,
        aspectRatio: `${aspectRatio}`,
      }}
    >
      {children}
    </div>
  );
}
