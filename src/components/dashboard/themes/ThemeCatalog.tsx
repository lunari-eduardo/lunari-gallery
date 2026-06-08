import React, { useState } from 'react';
import { THEME_REGISTRY } from '@/components/gallery/themes/registry';
import { cn } from '@/lib/utils';
import { Check, Eye } from 'lucide-react';
import { ThemePreviewModal } from './ThemePreviewModal';
import { Button } from '@/components/ui/button';

interface ThemeCatalogProps {
  selectedThemeId: string;
  onSelect: (themeId: string) => void;
  onThemeOverridesChange?: (overrides: any) => void;
  initialOverrides?: any;
}

export function ThemeCatalog({ 
  selectedThemeId, 
  onSelect, 
  onThemeOverridesChange,
  initialOverrides 
}: ThemeCatalogProps) {
  const themes = Object.values(THEME_REGISTRY);
  const [previewThemeId, setPreviewThemeId] = useState<string | null>(null);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {themes.map((theme) => {
        const isSelected = selectedThemeId === theme.id;
        
        return (
          <div key={theme.id} className="group relative">
            <button
              onClick={() => onSelect(theme.id)}
              className={cn(
                "w-full flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all",
                isSelected 
                  ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary" 
                  : "border-border bg-card hover:border-primary/50 hover:bg-accent/50"
              )}
            >
              {/* Visual Representation of the Theme */}
              <div 
                className="w-full aspect-[4/3] rounded-lg border border-border overflow-hidden bg-background flex flex-col p-1.5 gap-1 shadow-inner relative"
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
                <div className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md animate-in zoom-in-50 duration-200 z-10">
                  <Check className="h-4 w-4" />
                </div>
              )}
            </button>
            
            <Button
              variant="secondary"
              size="sm"
              className="absolute top-2 left-2 h-7 px-2 bg-background/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity z-10 gap-1.5 text-[10px]"
              onClick={(e) => {
                e.stopPropagation();
                setPreviewThemeId(theme.id);
              }}
            >
              <Eye className="h-3 w-3" />
              Ver
            </Button>
          </div>
        );
      })}

      {previewThemeId && (
        <ThemePreviewModal
          isOpen={!!previewThemeId}
          onOpenChange={(open) => !open && setPreviewThemeId(null)}
          themeId={previewThemeId}
          initialOverrides={previewThemeId === selectedThemeId ? initialOverrides : {}}
          onApply={(data) => {
            onSelect(data.themeId);
            onThemeOverridesChange?.(data.themeOverrides);
          }}
        />
      )}
    </div>
  );
}

