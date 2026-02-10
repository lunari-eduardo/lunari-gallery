import { useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { getPhotoUrl, PhotoPaths } from '@/lib/photoUrl';
import { DeliverPhoto } from './DeliverPhotoGrid';

interface DeliverLightboxProps {
  photos: DeliverPhoto[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
  onDownload: (photo: DeliverPhoto) => void;
}

export function DeliverLightbox({ photos, currentIndex, onClose, onNavigate, onDownload }: DeliverLightboxProps) {
  const photo = photos[currentIndex];

  const goPrev = useCallback(() => {
    if (currentIndex > 0) onNavigate(currentIndex - 1);
  }, [currentIndex, onNavigate]);

  const goNext = useCallback(() => {
    if (currentIndex < photos.length - 1) onNavigate(currentIndex + 1);
  }, [currentIndex, photos.length, onNavigate]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, goPrev, goNext]);

  if (!photo) return null;

  const paths: PhotoPaths = {
    storageKey: photo.storageKey,
    previewPath: photo.previewPath,
    width: photo.width,
    height: photo.height,
  };
  const url = getPhotoUrl(paths, 'preview');

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3">
        <span className="text-white/50 text-sm">{currentIndex + 1} / {photos.length}</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onDownload(photo)}
            className="p-2 text-white/70 hover:text-white transition-colors"
            title="Baixar"
          >
            <Download className="w-5 h-5" />
          </button>
          <button
            onClick={onClose}
            className="p-2 text-white/70 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Navigation arrows */}
      {currentIndex > 0 && (
        <button
          onClick={goPrev}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-2 text-white/50 hover:text-white transition-colors"
        >
          <ChevronLeft className="w-8 h-8" />
        </button>
      )}
      {currentIndex < photos.length - 1 && (
        <button
          onClick={goNext}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-2 text-white/50 hover:text-white transition-colors"
        >
          <ChevronRight className="w-8 h-8" />
        </button>
      )}

      {/* Image */}
      <img
        src={url}
        alt={photo.originalFilename}
        className="max-w-full max-h-full object-contain select-none"
        draggable={false}
      />
    </div>
  );
}
