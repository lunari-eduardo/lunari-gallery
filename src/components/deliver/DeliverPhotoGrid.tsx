import { Download, Play } from 'lucide-react';
import { getPhotoUrl, PhotoPaths } from '@/lib/photoUrl';
import { EditorialGrid, EditorialItem } from '@/components/deliver/EditorialGrid';

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
}

export function DeliverPhotoGrid({ photos, onPhotoClick, onDownload, bgColor }: DeliverPhotoGridProps) {
  return (
    <div className="min-h-[50vh] px-3 sm:px-6 lg:px-8 py-12" style={bgColor ? { backgroundColor: bgColor } : undefined}>
      <EditorialGrid className="max-w-7xl mx-auto">
        {photos.map((photo, index) => {
          const paths: PhotoPaths = {
            storageKey: photo.storageKey,
            thumbPath: photo.thumbPath,
            previewPath: photo.previewPath,
            width: photo.width,
            height: photo.height,
          };
          const url = getPhotoUrl(paths, 'preview');

          return (
            <EditorialItem 
              key={photo.id} 
              weight={photo.peso_visual}
              photoWidth={photo.width} 
              photoHeight={photo.height}
            >
              <div className="group relative cursor-pointer overflow-hidden w-full h-full bg-black/5">
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
              </div>
            </EditorialItem>
          );
        })}
      </EditorialGrid>
    </div>
  );
}
