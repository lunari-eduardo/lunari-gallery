import { useEffect, useRef, useState } from 'react';
import { Download, Image as ImageIcon } from 'lucide-react';
import { getPhotoUrl, PhotoPaths } from '@/lib/photoUrl';
import { useGalleryDisplayTheme } from '@/hooks/useGalleryDisplayTheme';
import { useIsMobile } from '@/hooks/use-mobile';
import { JustifiedRowsGrid } from '@/components/gallery/JustifiedRowsGrid';
import { EditorialTemplatesGrid } from '@/components/gallery/EditorialTemplatesGrid';
import { cn } from '@/lib/utils';
import { GalleryPhoto } from '@/types/gallery';

export interface DeliverPhoto {
  id: string;
  storageKey: string;
  originalPath?: string | null;
  originalFilename: string;
  filename?: string;
  width: number;
  height: number;
  thumbPath?: string | null;
  previewPath?: string | null;
  folderId?: string | null;
  mimeType?: string | null;
  peso_visual?: number;
  /** Alias canônico em camelCase usado pelo motor Editorial V3. */
  pesoVisual?: number;
}

interface DeliverPhotoGridProps {
  photos: DeliverPhoto[];
  onPhotoClick: (index: number) => void;
  onDownload: (photo: DeliverPhoto) => void;
  bgColor?: string;
  isBlueprint?: boolean;
  galleryId?: string; // Optional for demo/preview purposes
}

export function DeliverPhotoGrid({ 
  photos, 
  onPhotoClick, 
  onDownload, 
  bgColor,
  isBlueprint = false,
  galleryId
}: DeliverPhotoGridProps) {
  const { theme } = useGalleryDisplayTheme();
  const isMobile = useIsMobile();
  const [activeId, setActiveId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Tap fora desativa o estado "ativo" no mobile.
  useEffect(() => {
    if (!isMobile || !activeId) return;
    const onDocTap = (e: Event) => {
      const target = e.target as Node | null;
      if (containerRef.current && target && containerRef.current.contains(target)) return;
      setActiveId(null);
    };
    document.addEventListener('touchstart', onDocTap, { passive: true });
    document.addEventListener('mousedown', onDocTap);
    return () => {
      document.removeEventListener('touchstart', onDocTap);
      document.removeEventListener('mousedown', onDocTap);
    };
  }, [isMobile, activeId]);

  const useTemplates = theme.layout.engine === 'editorial-templates';

  const config = {
    gap: theme.layout.gap ?? 6,
    targetRowHeight: typeof window !== 'undefined' && window.innerWidth < 640 ? 220 : (
      theme.id === 'clean' ? 320 :
      theme.id === 'editorial' ? 340 :
      theme.id === 'lunari' ? 280 : 260
    ),
  };

  const renderContent = (photo: DeliverPhoto, style: React.CSSProperties) => {
    const isDemo = photo.id && photo.id.length < 5;
    
    // Correct URL construction
    const paths: PhotoPaths = {
      storageKey: isDemo ? (photo as any).previewPath : (photo.storageKey || `gallery-${galleryId}/preview/${photo.filename}`),
      thumbPath: photo.thumbPath,
      previewPath: photo.previewPath,
      width: photo.width,
      height: photo.height,
    };
    
    const url = isDemo ? (photo as any).previewPath : getPhotoUrl(paths, 'preview');
    const index = photos.findIndex(p => p.id === photo.id);
    const isActive = isMobile && activeId === photo.id;

    const handleMediaClick = (e: React.MouseEvent) => {
      if (isMobile && !isActive) {
        e.stopPropagation();
        setActiveId(photo.id);
        return;
      }
      onPhotoClick(index);
    };

    return (
      <div 
        key={photo.id}
        style={style}
        className={cn(
          "group relative cursor-pointer overflow-hidden w-full rounded-none",
          "transition-all duration-300",
          isActive && "is-active"
        )}
      >
        {isBlueprint ? (
          <div className="flex flex-col items-center justify-center w-full h-full min-h-[150px] gap-2 opacity-20 border border-dashed border-zinc-400">
            <ImageIcon className="w-8 h-8" />
            <span className="text-[10px] uppercase tracking-wider font-medium">{photo.width}x{photo.height}</span>
          </div>
        ) : (
          <>
            {photo.mimeType?.startsWith('video/') ? (
              <video
                src={url}
                muted
                autoPlay
                loop
                playsInline
                className="w-full h-full object-cover block transition-transform duration-1000 ease-out group-hover:scale-[var(--gallery-hover-scale,1.02)]"
                onClick={handleMediaClick}
              />
            ) : (
              <img
                src={url}
                alt={photo.originalFilename}
                loading="lazy"
                decoding="async"
                className="w-full h-full block object-cover transition-transform duration-1000 ease-out group-hover:scale-[var(--gallery-hover-scale,1.02)]"
                onClick={handleMediaClick}
              />
            )}
            
            <div
              className={cn(
                "absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent transition-opacity duration-500 pointer-events-none",
                "opacity-0 group-hover:opacity-100",
                isActive && "opacity-100"
              )}
            />
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDownload(photo);
              }}
              className={cn(
                "absolute bottom-4 right-4 p-2.5 backdrop-blur-md bg-white/10 text-white rounded-full transition-all duration-500 hover:bg-white/20 border border-white/20 active:scale-90",
                "opacity-0 group-hover:opacity-100",
                isActive && "opacity-100"
              )}
              title="Baixar"
            >
              <Download className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    );
  };

  const containerBg = bgColor ? { backgroundColor: bgColor } : undefined;

  return (
    <div ref={containerRef} className="min-h-[50vh] py-12" style={containerBg}>
      {useTemplates ? (
        <EditorialTemplatesGrid
          photos={photos as any}
          gap={config.gap}
          maxContainerWidth={theme.layout.maxContainerWidth}
          maxItemsPerStrip={theme.layout.maxItemsPerStrip}
          featuredCooldown={theme.layout.featuredCooldown}
          onPhotoClick={(photo) => onPhotoClick(photos.findIndex(p => p.id === photo.id))}
          renderItem={(photo, style) => renderContent(photo as any, style)}
        />
      ) : (
        <JustifiedRowsGrid
          photos={photos as any}
          gap={config.gap}
          targetRowHeight={config.targetRowHeight}
          featuredEnabled={theme.featured?.enabled !== false}
          uniformTiles={theme.layout.uniformTile}
          maxItemsPerRow={theme.layout.maxItemsPerRow}
          masonryColumns={theme.layout.masonryColumns}
          uniformGridSpan={theme.layout.uniformGridSpan}
          pairedRowsFeatured={theme.layout.pairedRowsFeatured}
          onPhotoClick={(photo) => onPhotoClick(photos.findIndex(p => p.id === photo.id))}
          renderItem={(photo, style) => renderContent(photo as any, style)}
        />
      )}
    </div>
  );
}
