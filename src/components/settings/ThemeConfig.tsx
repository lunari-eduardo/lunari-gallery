import { useState, useEffect } from 'react';
import { Palette, Layers } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { ThemeCatalog } from '@/components/dashboard/themes/ThemeCatalog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GalleryDensity } from '@/components/gallery/themes/types';

interface ThemeConfigProps {
  defaultThemeId: string;
  themeOverrides: any;
  onUpdate: (data: { defaultThemeId?: string; themeOverrides?: any }) => void;
}

export function ThemeConfig({
  defaultThemeId,
  themeOverrides,
  onUpdate,
}: ThemeConfigProps) {
  const [localSpacing, setLocalSpacing] = useState<number>(themeOverrides?.layout?.gap ?? 8);
  const [localDensity, setLocalDensity] = useState<GalleryDensity>(themeOverrides?.layout?.density ?? 'comfortable');

  useEffect(() => {
    setLocalSpacing(themeOverrides?.layout?.gap ?? 8);
    setLocalDensity(themeOverrides?.layout?.density ?? 'comfortable');
  }, [themeOverrides]);

  const handleSpacingChange = (vals: number[]) => {
    setLocalSpacing(vals[0]);
  };

  const handleSpacingCommit = (vals: number[]) => {
    const newOverrides = {
      ...themeOverrides,
      layout: {
        ...(themeOverrides.layout || {}),
        gap: vals[0]
      }
    };
    onUpdate({ themeOverrides: newOverrides });
  };

  const handleDensityChange = (density: string) => {
    setLocalDensity(density as GalleryDensity);
    const newOverrides = {
      ...themeOverrides,
      layout: {
        ...(themeOverrides.layout || {}),
        density: density
      }
    };
    onUpdate({ themeOverrides: newOverrides });
  };

  return (
    <div className="space-y-10">
      {/* Theme Selection */}
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Palette className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-base">Presets de Temas</h3>
            <p className="text-sm text-muted-foreground">Escolha a base visual das suas galerias</p>
          </div>
        </div>
        
        <ThemeCatalog 
          selectedThemeId={defaultThemeId} 
          onSelect={(id) => onUpdate({ defaultThemeId: id })} 
        />
      </div>

      <div className="h-px bg-border" />

      {/* Visual Adjustments */}
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Layers className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-base">Ajustes Visuais (Overrides)</h3>
            <p className="text-sm text-muted-foreground">Personalize a densidade e o respiro do layout</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Spacing */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Espaçamento (Gap)</Label>
              <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{localSpacing}px</span>
            </div>
            <Slider
              value={[localSpacing]}
              onValueChange={handleSpacingChange}
              onValueCommit={handleSpacingCommit}
              min={0}
              max={40}
              step={1}
            />
            <p className="text-[11px] text-muted-foreground italic">
              Afeta o respiro entre as fotos em todas as colunas.
            </p>
          </div>

          {/* Density */}
          <div className="space-y-4">
            <Label className="text-sm font-medium">Densidade Visual</Label>
            <Select value={localDensity} onValueChange={handleDensityChange}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a densidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="compact">Compacto (Mais fotos, menos respiro)</SelectItem>
                <SelectItem value="comfortable">Confortável (Equilibrado)</SelectItem>
                <SelectItem value="airy">Espaçado (Foco editorial, poucas fotos por linha)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground italic">
              Ajusta automaticamente colunas e margens para criar diferentes "sentimentos" visuais.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

