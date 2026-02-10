import { Download } from 'lucide-react';
import { getPhotoUrl, PhotoPaths } from '@/lib/photoUrl';
import { MasonryGrid, MasonryItem } from '@/components/MasonryGrid';

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
}

interface DeliverPhotoGridProps {
  photos: DeliverPhoto[];
  onPhotoClick: (index: number) => void;
  onDownload: (photo: DeliverPhoto) => void;
}

export function DeliverPhotoGrid({ photos, onPhotoClick, onDownload }: DeliverPhotoGridProps) {
  return (
    <div className="bg-black min-h-screen px-2 sm:px-4 py-6">
      <MasonryGrid className="max-w-7xl mx-auto">
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
            <MasonryItem key={photo.id}>
              <div className="group relative cursor-pointer overflow-hidden rounded-sm">
                <img
                  src={url}
                  alt={photo.originalFilename}
                  loading="lazy"
                  className="w-full h-auto block transition-transform duration-500 group-hover:scale-[1.02]"
                  onClick={() => onPhotoClick(index)}
                />
                {/* Download overlay on hover */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDownload(photo);
                  }}
                  className="absolute bottom-3 right-3 p-2 bg-white/90 text-black rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-white hover:scale-110"
                  title="Baixar foto"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </MasonryItem>
          );
        })}
      </MasonryGrid>
    </div>
  );
}
