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

  const renderContent = (photo: DeliverPhoto, index: number) => {
    const paths: PhotoPaths = {
      storageKey: photo.storageKey,
      thumbPath: photo.thumbPath,
      previewPath: photo.previewPath,
      width: photo.width,
      height: photo.height,
    };
    const url = getPhotoUrl(paths, 'preview');

    return (
      <div 
        className={cn(
          "group relative cursor-pointer overflow-hidden w-full bg-zinc-100 dark:bg-zinc-800 rounded-none",
          isBlueprint ? "flex items-center justify-center aspect-[var(--aspect-ratio)]" : "h-full"
        )}
        style={{ '--aspect-ratio': `${photo.width}/${photo.height}` } as any}
      >
        {isBlueprint ? (
          <div className="flex flex-col items-center gap-2 opacity-20">
            <ImageIcon className="w-8 h-8" />
            <span className="text-[10px] uppercase tracking-wider font-medium">{photo.width}x{photo.height}</span>
          </div>
        ) : (
          <>
            {photo.mimeType?.startsWith('video/') ? (
              <>
                <video
                  src={url}
                  muted
                  autoPlay
                  loop
                  playsInline
                  className="w-full h-full object-cover block transition-transform duration-1000 ease-out group-hover:scale-[var(--gallery-hover-scale)]"
                  onClick={() => onPhotoClick(index)}
                />
                <div className="absolute top-3 left-3 p-1.5 backdrop-blur-md bg-black/20 text-white rounded-full pointer-events-none">
                  <Play className="w-4 h-4 fill-white" />
                </div>
              </>
            ) : (
              <img
                src={url}
                alt={photo.originalFilename}
                loading="lazy"
                className="w-full h-full object-cover block transition-transform duration-1000 ease-out group-hover:scale-[var(--gallery-hover-scale)]"
                onClick={() => onPhotoClick(index)}
                onError={(e) => {
                  // Fallback para quando a imagem falha - mostra estilo blueprint
                  e.currentTarget.style.display = 'none';
                  const parent = e.currentTarget.parentElement;
                  if (parent) {
                    parent.classList.add('flex', 'items-center', 'justify-center');
                    parent.innerHTML = `
                      <div class="flex flex-col items-center gap-2 opacity-40 p-4 text-center">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                        <span class="text-[9px] font-mono break-all line-clamp-2">${photo.originalFilename}</span>
                      </div>
                    `;
                  }
                }}
              />
            )}
            
            {/* Visual refinement: Subtle dark gradient at bottom on hover */}
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

  if (engine === 'masonry-classic') {
    return (
      <div className="min-h-[50vh] px-3 sm:px-6 lg:px-8 py-12" style={containerBg}>
        <MasonryGrid gap={theme.layout.gap} className="max-w-7xl mx-auto">
          {photos.map((photo, index) => (
            <MasonryItem 
              key={photo.id} 
              photoWidth={photo.width} 
              photoHeight={photo.height}
            >
              {renderContent(photo, index)}
            </MasonryItem>
          ))}
        </MasonryGrid>
      </div>
    );
  }

  return (
    <div className="min-h-[50vh] px-3 sm:px-6 lg:px-8 py-12" style={containerBg}>
      <EditorialGrid className="max-w-7xl mx-auto">
        {photos.map((photo, index) => (
          <EditorialItem 
            key={photo.id} 
            weight={photo.peso_visual}
            photoWidth={photo.width} 
            photoHeight={photo.height}
          >
            {renderContent(photo, index)}
          </EditorialItem>
        ))}
      </EditorialGrid>
    </div>
  );
}
