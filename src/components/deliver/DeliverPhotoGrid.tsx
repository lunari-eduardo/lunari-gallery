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
  bgColor?: string;
}

export function DeliverPhotoGrid({ photos, onPhotoClick, onDownload, bgColor }: DeliverPhotoGridProps) {
  return (
    <div className="min-h-screen px-3 sm:px-6 lg:px-8 py-8" style={bgColor ? { backgroundColor: bgColor } : undefined}>
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
              <div className="group relative cursor-pointer overflow-hidden aspect-square">
                <img
                  src={url}
                  alt={photo.originalFilename}
                  loading="lazy"
                  className="w-full h-full object-cover block transition-transform duration-700 group-hover:scale-[1.01]"
                  onClick={() => onPhotoClick(index)}
                />
                {/* Subtle gradient overlay on hover */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDownload(photo);
                  }}
                  className="absolute bottom-3 right-3 p-2 backdrop-blur-sm bg-white/20 text-white rounded-sm opacity-0 group-hover:opacity-100 transition-all duration-500 hover:bg-white/30"
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
