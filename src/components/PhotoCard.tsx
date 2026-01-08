import { useState } from 'react';
import { Check, MessageSquare, Eye, ImageOff } from 'lucide-react';
import { GalleryPhoto, WatermarkSettings, WatermarkDisplay } from '@/types/gallery';
import { cn } from '@/lib/utils';

interface PhotoCardProps {
  photo: GalleryPhoto;
  watermark?: WatermarkSettings;
  watermarkDisplay?: WatermarkDisplay;
  isSelected: boolean;
  allowComments: boolean;
  disabled?: boolean;
  onSelect: () => void;
  onViewFullscreen: () => void;
  onComment?: () => void;
}

export function PhotoCard({ 
  photo, 
  watermark,
  watermarkDisplay = 'all',
  isSelected, 
  allowComments,
  disabled,
  onSelect, 
  onViewFullscreen,
  onComment 
}: PhotoCardProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  return (
    <div 
      className={cn(
        'group relative overflow-hidden bg-muted cursor-pointer transition-all duration-300',
        isSelected && 'ring-2 ring-primary ring-offset-1 ring-offset-background',
        disabled && 'opacity-60 cursor-not-allowed'
      )}
      style={{ aspectRatio: `${photo.width}/${photo.height}` }}
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
          onLoad={() => setIsLoaded(true)}
          onError={(e) => {
            console.error('Imagem falhou:', {
              src: e.currentTarget.src,
              filename: photo.filename,
              previewUrl: photo.previewUrl,
            });
            setHasError(true);
          }}
        />
      )}

      {/* Loading skeleton */}
      {!isLoaded && (
        <div className="absolute inset-0 bg-muted animate-pulse" />
      )}

      {/* Watermark - Note: Watermarks are now applied via Cloudinary transformation */}
      {/* This is just a visual indicator that watermark is enabled */}

      {/* Overlay */}
      <div className={cn(
        'absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent transition-opacity duration-300',
        isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
      )}>
        {/* Selection indicator */}
        <button
          onClick={(e) => { e.stopPropagation(); if (!disabled) onSelect(); }}
          disabled={disabled}
          className={cn(
            'absolute top-3 left-3 h-7 w-7 rounded-full border-2 flex items-center justify-center transition-all duration-200',
            isSelected 
              ? 'bg-primary border-primary text-primary-foreground' 
              : 'border-white/80 bg-black/20 hover:border-white hover:bg-black/40',
            disabled && 'pointer-events-none'
          )}
        >
          {isSelected && <Check className="h-4 w-4" />}
        </button>

        {/* Actions */}
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
          <span className="text-white/90 text-xs font-medium truncate max-w-[60%]">
            {photo.originalFilename || photo.filename}
          </span>
          <div className="flex items-center gap-1.5">
            {allowComments && (
              <button
                onClick={(e) => { e.stopPropagation(); onComment?.(); }}
                className={cn(
                  'h-8 w-8 rounded-full bg-black/40 flex items-center justify-center text-white/80 hover:bg-black/60 hover:text-white transition-colors',
                  photo.comment && 'text-primary'
                )}
              >
                <MessageSquare className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onViewFullscreen(); }}
              className="h-8 w-8 rounded-full bg-black/40 flex items-center justify-center text-white/80 hover:bg-black/60 hover:text-white transition-colors"
            >
              <Eye className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Comment indicator */}
      {photo.comment && (
        <div className="absolute top-3 right-3 h-6 w-6 rounded-full bg-primary flex items-center justify-center">
          <MessageSquare className="h-3 w-3 text-primary-foreground" />
        </div>
      )}
    </div>
  );
}
