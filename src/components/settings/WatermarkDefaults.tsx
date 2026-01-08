import { Droplets } from 'lucide-react';
import { WatermarkSettings, WatermarkType } from '@/types/gallery';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

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
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="text" id="wm-text" />
              <Label htmlFor="wm-text" className="font-normal cursor-pointer">
                Texto
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="image" id="wm-image" />
              <Label htmlFor="wm-image" className="font-normal cursor-pointer">
                Imagem
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* Standard Watermark Preview */}
        {watermark.type === 'standard' && (
          <div className="space-y-3 p-4 rounded-lg bg-muted/50">
            <p className="text-sm font-medium">Marca d'água padrão do sistema</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="h-20 flex items-center justify-center bg-black/80 rounded mb-1">
                  <img 
                    src="/watermarks/horizontal.png" 
                    alt="Horizontal" 
                    className="h-12 object-contain" 
                  />
                </div>
                <span className="text-xs text-muted-foreground">Fotos horizontais</span>
              </div>
              <div className="text-center">
                <div className="h-20 flex items-center justify-center bg-black/80 rounded mb-1">
                  <img 
                    src="/watermarks/vertical.png" 
                    alt="Vertical" 
                    className="h-14 object-contain" 
                  />
                </div>
                <span className="text-xs text-muted-foreground">Fotos verticais</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              A marca d'água correta será aplicada automaticamente baseado na orientação da foto.
              Opacidade fixa em 40%.
            </p>
          </div>
        )}

        {/* Text (if type is text) */}
        {watermark.type === 'text' && (
          <div className="space-y-2">
            <Label htmlFor="wmText">Texto da Marca D'água</Label>
            <Input
              id="wmText"
              value={watermark.text || ''}
              onChange={(e) => updateWatermark({ text: e.target.value })}
              placeholder="Ex: Studio Lunari"
            />
          </div>
        )}

        {/* Opacity (if text or image - NOT for standard) */}
        {(watermark.type === 'text' || watermark.type === 'image') && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <Label>Opacidade</Label>
              <span className="text-sm text-muted-foreground">{watermark.opacity}%</span>
            </div>
            <Slider
              value={[watermark.opacity]}
              onValueChange={([value]) => updateWatermark({ opacity: value })}
              min={10}
              max={100}
              step={5}
              className="w-full"
            />
          </div>
        )}

        {/* Position (if text or image - NOT for standard) */}
        {(watermark.type === 'text' || watermark.type === 'image') && (
          <div className="space-y-2">
            <Label>Posição</Label>
            <Select
              value={watermark.position}
              onValueChange={(value: WatermarkSettings['position']) =>
                updateWatermark({ position: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="top-left">Superior Esquerdo</SelectItem>
                <SelectItem value="top-right">Superior Direito</SelectItem>
                <SelectItem value="center">Centro</SelectItem>
                <SelectItem value="bottom-left">Inferior Esquerdo</SelectItem>
                <SelectItem value="bottom-right">Inferior Direito</SelectItem>
                <SelectItem value="fill">Preencher</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </div>
  );
}
