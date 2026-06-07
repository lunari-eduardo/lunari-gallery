import React from 'react';
import { GalleryTheme } from '@/types/themes';
import { THEME_REGISTRY } from '@/components/gallery/themes/registry';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface ThemeCatalogProps {
  selectedThemeId: string;
  onSelect: (themeId: string) => void;
}

export function ThemeCatalog({ selectedThemeId, onSelect }: ThemeCatalogProps) {
  const themes = Object.values(THEME_REGISTRY);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {themes.map((theme) => {
        const isSelected = selectedThemeId === theme.id;
        
        return (
          <button
            key={theme.id}
            onClick={() => onSelect(theme.id)}
            className={cn(
              "group relative flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all",
              isSelected 
                ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary" 
                : "border-border bg-card hover:border-primary/50 hover:bg-accent/50"
            )}
          >
            {/* Visual Representation of the Theme */}
            <div 
              className="w-full aspect-[4/3] rounded-lg border border-border overflow-hidden bg-background flex flex-col p-1.5 gap-1 shadow-inner"
            >
              {/* Header Mini */}
              <div className="h-1.5 w-full rounded-sm bg-muted/40" />
              
              {/* Grid Mini */}
              <div className={cn(
                "flex-1 grid gap-1",
                theme.layout.engine === 'masonry-classic' ? "grid-cols-3" : "grid-cols-2"
              )}>
                <div className="rounded-sm bg-muted/20" />
                <div className="rounded-sm bg-muted/20" />
                <div className="rounded-sm bg-muted/20" />
                <div className="rounded-sm bg-muted/20" />
              </div>
            </div>

            <div className="flex flex-col items-center">
              <span className="font-medium text-sm">{theme.name}</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                {theme.layout.engine === 'editorial-grid' ? 'Editorial' : 'Classic'}
              </span>
            </div>

            {isSelected && (
              <div className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md animate-in zoom-in-50 duration-200">
                <Check className="h-4 w-4" />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
