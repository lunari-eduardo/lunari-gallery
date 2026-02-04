import { useState, useEffect } from 'react';
import { Shield, ShieldOff, ImageIcon, Info } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Skeleton } from '@/components/ui/skeleton';
import { WatermarkUploader } from './WatermarkUploader';
import { useWatermarkSettings, WatermarkMode } from '@/hooks/useWatermarkSettings';
import { cn } from '@/lib/utils';

export function WatermarkSettings() {
  const { 
    settings, 
    isLoading, 
    isSaving,
    saveSettings, 
    uploadWatermark, 
    deleteWatermark 
  } = useWatermarkSettings();

  const [localOpacity, setLocalOpacity] = useState(settings.opacity);
  const [localScale, setLocalScale] = useState(settings.scale);

  // Sync local state with fetched settings
  useEffect(() => {
    setLocalOpacity(settings.opacity);
    setLocalScale(settings.scale);
  }, [settings.opacity, settings.scale]);

  const handleModeChange = async (mode: WatermarkMode) => {
    await saveSettings({ mode });
  };

  const handleOpacityChange = (value: number[]) => {
    setLocalOpacity(value[0]);
  };

  const handleOpacityCommit = async (value: number[]) => {
    await saveSettings({ opacity: value[0] });
  };

  const handleScaleChange = (value: number[]) => {
    setLocalScale(value[0]);
  };

  const handleScaleCommit = async (value: number[]) => {
    await saveSettings({ scale: value[0] });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5" />
          <Skeleton className="h-6 w-40" />
        </div>
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Shield className="h-5 w-5 text-primary" />
        <h4 className="font-medium">Marca d'Água</h4>
      </div>

      {/* Mode Selection */}
      <div className="space-y-3">
        <Label className="text-sm text-muted-foreground">Tipo de marca d'água</Label>
        <RadioGroup
          value={settings.mode}
          onValueChange={(value) => handleModeChange(value as WatermarkMode)}
          disabled={isSaving}
          className="grid grid-cols-1 sm:grid-cols-3 gap-3"
        >
          {/* System */}
          <label
            className={cn(
              "flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors",
              settings.mode === 'system' 
                ? "border-primary bg-primary/5" 
                : "border-border hover:bg-muted/50"
            )}
          >
            <RadioGroupItem value="system" className="sr-only" />
            <Shield className={cn(
              "h-5 w-5",
              settings.mode === 'system' ? "text-primary" : "text-muted-foreground"
            )} />
            <div>
              <p className="font-medium text-sm">Padrão</p>
              <p className="text-xs text-muted-foreground">Lunari Gallery</p>
            </div>
          </label>

          {/* Custom */}
          <label
            className={cn(
              "flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors",
              settings.mode === 'custom' 
                ? "border-primary bg-primary/5" 
                : "border-border hover:bg-muted/50"
            )}
          >
            <RadioGroupItem value="custom" className="sr-only" />
            <ImageIcon className={cn(
              "h-5 w-5",
              settings.mode === 'custom' ? "text-primary" : "text-muted-foreground"
            )} />
            <div>
              <p className="font-medium text-sm">Personalizada</p>
              <p className="text-xs text-muted-foreground">Sua marca</p>
            </div>
          </label>

          {/* None */}
          <label
            className={cn(
              "flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors",
              settings.mode === 'none' 
                ? "border-primary bg-primary/5" 
                : "border-border hover:bg-muted/50"
            )}
          >
            <RadioGroupItem value="none" className="sr-only" />
            <ShieldOff className={cn(
              "h-5 w-5",
              settings.mode === 'none' ? "text-primary" : "text-muted-foreground"
            )} />
            <div>
              <p className="font-medium text-sm">Nenhuma</p>
              <p className="text-xs text-muted-foreground">Sem proteção</p>
            </div>
          </label>
        </RadioGroup>
      </div>

      {/* Custom Watermark Upload */}
      {settings.mode === 'custom' && (
        <div className="space-y-3 p-4 rounded-lg bg-muted/30 border border-border/50">
          <Label className="text-sm">Sua marca d'água</Label>
          <WatermarkUploader
            currentPath={settings.path}
            onUpload={uploadWatermark}
            onDelete={deleteWatermark}
            disabled={isSaving}
          />
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <p>
              Use PNG com fundo transparente. A marca será redimensionada automaticamente
              e aplicada no centro das fotos.
            </p>
          </div>
        </div>
      )}

      {/* Opacity & Scale Sliders (only if not 'none') */}
      {settings.mode !== 'none' && (
        <div className="space-y-5">
          {/* Opacity */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Opacidade</Label>
              <span className="text-sm font-medium tabular-nums">
                {localOpacity}%
              </span>
            </div>
            <Slider
              value={[localOpacity]}
              onValueChange={handleOpacityChange}
              onValueCommit={handleOpacityCommit}
              min={10}
              max={100}
              step={5}
              disabled={isSaving}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Valores baixos deixam a marca mais sutil
            </p>
          </div>

          {/* Scale */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Tamanho</Label>
              <span className="text-sm font-medium tabular-nums">
                {localScale}%
              </span>
            </div>
            <Slider
              value={[localScale]}
              onValueChange={handleScaleChange}
              onValueCommit={handleScaleCommit}
              min={10}
              max={50}
              step={5}
              disabled={isSaving}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Porcentagem em relação à menor dimensão da foto
            </p>
          </div>
        </div>
      )}

      {/* Warning for 'none' mode */}
      {settings.mode === 'none' && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm">
          <ShieldOff className="h-4 w-4 mt-0.5 text-destructive shrink-0" />
          <p className="text-destructive">
            Sem marca d'água, suas fotos ficam desprotegidas durante a seleção do cliente.
          </p>
        </div>
      )}
    </div>
  );
}
