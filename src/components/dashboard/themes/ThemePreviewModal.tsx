import React, { useState } from 'react';
import { GalleryTheme, DEFAULT_GALLERY_THEME } from '@/types/themes';
import { THEME_REGISTRY } from '@/components/gallery/themes/registry';
import { GalleryThemeProvider } from '@/hooks/useGalleryDisplayTheme';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { GalleryDensity } from '@/components/gallery/themes/types';
import { Smartphone, Tablet, Monitor, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ThemePreviewModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  themeId: string;
  initialOverrides?: any;
  onApply: (data: { themeId: string; themeOverrides: any }) => void;
  title?: string;
}

// 8 placeholders with different colors to simulate a real gallery
const PLACEHOLDERS = [
  'bg-slate-200', 'bg-zinc-200', 'bg-neutral-200', 'bg-stone-200',
  'bg-slate-300', 'bg-zinc-300', 'bg-neutral-300', 'bg-stone-300'
];

export function ThemePreviewModal({
  isOpen,
  onOpenChange,
  themeId,
  initialOverrides,
  onApply,
  title = "Visualizar Tema"
}: ThemePreviewModalProps) {
  const [viewport, setViewport] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');
  const [gap, setGap] = useState<number>(initialOverrides?.layout?.gap ?? 8);
  const [density, setDensity] = useState<GalleryDensity>(initialOverrides?.layout?.density ?? 'comfortable');

  const theme = THEME_REGISTRY[themeId] || THEME_REGISTRY['lunari'];
  
  const currentOverrides = {
    ...initialOverrides,
    layout: {
      ...initialOverrides?.layout,
      gap,
      density
    }
  };

  const viewportWidths = {
    mobile: 'max-w-[375px]',
    tablet: 'max-w-[768px]',
    desktop: 'max-w-full'
  };

  const handleApply = () => {
    onApply({
      themeId,
      themeOverrides: currentOverrides
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[1200px] h-[90vh] flex flex-col p-0 overflow-hidden gap-0">
        <DialogHeader className="p-6 border-b shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl">{title}: {theme.name}</DialogTitle>
              <DialogDescription>
                Ajuste os parâmetros visuais e veja como eles impactam o layout real da galeria.
              </DialogDescription>
            </div>
            
            <div className="flex bg-muted p-1 rounded-lg">
              <Button 
                variant={viewport === 'mobile' ? 'secondary' : 'ghost'} 
                size="sm" 
                className="h-8 w-8 p-0"
                onClick={() => setViewport('mobile')}
              >
                <Smartphone className="h-4 w-4" />
              </Button>
              <Button 
                variant={viewport === 'tablet' ? 'secondary' : 'ghost'} 
                size="sm" 
                className="h-8 w-8 p-0"
                onClick={() => setViewport('tablet')}
              >
                <Tablet className="h-4 w-4" />
              </Button>
              <Button 
                variant={viewport === 'desktop' ? 'secondary' : 'ghost'} 
                size="sm" 
                className="h-8 w-8 p-0"
                onClick={() => setViewport('desktop')}
              >
                <Monitor className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 flex overflow-hidden">
          {/* Controls Sidebar */}
          <div className="w-[300px] border-r p-6 space-y-8 bg-muted/30 overflow-y-auto shrink-0">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Espaçamento (Gap)</Label>
                <span className="text-xs font-mono bg-background px-1.5 py-0.5 rounded border">{gap}px</span>
              </div>
              <Slider
                value={[gap]}
                onValueChange={(vals) => setGap(vals[0])}
                min={0}
                max={40}
                step={1}
              />
              <p className="text-[11px] text-muted-foreground italic">
                Respiro entre as fotos em todas as colunas.
              </p>
            </div>

            <div className="space-y-4">
              <Label className="text-sm font-semibold">Densidade Visual</Label>
              <Select value={density} onValueChange={(val) => setDensity(val as GalleryDensity)}>
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="compact">Compacto</SelectItem>
                  <SelectItem value="comfortable">Confortável</SelectItem>
                  <SelectItem value="airy">Espaçado (Editorial)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground italic">
                Ajusta colunas e proporções para o "feel" visual.
              </p>
            </div>

            <div className="pt-4 border-t">
              <div className="bg-primary/5 rounded-lg p-3 border border-primary/10">
                <h4 className="text-xs font-bold uppercase text-primary mb-1">Dica de UX</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Temas **Editoriais** funcionam melhor com gaps maiores (12px+) e densidade "Espaçado".
                </p>
              </div>
            </div>
          </div>

          {/* Real Preview Canvas */}
          <div className="flex-1 bg-zinc-100 dark:bg-zinc-950 p-8 flex items-center justify-center overflow-auto">
            <div className={cn(
              "w-full h-full bg-background rounded-lg shadow-2xl border overflow-y-auto transition-all duration-300",
              viewportWidths[viewport]
            )}>
              <GalleryThemeProvider 
                activeThemeId={themeId}
                themeOverrides={currentOverrides}
              >
                <div className="p-4 space-y-4">
                  {/* Fake Header */}
                  <div className="h-12 w-full flex items-center justify-between border-b mb-6 opacity-40">
                    <div className="h-4 w-24 bg-muted rounded" />
                    <div className="flex gap-2">
                      <div className="h-4 w-4 bg-muted rounded" />
                      <div className="h-4 w-4 bg-muted rounded" />
                    </div>
                  </div>

                  {/* Fake Title */}
                  <div className="text-center mb-10">
                    <div className="h-8 w-48 bg-muted rounded mx-auto mb-2" />
                    <div className="h-4 w-32 bg-muted/60 rounded mx-auto" />
                  </div>

                  {/* The actual Theme Mockup Grid */}
                  <div className={cn(
                    "grid",
                    // Use columns from theme layout, but we mock the grid engine
                    theme.layout.engine === 'masonry-classic' ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-5" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
                  )} style={{ gap: `${gap}px` }}>
                    {PLACEHOLDERS.map((bg, i) => (
                      <div 
                        key={i} 
                        className={cn(
                          "rounded-md aspect-square animate-pulse", 
                          bg,
                          // Simulate density effects
                          density === 'compact' ? "scale-100" : density === 'airy' ? "scale-95" : "scale-[0.98]"
                        )}
                      />
                    ))}
                  </div>
                </div>
              </GalleryThemeProvider>
            </div>
          </div>
        </div>

        <DialogFooter className="p-4 border-t shrink-0 bg-background">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleApply} className="gap-2">
            <Check className="h-4 w-4" />
            Aplicar Ajustes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
