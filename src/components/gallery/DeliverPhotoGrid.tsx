import React from 'react';
import { GalleryPhoto } from '@/types/gallery';
import { getPhotoUrl } from '@/lib/photoUrl';
import { useGalleryDisplayTheme } from '@/hooks/useGalleryDisplayTheme';
import { JustifiedRowsGrid } from './JustifiedRowsGrid';
import { Play } from 'lucide-react';

interface DeliverPhotoGridProps {
  photos: GalleryPhoto[];
  onPhotoClick: (photo: GalleryPhoto) => void;
  galleryId: string;
}

export const DeliverPhotoGrid: React.FC<DeliverPhotoGridProps> = ({
  photos,
  onPhotoClick,
  galleryId
}) => {
  const { theme } = useGalleryDisplayTheme();
  
  const config = {
    gap: theme.layout.gap ?? 6,
    targetRowHeight: typeof window !== 'undefined' && window.innerWidth < 640 ? 180 : (
      theme.id === 'clean' ? 320 : 
      theme.id === 'lunari' ? 280 : 260
    )
  };

  const renderPhotoItem = (photo: GalleryPhoto, style: React.CSSProperties) => {
    const isVideo = photo.filename?.toLowerCase().endsWith('.mp4') || 
                   photo.filename?.toLowerCase().endsWith('.mov');
    
    const url = getPhotoUrl({
      id: photo.id,
      gallery_id: galleryId,
      filename: photo.filename
    }, 'preview');

    return (
      <div
        key={photo.id}
        style={style}
        onClick={() => onPhotoClick(photo)}
        className="group relative overflow-hidden transition-all duration-300 hover:opacity-95 bg-zinc-100"
      >
        <img
          src={url}
          alt={photo.filename}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
        
        {isVideo && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/10">
            <div className="rounded-full bg-white/20 p-3 backdrop-blur-sm">
              <Play className="h-8 w-8 text-white fill-white" />
            </div>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      </div>
    );
  };

  return (
    <div className="w-full px-4 md:px-8 pb-12">
      <JustifiedRowsGrid
        photos={photos}
        gap={config.gap}
        targetRowHeight={config.targetRowHeight}
        onPhotoClick={onPhotoClick}
        renderItem={renderPhotoItem}
      />
    </div>
  );
};
