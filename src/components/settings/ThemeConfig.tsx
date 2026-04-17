import { useState, useEffect } from 'react';
import { Palette, Sun, Moon } from 'lucide-react';
import { CustomTheme, ThemeType } from '@/types/gallery';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

interface ThemeConfigProps {
  themeType: ThemeType;
  customTheme?: CustomTheme;
  onThemeTypeChange: (type: ThemeType) => void;
  onSaveCustomTheme: (theme: Omit<CustomTheme, 'id'> & { id?: string }) => void;
  onDeleteCustomTheme?: () => void;
}

export function ThemeConfig({
  themeType,
  customTheme,
  onThemeTypeChange,
  onSaveCustomTheme,
  onDeleteCustomTheme,
}: ThemeConfigProps) {
  const [backgroundMode, setBackgroundMode] = useState<'light' | 'dark'>(customTheme?.backgroundMode || 'light');
  const [primaryColor, setPrimaryColor] = useState(customTheme?.primaryColor || '#B87333');
  const [accentColor, setAccentColor] = useState(customTheme?.accentColor || '#8B9A7D');
  const [emphasisColor, setEmphasisColor] = useState(customTheme?.emphasisColor || '#2D2A26');
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (customTheme) {
      setBackgroundMode(customTheme.backgroundMode);
      setPrimaryColor(customTheme.primaryColor);
      setAccentColor(customTheme.accentColor);
      setEmphasisColor(customTheme.emphasisColor);
      setHasChanges(false);
    }
  }, [customTheme]);

  useEffect(() => {
    if (customTheme) {
      const changed =
        backgroundMode !== customTheme.backgroundMode ||
        primaryColor !== customTheme.primaryColor ||
        accentColor !== customTheme.accentColor ||
        emphasisColor !== customTheme.emphasisColor;
      setHasChanges(changed);
    } else if (themeType === 'custom') {
      setHasChanges(true);
    }
  }, [backgroundMode, primaryColor, accentColor, emphasisColor, customTheme, themeType]);

  const handleSave = () => {
    onSaveCustomTheme({
      id: customTheme?.id,
      name: 'Tema Personalizado',
      backgroundMode,
      primaryColor,
      accentColor,
      emphasisColor,
    });
    setHasChanges(false);
  };

  const isCustom = themeType === 'custom';

  // Preview colors
  const previewBg = isCustom
    ? (backgroundMode === 'dark' ? '#1C1917' : '#FAF9F7')
    : '#FAF9F7';
  const previewText = isCustom
    ? (backgroundMode === 'dark' ? '#F5F5F4' : '#2D2A26')
    : '#2D2A26';
  const previewPrimary = isCustom ? primaryColor : '#B87333';
  const previewAccent = isCustom ? accentColor : '#8B9A7D';
  const previewEmphasis = isCustom ? emphasisColor : '#2D2A26';

  return (
    <div className="space-y-5">
      {/* Header + Switch */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Palette className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="font-medium">Tema da Galeria do Cliente</h3>
            <p className="text-sm text-muted-foreground">
              {isCustom ? 'Sua marca, suas cores' : 'Usando cores padrão do Lunari'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Label htmlFor="theme-custom-toggle" className="text-sm cursor-pointer">
            Personalizar
          </Label>
          <Switch
            id="theme-custom-toggle"
            checked={isCustom}
            onCheckedChange={(checked) => onThemeTypeChange(checked ? 'custom' : 'system')}
          />
        </div>
      </div>

      {/* Preview - sempre visível */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Preview</Label>
        <div
          className="h-32 rounded-xl p-4 flex flex-col items-center justify-center gap-3 border"
          style={{ backgroundColor: previewBg }}
        >
          <p className="text-lg font-semibold" style={{ color: previewEmphasis }}>
            Sua Galeria
          </p>
          <div className="flex gap-2 flex-wrap justify-center">
            <div
              className="px-4 py-2 rounded-full text-sm text-white font-medium"
              style={{ backgroundColor: previewPrimary }}
            >
              Botão Principal
            </div>
            <div
              className="px-4 py-2 rounded-full text-sm border-2"
              style={{ borderColor: previewAccent, color: previewText }}
            >
              Selecionado
            </div>
          </div>
        </div>
      </div>

      {/* Custom controls */}
      {isCustom && (
        <div className="space-y-5 pt-4 border-t border-border">
          {/* Background Mode - compact toggle */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <Label className="text-sm font-medium">Fundo</Label>
            <ToggleGroup
              type="single"
              value={backgroundMode}
              onValueChange={(v) => v && setBackgroundMode(v as 'light' | 'dark')}
              variant="outline"
              size="sm"
              className="w-fit"
            >
              <ToggleGroupItem value="light" aria-label="Modo claro" className="gap-1.5">
                <Sun className="h-4 w-4" />
                Claro
              </ToggleGroupItem>
              <ToggleGroupItem value="dark" aria-label="Modo escuro" className="gap-1.5">
                <Moon className="h-4 w-4" />
                Escuro
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {/* Color Pickers */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="primaryColor" className="text-sm">Cor Primária</Label>
              <p className="text-xs text-muted-foreground">Botões e CTAs</p>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  id="primaryColor"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="h-10 w-10 rounded-lg cursor-pointer border-0 shrink-0"
                />
                <Input
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="flex-1 font-mono text-xs"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="accentColor" className="text-sm">Cor de Destaque</Label>
              <p className="text-xs text-muted-foreground">Seleções e bordas</p>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  id="accentColor"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="h-10 w-10 rounded-lg cursor-pointer border-0 shrink-0"
                />
                <Input
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="flex-1 font-mono text-xs"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="emphasisColor" className="text-sm">Cor de Ênfase</Label>
              <p className="text-xs text-muted-foreground">Títulos e valores</p>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  id="emphasisColor"
                  value={emphasisColor}
                  onChange={(e) => setEmphasisColor(e.target.value)}
                  className="h-10 w-10 rounded-lg cursor-pointer border-0 shrink-0"
                />
                <Input
                  value={emphasisColor}
                  onChange={(e) => setEmphasisColor(e.target.value)}
                  className="flex-1 font-mono text-xs"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between gap-3 pt-1 flex-wrap">
            {customTheme && onDeleteCustomTheme ? (
              <button
                type="button"
                onClick={onDeleteCustomTheme}
                className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline transition-colors"
              >
                Voltar para o tema do sistema
              </button>
            ) : <span />}

            {hasChanges && (
              <Button
                variant="terracotta"
                onClick={handleSave}
                className="ml-auto"
              >
                {customTheme ? 'Salvar Alterações' : 'Criar Tema'}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
