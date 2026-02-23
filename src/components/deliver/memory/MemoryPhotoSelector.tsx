import { Check, Star } from 'lucide-react';
import { getPhotoUrl, PhotoPaths } from '@/lib/photoUrl';

export interface MemoryPhoto {
  id: string;
  storageKey: string;
  previewPath?: string | null;
  thumbPath?: string | null;
  width: number;
  height: number;
}

interface Props {
  photos: MemoryPhoto[];
  selected: string[];
  onSelectionChange: (ids: string[]) => void;
  maxSelection?: number;
  isDark: boolean;
  highlightId?: string | null;
  onHighlightChange?: (id: string | null) => void;
}

export function MemoryPhotoSelector({ photos, selected, onSelectionChange, maxSelection = 10, isDark, highlightId, onHighlightChange }: Props) {
  const toggle = (id: string) => {
    if (selected.includes(id)) {
      // Second tap on selected photo: toggle highlight
      if (highlightId === id) {
        onHighlightChange?.(null);
      } else {
        onHighlightChange?.(id);
      }
    } else if (selected.length < maxSelection) {
      onSelectionChange([...selected, id]);
    }
  };

  const deselect = (id: string) => {
    if (highlightId === id) onHighlightChange?.(null);
    onSelectionChange(selected.filter(s => s !== id));
  };

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      <div className="flex flex-col items-center gap-1">
        <p
          className="text-sm tracking-wide opacity-80"
          style={{ color: isDark ? '#A8A29E' : '#78716C' }}
        >
          {selected.length} de {maxSelection} fotos selecionadas
        </p>
        {highlightId && (
          <p
            className="text-xs tracking-wide opacity-60"
            style={{ color: isDark ? '#A8A29E' : '#78716C' }}
          >
            ★ Foto destaque selecionada
          </p>
        )}
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 w-full max-w-2xl">
        {photos.map((photo) => {
          const isSelected = selected.includes(photo.id);
          const isHighlight = highlightId === photo.id;
          const paths: PhotoPaths = {
            storageKey: photo.storageKey,
            thumbPath: photo.thumbPath,
            previewPath: photo.previewPath,
            width: photo.width,
            height: photo.height,
          };
          const url = getPhotoUrl(paths, 'thumbnail');

          return (
            <button
              key={photo.id}
              onClick={() => toggle(photo.id)}
              onDoubleClick={(e) => {
                e.preventDefault();
                if (isSelected) deselect(photo.id);
              }}
              className="relative aspect-square overflow-hidden group focus:outline-none"
              style={{
                opacity: !isSelected && selected.length >= maxSelection ? 0.35 : 1,
              }}
            >
              <img
                src={url}
                alt=""
                loading="lazy"
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              />
              {/* Selection overlay */}
              <div
                className="absolute inset-0 transition-all duration-300"
                style={{
                  backgroundColor: isSelected
                    ? isHighlight ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.15)'
                    : 'transparent',
                  boxShadow: isHighlight ? 'inset 0 0 0 2px #EAB308' : 'none',
                }}
              />
              {isSelected && (
                <div
                  className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300"
                  style={{
                    backgroundColor: isHighlight ? '#EAB308' : (isDark ? '#F5F5F4' : '#1C1917'),
                  }}
                >
                  {isHighlight ? (
                    <Star className="w-3.5 h-3.5 fill-current" style={{ color: '#1C1917' }} />
                  ) : (
                    <Check className="w-3.5 h-3.5" style={{ color: isDark ? '#1C1917' : '#F5F5F4' }} />
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {selected.length > 0 && !highlightId && (
        <p
          className="text-xs tracking-wide opacity-50 text-center max-w-[240px]"
          style={{ color: isDark ? '#A8A29E' : '#78716C' }}
        >
          Toque novamente em uma foto selecionada para marcá-la como destaque
        </p>
      )}
    </div>
  );
}
