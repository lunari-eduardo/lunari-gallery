import { Droplets } from 'lucide-react';
import { WatermarkSettings, WatermarkType } from '@/types/gallery';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';

interface WatermarkDefaultsProps {
  watermark: WatermarkSettings;
  onWatermarkChange: (watermark: WatermarkSettings) => void;
}

export function WatermarkDefaults({ watermark, onWatermarkChange }: WatermarkDefaultsProps) {
  const updateWatermark = (updates: Partial<WatermarkSettings>) => {
    onWatermarkChange({ ...watermark, ...updates });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Droplets className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-medium">Marca D'água Padrão</h3>
          <p className="text-sm text-muted-foreground">
            Configuração padrão para novas galerias
          </p>
        </div>
      </div>

      <div className="space-y-6 pl-13">
        {/* Type */}
        <div className="space-y-3">
          <Label>Tipo de Marca D'água</Label>
          <RadioGroup
            value={watermark.type}
            onValueChange={(value: WatermarkType) => updateWatermark({ type: value })}
            className="flex flex-wrap gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="standard" id="wm-standard" />
              <Label htmlFor="wm-standard" className="font-normal cursor-pointer">
                Padrão
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="none" id="wm-none" />
              <Label htmlFor="wm-none" className="font-normal cursor-pointer">
                Nenhuma
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* Standard Watermark Preview */}
        {watermark.type === 'standard' && (
          <div className="space-y-4 p-4 rounded-lg bg-muted/50">
            <p className="text-sm font-medium">Marca d'água padrão do sistema</p>
            
            {/* Opacity Slider */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Opacidade</Label>
                <span className="text-sm font-medium text-muted-foreground">{watermark.opacity}%</span>
              </div>
              <Slider
                value={[watermark.opacity]}
                onValueChange={(value) => updateWatermark({ opacity: value[0] })}
                min={10}
                max={100}
                step={5}
                className="w-full"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div 
                  className="h-20 flex items-center justify-center bg-black/80 rounded mb-1"
                  style={{ position: 'relative' }}
                >
                  <img 
                    src="/watermarks/horizontal.png" 
                    alt="Horizontal" 
                    className="h-12 object-contain" 
                    style={{ opacity: watermark.opacity / 100 }}
                  />
                </div>
                <span className="text-xs text-muted-foreground">Fotos horizontais</span>
              </div>
              <div className="text-center">
                <div 
                  className="h-20 flex items-center justify-center bg-black/80 rounded mb-1"
                  style={{ position: 'relative' }}
                >
                  <img 
                    src="/watermarks/vertical.png" 
                    alt="Vertical" 
                    className="h-14 object-contain" 
                    style={{ opacity: watermark.opacity / 100 }}
                  />
                </div>
                <span className="text-xs text-muted-foreground">Fotos verticais</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              A marca d'água correta será aplicada automaticamente baseado na orientação da foto.
            </p>
          </div>
        )}

        {/* PREPARAÇÃO PARA FUTURO: Upload de watermark customizada
        {watermark.type === 'custom' && (
          <div className="space-y-4 p-4 rounded-lg bg-muted/50">
            <p className="text-sm font-medium">Suas marcas d'água personalizadas</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Horizontal (fotos paisagem)</Label>
                <WatermarkUploader 
                  onUpload={(url) => onWatermarkChange({ ...watermark, customHorizontalUrl: url })} 
                />
              </div>
              <div>
                <Label>Vertical (fotos retrato)</Label>
                <WatermarkUploader 
                  onUpload={(url) => onWatermarkChange({ ...watermark, customVerticalUrl: url })} 
                />
              </div>
            </div>
          </div>
        )}
        */}
      </div>
    </div>
  );
}
