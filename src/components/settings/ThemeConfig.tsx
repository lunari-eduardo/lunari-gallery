import { useState, useEffect } from 'react';
import { Palette, Layers } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { ThemeCatalog } from '@/components/dashboard/themes/ThemeCatalog';

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

  useEffect(() => {
    setLocalSpacing(themeOverrides?.layout?.gap ?? 8);
  }, [themeOverrides]);

  const handleSpacingChange = (vals: number[]) => {
    setLocalSpacing(vals[0]);
  };

  const handleSpacingCommit = (vals: number[]) => {
    // Ao gravar novos overrides, também limpamos o legado `density` — a
    // densidade agora vem sempre do preset selecionado.
    const nextLayout = { ...(themeOverrides?.layout || {}), gap: vals[0] };
    if ('density' in nextLayout) delete (nextLayout as any).density;
    const newOverrides = {
      ...themeOverrides,
      layout: nextLayout,
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
            <p className="text-sm text-muted-foreground">Ajuste o espaçamento entre as fotos</p>
          </div>
        </div>

        <div className="max-w-md space-y-4">
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
      </div>
    </div>
  );
}
