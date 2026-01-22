import { useEffect, useState, useCallback } from 'react';
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Check, 
  MessageSquare,
  ZoomIn,
  ZoomOut,
  Download,
  Heart
} from 'lucide-react';
import { GalleryPhoto, WatermarkSettings, WatermarkDisplay } from '@/types/gallery';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

interface LightboxProps {
  photos: GalleryPhoto[];
  currentIndex: number;
  watermark?: WatermarkSettings;
  watermarkDisplay?: WatermarkDisplay;
  allowComments: boolean;
  allowDownload?: boolean;
  disabled?: boolean;
  onClose: () => void;
  onNavigate: (index: number) => void;
  onSelect: (photoId: string) => void;
  onComment?: (photoId: string, comment: string) => void;
  onFavorite?: (photoId: string) => void;
}

export function Lightbox({ 
  photos, 
  currentIndex, 
  watermark,
  watermarkDisplay = 'all',
  allowComments,
  allowDownload = false,
  disabled,
  onClose, 
  onNavigate,
  onSelect,
  onComment,
  onFavorite
}: LightboxProps) {
  const isMobile = useIsMobile();
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState('');
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [initialPinchDistance, setInitialPinchDistance] = useState<number | null>(null);
  const [initialZoom, setInitialZoom] = useState(1);

  const currentPhoto = photos[currentIndex];
  
  // Show watermark in fullscreen if watermarkDisplay is 'all' or 'fullscreen'
  const showWatermark = watermark && watermark.type !== 'none' && watermarkDisplay !== 'none';

  const handleDownload = () => {
    if (!currentPhoto || !allowDownload) return;
    const link = document.createElement('a');
    link.href = currentPhoto.previewUrl;
    link.download = currentPhoto.originalFilename || currentPhoto.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    setComment(currentPhoto?.comment || '');
    setShowComment(false);
    setZoom(1);
  }, [currentIndex, currentPhoto?.comment]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'ArrowLeft' && currentIndex > 0) onNavigate(currentIndex - 1);
    if (e.key === 'ArrowRight' && currentIndex < photos.length - 1) onNavigate(currentIndex + 1);
    if (e.key === ' ' && !disabled) {
      e.preventDefault();
      onSelect(currentPhoto.id);
    }
  }, [currentIndex, photos.length, currentPhoto?.id, disabled, onClose, onNavigate, onSelect]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [handleKeyDown]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      setInitialPinchDistance(getDistance(e.touches));
      setInitialZoom(zoom);
    } else if (e.touches.length === 1) {
      setTouchStart(e.touches[0].clientX);
    }
  };

  const getDistance = (touches: React.TouchList) => {
    return Math.hypot(
      touches[0].clientX - touches[1].clientX,
      touches[0].clientY - touches[1].clientY
    );
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialPinchDistance !== null) {
      e.preventDefault();
      const currentDistance = getDistance(e.touches);
      const scale = currentDistance / initialPinchDistance;
      const newZoom = Math.min(4, Math.max(1, initialZoom * scale));
      setZoom(newZoom);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      setInitialPinchDistance(null);
    }
    // Swipe navigation only when not zoomed
    if (touchStart !== null && e.changedTouches.length === 1 && zoom === 1) {
      const touchEnd = e.changedTouches[0].clientX;
      const diff = touchStart - touchEnd;
      if (Math.abs(diff) > 50) {
        if (diff > 0 && currentIndex < photos.length - 1) {
          onNavigate(currentIndex + 1);
        } else if (diff < 0 && currentIndex > 0) {
          onNavigate(currentIndex - 1);
        }
      }
      setTouchStart(null);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!isMobile) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.25 : 0.25;
      setZoom(z => Math.min(4, Math.max(1, z + delta)));
    }
  };

  const handleSaveComment = () => {
    onComment?.(currentPhoto.id, comment);
    setShowComment(false);
  };

  const handleBackgroundClick = (e: React.MouseEvent) => {
    // Close if clicking directly on the background container (not on image or buttons)
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!currentPhoto) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-b from-black/50 to-transparent">
        <div className="flex items-center gap-4">
          <span className="text-white/80 text-sm">
            {currentIndex + 1} / {photos.length}
          </span>
          <span className="text-white/60 text-sm hidden sm:block">
            {currentPhoto.originalFilename || currentPhoto.filename}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!isMobile && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/10"
                onClick={() => setZoom(z => Math.max(1, z - 0.5))}
                disabled={zoom <= 1}
              >
                <ZoomOut className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/10"
                onClick={() => setZoom(z => Math.min(4, z + 0.5))}
                disabled={zoom >= 4}
              >
                <ZoomIn className="h-5 w-5" />
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/10"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div 
        className="flex-1 flex items-center justify-center p-2 md:p-4 relative overflow-hidden cursor-pointer"
        onClick={handleBackgroundClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Navigation Arrows */}
        {currentIndex > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); onNavigate(currentIndex - 1); }}
            className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-black/40 flex items-center justify-center text-white/80 hover:bg-black/60 hover:text-white transition-colors z-10"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}
        {currentIndex < photos.length - 1 && (
          <button
            onClick={(e) => { e.stopPropagation(); onNavigate(currentIndex + 1); }}
            className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-black/40 flex items-center justify-center text-white/80 hover:bg-black/60 hover:text-white transition-colors z-10"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}

        {/* Image */}
        <div 
          className={cn(
            "relative flex items-center justify-center",
            zoom > 1 ? "overflow-auto" : "overflow-hidden"
          )}
          style={{ 
            width: isMobile ? 'calc(100vw - 32px)' : 'calc(100vw - 120px)',
            height: isMobile ? 'calc(100vh - 140px)' : 'calc(100vh - 180px)',
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(255,255,255,0.2) transparent'
          }}
          onClick={(e) => e.stopPropagation()}
          onWheel={handleWheel}
        >
          <img
            src={currentPhoto.previewUrl}
            alt={currentPhoto.filename}
            className="transition-transform duration-200"
            style={{ 
              maxWidth: zoom === 1 ? '100%' : 'none',
              maxHeight: zoom === 1 ? '100%' : 'none',
              objectFit: 'contain',
              transform: zoom > 1 ? `scale(${zoom})` : undefined,
              transformOrigin: 'center center',
            }}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 bg-gradient-to-t from-black/50 to-transparent">
        <div className="flex items-center justify-center gap-3">
          <Button
            onClick={() => !disabled && onSelect(currentPhoto.id)}
            disabled={disabled}
            variant={currentPhoto.isSelected ? 'terracotta' : 'outline'}
            className={cn(
              'gap-2',
              !currentPhoto.isSelected && 'text-white border-white/40 hover:bg-white/10'
            )}
          >
            <Check className="h-4 w-4" />
            {currentPhoto.isSelected ? 'Selecionada' : 'Selecionar'}
          </Button>

          {onFavorite && (
            <Button
              onClick={() => !disabled && onFavorite(currentPhoto.id)}
              disabled={disabled}
              variant="outline"
              className={cn(
                'gap-2',
                currentPhoto.isFavorite 
                  ? 'text-red-500 border-red-500/40' 
                  : 'text-white border-white/40 hover:bg-white/10'
              )}
            >
              <Heart className={cn("h-4 w-4", currentPhoto.isFavorite && "fill-current")} />
              {currentPhoto.isFavorite ? 'Favoritada' : 'Favoritar'}
            </Button>
          )}
          
          {allowComments && (
            <Button
              onClick={() => setShowComment(!showComment)}
              variant="outline"
              className={cn(
                'gap-2 text-white border-white/40 hover:bg-white/10',
                currentPhoto.comment && 'text-primary border-primary'
              )}
            >
              <MessageSquare className="h-4 w-4" />
              Comentar
            </Button>
          )}

          {allowDownload && (
            <Button
              onClick={handleDownload}
              variant="outline"
              className="gap-2 text-white border-white/40 hover:bg-white/10"
            >
              <Download className="h-4 w-4" />
              Baixar
            </Button>
          )}
        </div>

        {/* Comment Panel */}
        {showComment && (
          <div className="mt-4 max-w-md mx-auto animate-slide-up">
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Adicione um comentário sobre esta foto..."
              className="bg-white/10 border-white/20 text-white placeholder:text-white/50 resize-none"
              rows={3}
            />
            <div className="flex justify-end gap-2 mt-2">
              <Button 
                variant="ghost" 
                size="sm"
                className="text-white/70 hover:text-white hover:bg-white/10"
                onClick={() => setShowComment(false)}
              >
                Cancelar
              </Button>
              <Button 
                variant="terracotta" 
                size="sm"
                onClick={handleSaveComment}
              >
                Salvar
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
