import { Download, Play, Image as ImageIcon } from 'lucide-react';
import { getPhotoUrl, PhotoPaths } from '@/lib/photoUrl';
import { EditorialGrid, EditorialItem } from '@/components/deliver/EditorialGrid';
import { MasonryGrid, MasonryItem } from '@/components/MasonryGrid';
import { useGalleryDisplayTheme } from '@/hooks/useGalleryDisplayTheme';
import { cn } from '@/lib/utils';

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
}

interface DeliverPhotoGridProps {
  photos: DeliverPhoto[];
  onPhotoClick: (index: number) => void;
  onDownload: (photo: DeliverPhoto) => void;
  bgColor?: string;
  isBlueprint?: boolean;
}

export function DeliverPhotoGrid({ 
  photos, 
  onPhotoClick, 
  onDownload, 
  bgColor,
  isBlueprint = false 
}: DeliverPhotoGridProps) {
  const { theme } = useGalleryDisplayTheme();
  const engine = theme.layout.engine || 'editorial-grid';

  const renderContent = (photo: DeliverPhoto, index: number, layoutType: 'masonry' | 'editorial') => {
    const paths: PhotoPaths = {
      storageKey: photo.storageKey,
      thumbPath: photo.thumbPath,
      previewPath: photo.previewPath,
      width: photo.width,
      height: photo.height,
    };
    
    // Correct URL construction using getPhotoUrl utility to ensure R2 public URL
    const url = getPhotoUrl(paths, 'preview');
    const aspectRatio = photo.width / photo.height;

    return (
      <div 
        className={cn(
          "group relative cursor-pointer overflow-hidden w-full bg-zinc-100/50 dark:bg-zinc-800/50 rounded-none",
          "transition-all duration-300"
        )}
        style={{ 
          '--aspect-ratio': aspectRatio,
          padding: 'var(--gallery-photo-border, 0px)'
        } as any}
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
                onClick={() => onPhotoClick(index)}
              />
            ) : (
              <img
                src={url}
                alt={photo.originalFilename}
                loading="lazy"
                decoding="async"
                className="w-full h-full block object-cover transition-transform duration-1000 ease-out group-hover:scale-[var(--gallery-hover-scale,1.02)]"
                onClick={() => onPhotoClick(index)}
              />
            )}
            
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDownload(photo);
              }}
              className="absolute bottom-4 right-4 p-2.5 backdrop-blur-md bg-white/10 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all duration-500 hover:bg-white/20 border border-white/20 active:scale-90"
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

  // We use MasonryGrid for ALL themes now to ensure "never crop" rule
  // while supporting different column counts and spacing.
  return (
    <div className="min-h-[50vh] px-3 sm:px-6 lg:px-8 py-12" style={containerBg}>
      <MasonryGrid 
        gap={theme.layout.gap} 
        className="max-w-7xl mx-auto"
        forcedCols={theme.layout.columns.desktop}
      >
        {photos.map((photo, index) => {
          // Editorial featured logic
          let span = 1;
          if (theme.featured.enabled) {
            if (photo.peso_visual === 1) span = 2;
            // Auto-highlight approx 30% if no manual weights
            else if (!photos.some(p => p.peso_visual === 1)) {
              if (index % 4 === 0) span = 2;
            }
          }

          return (
            <MasonryItem 
              key={photo.id} 
              photoWidth={photo.width} 
              photoHeight={photo.height}
              span={span}
            >
              {renderContent(photo, index, 'masonry')}
            </MasonryItem>
          );
        })}
      </MasonryGrid>
    </div>
  );
}

