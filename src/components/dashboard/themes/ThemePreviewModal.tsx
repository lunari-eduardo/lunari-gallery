import React, { useState } from 'react';
import { THEME_REGISTRY } from '@/components/gallery/themes/registry';
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
import { Switch } from '@/components/ui/switch';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { GalleryDensity } from '@/components/gallery/themes/types';
import { Smartphone, Tablet, Monitor, Check, EyeOff, Eye } from 'lucide-react';
import { ThemePreviewCanvas } from './ThemePreviewCanvas';

interface ThemePreviewModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  themeId: string;
  initialOverrides?: any;
  onApply: (data: { themeId: string; themeOverrides: any }) => void;
  title?: string;
}

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
  const [skipHero, setSkipHero] = useState(false);

  const theme = THEME_REGISTRY[themeId] || THEME_REGISTRY['lunari'];
  
  const currentOverrides = {
    ...initialOverrides,
    layout: {
      ...initialOverrides?.layout,
      gap,
      density
    }
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
      <DialogContent className="max-w-[98vw] w-[1400px] h-[95vh] flex flex-col p-0 overflow-hidden gap-0 bg-background border-none shadow-2xl">
        <DialogHeader className="p-4 md:p-6 border-b shrink-0 bg-card">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <DialogTitle className="text-xl font-semibold tracking-tight">
                {title}: <span className="text-primary">{theme.name}</span>
              </DialogTitle>
              <DialogDescription className="text-xs md:text-sm">
                Preview real (WYSIWYG). O que você vê aqui é exatamente o que seu cliente verá.
              </DialogDescription>
            </div>
            
            <div className="flex bg-muted p-1 rounded-xl self-center md:self-auto">
              <Button 
                variant={viewport === 'mobile' ? 'secondary' : 'ghost'} 
                size="sm" 
                className="h-9 px-3 gap-2"
                onClick={() => setViewport('mobile')}
              >
                <Smartphone className="h-4 w-4" />
                <span className="hidden sm:inline text-xs">Mobile</span>
              </Button>
              <Button 
                variant={viewport === 'tablet' ? 'secondary' : 'ghost'} 
                size="sm" 
                className="h-9 px-3 gap-2"
                onClick={() => setViewport('tablet')}
              >
                <Tablet className="h-4 w-4" />
                <span className="hidden sm:inline text-xs">Tablet</span>
              </Button>
              <Button 
                variant={viewport === 'desktop' ? 'secondary' : 'ghost'} 
                size="sm" 
                className="h-9 px-3 gap-2"
                onClick={() => setViewport('desktop')}
              >
                <Monitor className="h-4 w-4" />
                <span className="hidden sm:inline text-xs">Desktop</span>
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 flex overflow-hidden">
          {/* Controls Sidebar */}
          <div className="hidden lg:flex w-[320px] border-r p-6 flex-col gap-8 bg-card overflow-y-auto shrink-0">
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Espaçamento (Gap)</Label>
                <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">{gap}px</span>
              </div>
              <Slider
                value={[gap]}
                onValueChange={(vals) => setGap(vals[0])}
                min={0}
                max={40}
                step={1}
                className="cursor-pointer"
              />
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Define a distância entre as fotos. Temas editoriais brilham com gaps de 6-12px.
              </p>
            </div>

            <div className="space-y-4">
              <Label className="text-sm font-medium">Densidade Visual</Label>
              <Select value={density} onValueChange={(val) => setDensity(val as GalleryDensity)}>
                <SelectTrigger className="bg-background h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="compact">Compacto (Mais colunas)</SelectItem>
                  <SelectItem value="comfortable">Confortável (Equilibrado)</SelectItem>
                  <SelectItem value="airy">Espaçado (Foco Individual)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Controla o tamanho das imagens na grade. "Compacto" é ideal para eventos com muitas fotos.
              </p>
            </div>

            <div className="pt-6 border-t space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Pular Hero</Label>
                  <p className="text-[10px] text-muted-foreground">Inspecionar grid sem scroll</p>
                </div>
                <Switch 
                  checked={skipHero} 
                  onCheckedChange={setSkipHero}
                />
              </div>
            </div>

            <div className="mt-auto">
              <div className="bg-primary/5 rounded-2xl p-4 border border-primary/10 space-y-2">
                <div className="flex items-center gap-2 text-primary">
                  <Eye className="h-4 w-4" />
                  <h4 className="text-xs font-bold uppercase tracking-wider">Regra de Ouro</h4>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Cantos retos e ausência de sombras são padrão em todos os temas para valorizar a fotografia profissional.
                </p>
              </div>
            </div>
          </div>

          {/* Real Preview Canvas Component */}
          <ThemePreviewCanvas 
            themeId={themeId}
            themeOverrides={currentOverrides}
            viewport={viewport}
            skipHero={skipHero}
          />
        </div>

        <DialogFooter className="p-4 border-t shrink-0 bg-card flex flex-row items-center justify-between">
          <div className="hidden sm:block">
            <p className="text-[10px] text-muted-foreground">Persistindo ajustes para o tema <span className="font-bold">{theme.name}</span></p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleApply} className="gap-2 px-6 shadow-lg shadow-primary/20">
              <Check className="h-4 w-4" />
              Aplicar Ajustes
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
