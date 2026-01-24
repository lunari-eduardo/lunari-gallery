import { useEffect, useState, useCallback, useRef } from 'react';
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
  
  // Desktop zoom state
  const [zoom, setZoom] = useState(1);

  // Mobile pinch-to-zoom refs (synchronous to avoid jumps)
  const scaleRef = useRef(1);
  const initialPinchDistanceRef = useRef<number | null>(null);
  const initialScaleRef = useRef(1);
  const isPinchingRef = useRef(false);
  const isFirstPinchFrameRef = useRef(true);

  // Mobile pan refs
  const positionRef = useRef({ x: 0, y: 0 });
  const lastTouchRef = useRef({ x: 0, y: 0 });
  const isPanningRef = useRef(false);

  // Force re-render for ref-based state
  const [, forceUpdate] = useState({});

  const currentPhoto = photos[currentIndex];
  
  // Show watermark in fullscreen if watermarkDisplay is 'all' or 'fullscreen'
  const showWatermark = watermark && watermark.type !== 'none' && watermarkDisplay !== 'none';

  // Utility function for clamping values
  const clamp = (value: number, min: number, max: number) => 
    Math.min(Math.max(value, min), max);

  // Calculate distance between two touch points
  const getDistance = (touches: React.TouchList): number => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleDownload = () => {
    if (!currentPhoto || !allowDownload) return;
    const link = document.createElement('a');
    link.href = currentPhoto.previewUrl;
    link.download = currentPhoto.originalFilename || currentPhoto.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Reset state when changing photos
  useEffect(() => {
    scaleRef.current = 1;
    positionRef.current = { x: 0, y: 0 };
    isPinchingRef.current = false;
    isPanningRef.current = false;
    initialPinchDistanceRef.current = null;
    isFirstPinchFrameRef.current = true;
    setComment(currentPhoto?.comment || '');
    setShowComment(false);
    setZoom(1);
    setTouchStart(null);
    forceUpdate({});
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

  // Block native browser gestures and keyboard handling
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    
    // Block native touch gestures on mobile
    const preventDefaultTouch = (e: TouchEvent) => {
      if (e.touches.length >= 2) {
        e.preventDefault();
      }
    };
    
    document.addEventListener('touchmove', preventDefaultTouch, { passive: false });
    document.body.style.touchAction = 'none';
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('touchmove', preventDefaultTouch);
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    };
  }, [handleKeyDown]);

  // Mobile touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Start pinch-to-zoom
      e.preventDefault();
      isPinchingRef.current = true;
      isFirstPinchFrameRef.current = true;
      initialPinchDistanceRef.current = getDistance(e.touches);
      initialScaleRef.current = scaleRef.current;
    } else if (e.touches.length === 1) {
      const touch = e.touches[0];
      lastTouchRef.current = { x: touch.clientX, y: touch.clientY };
      
      if (scaleRef.current > 1) {
        // Pan mode when zoomed
        isPanningRef.current = true;
      } else {
        // Swipe navigation mode
        setTouchStart(touch.clientX);
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && isPinchingRef.current) {
      e.preventDefault();
      
      // First frame: only capture reference, no visual change
      if (isFirstPinchFrameRef.current) {
        initialPinchDistanceRef.current = getDistance(e.touches);
        isFirstPinchFrameRef.current = false;
        return;
      }
      
      const currentDistance = getDistance(e.touches);
      const initialDistance = initialPinchDistanceRef.current!;
      
      // Sensitivity factor (200px = 1x additional zoom)
      const sensitivity = 200;
      const delta = (currentDistance - initialDistance) / sensitivity;
      
      // Calculate new scale based on INITIAL value of gesture
      const newScale = clamp(initialScaleRef.current + delta, 1, 2);
      
      scaleRef.current = newScale;
      forceUpdate({});
    } else if (e.touches.length === 1 && isPanningRef.current && scaleRef.current > 1) {
      // Pan image when scale > 1
      e.preventDefault();
      
      const touch = e.touches[0];
      const dx = touch.clientX - lastTouchRef.current.x;
      const dy = touch.clientY - lastTouchRef.current.y;
      
      lastTouchRef.current = { x: touch.clientX, y: touch.clientY };
      
      // Limit pan to container size
      const maxPan = (scaleRef.current - 1) * 150;
      positionRef.current = {
        x: clamp(positionRef.current.x + dx, -maxPan, maxPan),
        y: clamp(positionRef.current.y + dy, -maxPan, maxPan),
      };
      
      forceUpdate({});
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (isPinchingRef.current) {
      isPinchingRef.current = false;
      initialPinchDistanceRef.current = null;
      isFirstPinchFrameRef.current = true;
      
      // If scale returned to ~1, reset position
      if (scaleRef.current <= 1.05) {
        scaleRef.current = 1;
        positionRef.current = { x: 0, y: 0 };
        forceUpdate({});
      }
      return;
    }
    
    if (isPanningRef.current) {
      isPanningRef.current = false;
      return;
    }
    
    // Swipe navigation (only when scale === 1)
    if (touchStart !== null && e.changedTouches.length === 1 && scaleRef.current === 1) {
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

  // Desktop zoom with mouse wheel
  const handleWheel = (e: React.WheelEvent) => {
    if (!isMobile) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.15 : 0.15;
      setZoom(z => clamp(z + delta, 1, 2));
    }
  };

  const handleSaveComment = () => {
    onComment?.(currentPhoto.id, comment);
    setShowComment(false);
  };

  const handleBackgroundClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!currentPhoto) return null;

  // Calculate image transform based on device
  const getImageTransform = () => {
    if (isMobile) {
      const scale = scaleRef.current;
      const pos = positionRef.current;
      if (scale === 1 && pos.x === 0 && pos.y === 0) {
        return undefined;
      }
      return `scale(${scale}) translate(${pos.x / scale}px, ${pos.y / scale}px)`;
    }
    return zoom > 1 ? `scale(${zoom})` : undefined;
  };

  const isGestureActive = isPinchingRef.current || isPanningRef.current;

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
                onClick={() => setZoom(z => Math.max(1, z - 0.25))}
                disabled={zoom <= 1}
              >
                <ZoomOut className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/10"
                onClick={() => setZoom(z => Math.min(2, z + 0.25))}
                disabled={zoom >= 2}
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

        {/* Image Container */}
        <div 
          className="relative flex items-center justify-center overflow-hidden"
          style={{ 
            width: isMobile ? 'calc(100vw - 32px)' : 'calc(100vw - 120px)',
            height: isMobile ? 'calc(100vh - 140px)' : 'calc(100vh - 180px)',
            touchAction: 'none',
          }}
          onClick={(e) => e.stopPropagation()}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onWheel={handleWheel}
        >
          <img
            src={currentPhoto.previewUrl}
            alt={currentPhoto.filename}
            className="select-none"
            draggable={false}
            style={{ 
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              transform: getImageTransform(),
              transformOrigin: 'center center',
              transition: isGestureActive ? 'none' : 'transform 0.2s ease-out',
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
            size={isMobile ? 'icon' : 'default'}
            className={cn(
              !isMobile && 'gap-2',
              !currentPhoto.isSelected && 'text-white border-white/40 hover:bg-white/10'
            )}
          >
            <Check className="h-4 w-4" />
            {!isMobile && (currentPhoto.isSelected ? 'Selecionada' : 'Selecionar')}
          </Button>

          {onFavorite && (
            <Button
              onClick={() => !disabled && onFavorite(currentPhoto.id)}
              disabled={disabled}
              variant="outline"
              size={isMobile ? 'icon' : 'default'}
              className={cn(
                !isMobile && 'gap-2',
                currentPhoto.isFavorite 
                  ? 'text-red-500 border-red-500/40' 
                  : 'text-white border-white/40 hover:bg-white/10'
              )}
            >
              <Heart className={cn("h-4 w-4", currentPhoto.isFavorite && "fill-current")} />
              {!isMobile && (currentPhoto.isFavorite ? 'Favoritada' : 'Favoritar')}
            </Button>
          )}
          
          {allowComments && (
            <Button
              onClick={() => setShowComment(!showComment)}
              variant="outline"
              size={isMobile ? 'icon' : 'default'}
              className={cn(
                !isMobile && 'gap-2',
                'text-white border-white/40 hover:bg-white/10',
                currentPhoto.comment && 'text-primary border-primary'
              )}
            >
              <MessageSquare className="h-4 w-4" />
              {!isMobile && 'Comentar'}
            </Button>
          )}

          {allowDownload && (
            <Button
              onClick={handleDownload}
              variant="outline"
              size={isMobile ? 'icon' : 'default'}
              className={cn(
                !isMobile && 'gap-2',
                'text-white border-white/40 hover:bg-white/10'
              )}
            >
              <Download className="h-4 w-4" />
              {!isMobile && 'Baixar'}
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
