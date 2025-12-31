import { useState, useRef } from 'react';
import { Globe, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

interface FaviconUploaderProps {
  favicon?: string;
  onFaviconChange: (favicon: string | undefined) => void;
}

export function FaviconUploader({ favicon, onFaviconChange }: FaviconUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      onFaviconChange(result);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Globe className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-medium">Favicon</h3>
          <p className="text-sm text-muted-foreground">
            Ícone exibido na aba do navegador
          </p>
        </div>
      </div>

      <div className="flex items-start gap-6">
        {/* Preview */}
        <div className="space-y-2">
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border">
            <div className="h-8 w-8 rounded bg-card border flex items-center justify-center overflow-hidden">
              {favicon ? (
                <img src={favicon} alt="Favicon" className="h-full w-full object-contain" />
              ) : (
                <Globe className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium">Galeria - Studio</span>
              <span className="text-xs text-muted-foreground">gallery.studio.com</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Preview da aba do navegador
          </p>
        </div>

        {/* Upload/Remove buttons */}
        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-4 w-4 mr-2" />
            {favicon ? 'Trocar Favicon' : 'Upload Favicon'}
          </Button>
          {favicon && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => onFaviconChange(undefined)}
            >
              <X className="h-4 w-4 mr-2" />
              Remover
            </Button>
          )}
          <p className="text-xs text-muted-foreground">
            32x32 ou 64x64 pixels recomendado
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileSelect(file);
            }}
          />
        </div>
      </div>
    </div>
  );
}
