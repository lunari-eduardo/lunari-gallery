import { useState } from 'react';
import { Check } from 'lucide-react';
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
}

export function MemoryPhotoSelector({ photos, selected, onSelectionChange, maxSelection = 4, isDark }: Props) {
  const toggle = (id: string) => {
    if (selected.includes(id)) {
      onSelectionChange(selected.filter(s => s !== id));
    } else if (selected.length < maxSelection) {
      onSelectionChange([...selected, id]);
    }
  };

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      <p
        className="text-sm tracking-wide opacity-80"
        style={{ color: isDark ? '#A8A29E' : '#78716C' }}
      >
        {selected.length} de {maxSelection} fotos selecionadas
      </p>

      <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 w-full max-w-2xl">
        {photos.map((photo) => {
          const isSelected = selected.includes(photo.id);
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
                    ? 'rgba(0,0,0,0.15)'
                    : 'transparent',
                }}
              />
              {isSelected && (
                <div
                  className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300"
                  style={{
                    backgroundColor: isDark ? '#F5F5F4' : '#1C1917',
                  }}
                >
                  <Check className="w-3.5 h-3.5" style={{ color: isDark ? '#1C1917' : '#F5F5F4' }} />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
