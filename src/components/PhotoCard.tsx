import { useState } from 'react';
import { Check, MessageSquare, Heart, ImageOff } from 'lucide-react';
import { GalleryPhoto, WatermarkDisplay } from '@/types/gallery';
import { cn } from '@/lib/utils';
import { WatermarkOverlay, WatermarkMode, useWatermarkDisplay } from '@/components/WatermarkOverlay';

interface PhotoCardProps {
  photo: GalleryPhoto;
  /** Show watermark overlay on this image */
  showWatermark?: boolean;
  watermarkDisplay?: WatermarkDisplay;
  /** Watermark mode: system, custom, or none */
  watermarkMode?: WatermarkMode;
  /** Custom watermark path in R2 for custom mode */
  watermarkCustomPath?: string | null;
  /** Opacity for watermark (0-100) */
  watermarkOpacity?: number;
  /** Scale for custom watermark tile (10-50%) */
  watermarkScale?: number;
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
  showWatermark = true,
  watermarkDisplay = 'all',
  watermarkMode = 'system',
  watermarkCustomPath,
  watermarkOpacity = 40,
  watermarkScale = 30,
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
  
  // Determine if watermark should show based on display mode
  const shouldShowWatermark = useWatermarkDisplay(watermarkDisplay, 'grid') && showWatermark;
  
  // Determine photo orientation
  const orientation = photo.width > photo.height ? 'horizontal' : 'vertical';

  const handleContainerClick = (e: React.MouseEvent) => {
    // Only open fullscreen if clicking on the image area, not on action buttons
    if (!disabled) {
      onViewFullscreen();
    }
  };

  return (
    <div 
      className={cn(
        'group relative overflow-hidden bg-muted cursor-pointer transition-all duration-300',
        disabled && 'opacity-60 cursor-not-allowed'
      )}
      style={{ aspectRatio: `${photo.width}/${photo.height}` }}
      onClick={handleContainerClick}
    >
      {/* Image with error handling */}
      {hasError ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted text-muted-foreground">
          <ImageOff className="h-8 w-8 mb-2" />
          <span className="text-xs">Erro ao carregar</span>
        </div>
      ) : (
        <img
          src={photo.previewUrl}
          alt={photo.filename}
          className={cn(
            'w-full h-full object-cover transition-all duration-500',
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
      )}

      {/* Watermark overlay - visual protection */}
      {shouldShowWatermark && isLoaded && !hasError && (
        <WatermarkOverlay 
          mode={watermarkMode}
          orientation={orientation}
          customPath={watermarkCustomPath}
          opacity={watermarkOpacity}
          scale={watermarkScale}
        />
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
