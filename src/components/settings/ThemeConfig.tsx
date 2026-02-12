import { useState, useEffect } from 'react';
import { Palette, Sun, Moon, Check } from 'lucide-react';
import { CustomTheme, ThemeType } from '@/types/gallery';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';

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
  // Local state for editing
  const [backgroundMode, setBackgroundMode] = useState<'light' | 'dark'>(customTheme?.backgroundMode || 'light');
  const [primaryColor, setPrimaryColor] = useState(customTheme?.primaryColor || '#B87333');
  const [accentColor, setAccentColor] = useState(customTheme?.accentColor || '#8B9A7D');
  const [emphasisColor, setEmphasisColor] = useState(customTheme?.emphasisColor || '#2D2A26');
  const [hasChanges, setHasChanges] = useState(false);

  // Sync local state when customTheme changes
  useEffect(() => {
    if (customTheme) {
      setBackgroundMode(customTheme.backgroundMode);
      setPrimaryColor(customTheme.primaryColor);
      setAccentColor(customTheme.accentColor);
      setEmphasisColor(customTheme.emphasisColor);
      setHasChanges(false);
    }
  }, [customTheme]);

  // Track changes
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

  // Preview colors based on mode
  const previewBg = backgroundMode === 'dark' ? '#1C1917' : '#FAF9F7';
  const previewText = backgroundMode === 'dark' ? '#F5F5F4' : '#2D2A26';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Palette className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-medium">Tema da Galeria do Cliente</h3>
          <p className="text-sm text-muted-foreground">
            Escolha como sua galeria será exibida para os clientes
          </p>
        </div>
      </div>

      {/* Theme Type Selection */}
      <div className="space-y-3">
        <Label className="text-base font-medium">Tipo de Tema</Label>
        <RadioGroup 
          value={themeType} 
          onValueChange={(v) => onThemeTypeChange(v as ThemeType)}
          className="flex gap-4"
        >
          <div className="flex items-center">
            <RadioGroupItem value="system" id="theme-system" className="peer sr-only" />
            <Label 
              htmlFor="theme-system" 
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all",
                "hover:border-primary/50 hover:bg-muted/50",
                themeType === 'system' 
                  ? "border-primary bg-primary/5" 
                  : "border-border"
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center",
                themeType === 'system' ? "bg-primary/20" : "bg-muted"
              )}>
                <Sun className="h-4 w-4" />
              </div>
              <div>
                <p className="font-medium">Sistema (Padrão)</p>
                <p className="text-xs text-muted-foreground">Usa cores padrão do Lunari</p>
              </div>
            </Label>
          </div>
          
          <div className="flex items-center">
            <RadioGroupItem value="custom" id="theme-custom" className="peer sr-only" />
            <Label 
              htmlFor="theme-custom" 
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all",
                "hover:border-primary/50 hover:bg-muted/50",
                themeType === 'custom' 
                  ? "border-primary bg-primary/5" 
                  : "border-border"
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center",
                themeType === 'custom' ? "bg-primary/20" : "bg-muted"
              )}>
                <Palette className="h-4 w-4" />
              </div>
              <div>
                <p className="font-medium">Personalizado</p>
                <p className="text-xs text-muted-foreground">Sua marca, suas cores</p>
              </div>
            </Label>
          </div>
        </RadioGroup>
      </div>

      {/* Custom Theme Editor - Only show if custom selected */}
      {themeType === 'custom' && (
        <div className="space-y-6 pt-4 border-t border-border">
          {/* Background Mode */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Fundo</Label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setBackgroundMode('light')}
                className={cn(
                  "flex items-center gap-2 px-4 py-3 rounded-lg border-2 transition-all flex-1",
                  backgroundMode === 'light' 
                    ? "border-primary bg-primary/5" 
                    : "border-border hover:border-primary/50"
                )}
              >
                <Sun className={cn("h-5 w-5", backgroundMode === 'light' ? "text-primary" : "text-muted-foreground")} />
                <span className={backgroundMode === 'light' ? 'font-medium' : ''}>Claro</span>
                {backgroundMode === 'light' && <Check className="h-4 w-4 text-primary ml-auto" />}
              </button>
              
              <button
                type="button"
                onClick={() => setBackgroundMode('dark')}
                className={cn(
                  "flex items-center gap-2 px-4 py-3 rounded-lg border-2 transition-all flex-1",
                  backgroundMode === 'dark' 
                    ? "border-primary bg-primary/5" 
                    : "border-border hover:border-primary/50"
                )}
              >
                <Moon className={cn("h-5 w-5", backgroundMode === 'dark' ? "text-primary" : "text-muted-foreground")} />
                <span className={backgroundMode === 'dark' ? 'font-medium' : ''}>Escuro</span>
                {backgroundMode === 'dark' && <Check className="h-4 w-4 text-primary ml-auto" />}
              </button>
            </div>
          </div>

          {/* Preview */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Preview</Label>
            <div
              className="h-32 rounded-xl p-4 flex flex-col items-center justify-center gap-3 border"
              style={{ backgroundColor: previewBg }}
            >
              <p className="text-lg font-semibold" style={{ color: emphasisColor }}>
                Sua Galeria
              </p>
              <div className="flex gap-2">
                <div
                  className="px-4 py-2 rounded-full text-sm text-white font-medium"
                  style={{ backgroundColor: primaryColor }}
                >
                  Botão Principal
                </div>
                <div
                  className="px-4 py-2 rounded-full text-sm border-2"
                  style={{ borderColor: accentColor, color: previewText }}
                >
                  Selecionado
                </div>
              </div>
            </div>
          </div>

          {/* Color Pickers */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="primaryColor" className="text-sm">Cor Primária</Label>
              <p className="text-xs text-muted-foreground">Botões e CTAs</p>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  id="primaryColor"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="h-10 w-10 rounded-lg cursor-pointer border-0"
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
                  className="h-10 w-10 rounded-lg cursor-pointer border-0"
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
                  className="h-10 w-10 rounded-lg cursor-pointer border-0"
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
          <div className="flex gap-3 pt-2">
            <Button
              variant="terracotta"
              onClick={handleSave}
              disabled={!hasChanges}
              className="flex-1"
            >
              {customTheme ? 'Salvar Alterações' : 'Criar Tema'}
            </Button>
            
            {customTheme && onDeleteCustomTheme && (
              <Button
                variant="outline"
                onClick={onDeleteCustomTheme}
              >
                Usar Sistema
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
