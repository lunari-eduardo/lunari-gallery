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
  gap?: number;
}

export function DeliverPhotoGrid({ photos, onPhotoClick, onDownload, bgColor }: DeliverPhotoGridProps) {
  return (
    <div className="min-h-screen px-3 sm:px-6 lg:px-8 py-8" style={bgColor ? { backgroundColor: bgColor } : undefined}>
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
              <div className="group relative cursor-pointer overflow-hidden w-full h-full">
                {photo.mimeType?.startsWith('video/') ? (
                  <>
                    <video
                      src={url}
                      muted
                      autoPlay
                      loop
                      playsInline
                      className="w-full h-full object-cover block transition-transform duration-700 group-hover:scale-[var(--gallery-hover-scale)]"
                      onClick={() => onPhotoClick(index)}
                    />
                    <div className="absolute top-3 left-3 p-1.5 backdrop-blur-sm bg-black/30 text-white rounded-full pointer-events-none">
                      <Play className="w-4 h-4 fill-white" />
                    </div>
                  </>
                ) : (
                  <img
                    src={url}
                    alt={photo.originalFilename}
                    loading="lazy"
                    className="w-full h-full object-cover block transition-transform duration-700 group-hover:scale-[var(--gallery-hover-scale)]"
                    onClick={() => onPhotoClick(index)}
                  />
                )}
                {/* Subtle gradient overlay on hover */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDownload(photo);
                  }}
                  className="absolute bottom-3 right-3 p-2 backdrop-blur-sm bg-white/20 text-white rounded-sm opacity-0 group-hover:opacity-100 transition-all duration-500 hover:bg-white/30"
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
