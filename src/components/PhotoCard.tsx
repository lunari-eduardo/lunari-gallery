import { useState } from 'react';
import { Check, MessageSquare, Heart, ImageOff } from 'lucide-react';
import { GalleryPhoto } from '@/types/gallery';
import { cn } from '@/lib/utils';

interface PhotoCardProps {
  photo: GalleryPhoto;
  isSelected: boolean;
  allowComments: boolean;
  disabled?: boolean;
  onSelect: () => void;
  onViewFullscreen: () => void;
  onComment?: () => void;
  onFavorite?: () => void;
}

export function PhotoCard({ 
  photo, 
  isSelected, 
  allowComments,
  disabled,
  onSelect, 
  onViewFullscreen,
  onComment,
  onFavorite
}: PhotoCardProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const handleContainerClick = (e: React.MouseEvent) => {
    // Only open fullscreen if clicking on the image area, not on action buttons
    if (!disabled) {
      onViewFullscreen();
    }
  };

  return (
    <div 
      className={cn(
        'group relative overflow-hidden bg-muted cursor-pointer transition-all duration-300 w-full',
        disabled && 'opacity-60 cursor-not-allowed'
      )}
      onClick={handleContainerClick}
    >
      {/* Image with error handling - watermark is burned into pixels during upload */}
      {hasError ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted text-muted-foreground">
          <ImageOff className="h-8 w-8 mb-2" />
          <span className="text-xs">Erro ao carregar</span>
        </div>
      ) : (
        <>
          <img
            src={photo.previewUrl}
            alt={photo.filename}
            className={cn(
              'w-full h-auto block transition-all duration-500 select-none',
              !isLoaded && 'opacity-0',
              isLoaded && 'opacity-100'
            )}
            draggable={false}
            onLoad={() => setIsLoaded(true)}
            onError={(e) => {
              console.error('Imagem falhou:', {
                src: e.currentTarget.src,
                filename: photo.filename,
                previewUrl: photo.previewUrl,
              });
              setHasError(true);
            }}
            onContextMenu={(e) => e.preventDefault()}
          />
          {/* Invisible overlay to prevent image inspection/saving */}
          {isLoaded && (
            <div 
              className="absolute inset-0 z-[1]" 
              style={{ background: 'url(data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7)' }}
              onContextMenu={(e) => e.preventDefault()}
            />
          )}
        </>
      )}

      {/* Loading skeleton */}
      {!isLoaded && !hasError && (
        <div className="absolute inset-0 bg-muted animate-pulse" />
      )}

      {/* Selection button - always visible when selected, otherwise on hover only */}
      <button
        onClick={(e) => { e.stopPropagation(); if (!disabled) onSelect(); }}
        disabled={disabled}
        className={cn(
          'absolute top-3 left-3 h-7 w-7 rounded-full border-2 flex items-center justify-center transition-all duration-200 z-10',
          isSelected 
            ? 'bg-primary border-primary text-primary-foreground' 
            : 'border-white/80 bg-black/20 hover:border-white hover:bg-black/40 opacity-0 group-hover:opacity-100',
          disabled && 'pointer-events-none'
        )}
      >
        {isSelected && <Check className="h-4 w-4" />}
      </button>

      {/* Favorite button - always visible when favorited, otherwise on hover only */}
      {onFavorite && (
        <button
          onClick={(e) => { e.stopPropagation(); onFavorite(); }}
          className={cn(
            'absolute top-3 right-3 h-7 w-7 rounded-full border-2 flex items-center justify-center transition-all duration-200 z-10',
            photo.isFavorite 
              ? 'bg-red-500 border-red-500 text-white' 
              : 'border-white/80 bg-black/20 hover:border-white hover:bg-black/40 text-white/80 hover:text-white opacity-0 group-hover:opacity-100'
          )}
        >
          <Heart className={cn("h-4 w-4", photo.isFavorite && "fill-current")} />
        </button>
      )}

      {/* Comment button - always visible when has comment, otherwise on hover only */}
      {allowComments && (
        <button
          onClick={(e) => { e.stopPropagation(); onComment?.(); }}
          className={cn(
            'absolute top-3 h-7 w-7 rounded-full border-2 flex items-center justify-center transition-all duration-200 z-10',
            photo.comment 
              ? 'bg-primary border-primary text-primary-foreground' 
              : 'border-white/80 bg-black/20 hover:border-white hover:bg-black/40 text-white/80 hover:text-white opacity-0 group-hover:opacity-100',
            onFavorite ? 'right-11' : 'right-3'
          )}
        >
          <MessageSquare className="h-4 w-4" />
        </button>
      )}

      {/* Overlay - appears only on hover */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent transition-opacity duration-300 opacity-0 group-hover:opacity-100 pointer-events-none">
        <div className="absolute bottom-3 left-3 right-3 pointer-events-auto">
          <span className="text-white/90 text-xs font-medium truncate block max-w-[60%]">
            {photo.originalFilename || photo.filename}
          </span>
        </div>
      </div>
    </div>
  );
}
