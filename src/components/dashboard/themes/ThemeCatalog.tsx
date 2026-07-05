import React, { useState } from 'react';
import { THEME_REGISTRY, CANONICAL_THEME_IDS } from '@/components/gallery/themes/registry';
import { cn } from '@/lib/utils';
import { Check, Eye } from 'lucide-react';
import { ThemePreviewModal } from './ThemePreviewModal';
import { ThemePreviewCanvas } from './ThemePreviewCanvas';
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
  // Renderiza apenas os temas canônicos — aliases retrocompat ficam ocultos.
  const themes = CANONICAL_THEME_IDS
    .map((id) => THEME_REGISTRY[id])
    .filter(Boolean);
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
                "w-full flex flex-col items-center gap-3 p-4 rounded-2xl border-2 transition-all group/card overflow-hidden",
                isSelected 
                  ? "border-primary bg-primary/5 shadow-xl ring-1 ring-primary/20" 
                  : "border-border bg-card hover:border-primary/50 hover:bg-accent/20"
              )}
            >
              {/* Thumbnail Real */}
              <div 
                className="w-full aspect-[4/3] rounded-xl border border-border overflow-hidden bg-muted relative group-hover/card:shadow-lg transition-all"
              >
                <div className="absolute inset-0 scale-[0.4] origin-top-left w-[250%] h-[250%] pointer-events-none opacity-90 group-hover/card:opacity-100 transition-opacity">
                   {/* Mini preview canvas em modo thumbnail */}
                   <ThemePreviewCanvas 
                     themeId={theme.id}
                     themeOverrides={theme.id === selectedThemeId ? initialOverrides : {}}
                      viewport="desktop"
                      skipHero={true}
                      isBlueprint={true}
                    />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
              </div>

              <div className="flex flex-col items-center">
                <span className="font-bold text-sm tracking-tight">{theme.name}</span>
                <span className="text-[9px] text-muted-foreground uppercase tracking-[0.15em] font-medium opacity-70">
                  {theme.id === 'editorial' ? 'Editorial' : theme.id === 'clean' ? 'Classic' : 'Contemporâneo'}
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

