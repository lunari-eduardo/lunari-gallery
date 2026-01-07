import { useEffect, useState, useCallback } from 'react';
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Check, 
  MessageSquare,
  ZoomIn,
  ZoomOut,
  Download
} from 'lucide-react';
import { GalleryPhoto, WatermarkSettings, WatermarkDisplay } from '@/types/gallery';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

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
  onComment
}: LightboxProps) {
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState('');
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);

  const currentPhoto = photos[currentIndex];
  
  // Show watermark in fullscreen if watermarkDisplay is 'all' or 'fullscreen'
  const showWatermark = watermark && watermark.type !== 'none' && watermarkDisplay !== 'none';

  const handleDownload = () => {
    if (!currentPhoto || !allowDownload) return;
    const link = document.createElement('a');
    link.href = currentPhoto.previewUrl;
    link.download = currentPhoto.filename;
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
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
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
  };

  const handleSaveComment = () => {
    onComment?.(currentPhoto.id, comment);
    setShowComment(false);
  };

  const watermarkPosition = {
    'top-left': 'top-4 left-4',
    'top-right': 'top-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'center': 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
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
            {currentPhoto.filename}
          </span>
        </div>
        <div className="flex items-center gap-2">
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
            onClick={() => setZoom(z => Math.min(3, z + 0.5))}
            disabled={zoom >= 3}
          >
            <ZoomIn className="h-5 w-5" />
          </Button>
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
        className="flex-1 flex items-center justify-center p-4 relative overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Navigation Arrows */}
        {currentIndex > 0 && (
          <button
            onClick={() => onNavigate(currentIndex - 1)}
            className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-black/40 flex items-center justify-center text-white/80 hover:bg-black/60 hover:text-white transition-colors z-10"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}
        {currentIndex < photos.length - 1 && (
          <button
            onClick={() => onNavigate(currentIndex + 1)}
            className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-black/40 flex items-center justify-center text-white/80 hover:bg-black/60 hover:text-white transition-colors z-10"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}

        {/* Image */}
        <div className="relative max-h-full max-w-full overflow-auto">
          <img
            src={currentPhoto.previewUrl}
            alt={currentPhoto.filename}
            className="max-h-[80vh] max-w-full object-contain transition-transform duration-200"
            style={{ transform: `scale(${zoom})` }}
          />
          
          {/* Watermark */}
          {showWatermark && (
            <div 
              className={cn(
                'absolute pointer-events-none select-none',
                watermarkPosition[watermark.position]
              )}
              style={{ opacity: watermark.opacity / 100 }}
            >
              {watermark.type === 'text' && (
                <span className="text-white text-lg font-medium drop-shadow-lg">
                  {watermark.text}
                </span>
              )}
              {watermark.type === 'image' && watermark.logoUrl && (
                <img 
                  src={watermark.logoUrl} 
                  alt="" 
                  className="h-12 w-auto drop-shadow-lg"
                />
              )}
            </div>
          )}
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
