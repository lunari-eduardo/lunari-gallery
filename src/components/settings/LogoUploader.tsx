import { useState, useRef } from 'react';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface LogoUploaderProps {
  logo?: string;
  onLogoChange: (logo: string | undefined) => void;
}

export function LogoUploader({ logo, onLogoChange }: LogoUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Formato inválido. Use PNG, JPG ou SVG.');
      return;
    }
    
    // Verificar tamanho (máx 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Máximo 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      onLogoChange(result);
      toast.success('Logo atualizado!');
    };
    reader.onerror = () => {
      toast.error('Erro ao carregar arquivo.');
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <ImageIcon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-medium">Logotipo</h3>
          <p className="text-sm text-muted-foreground">
            Adicione seu logo para personalizar galerias
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {/* Preview - Container maior para mostrar logo completo */}
        <div
          className={`
            relative h-32 w-full max-w-[320px] rounded-xl border-2 border-dashed transition-all duration-200
            flex items-center justify-center overflow-hidden
            ${isDragging ? 'border-primary bg-primary/5' : 'border-border'}
            ${logo ? 'border-solid bg-muted/30' : ''}
          `}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          {logo ? (
            <>
              <img src={logo} alt="Logo" className="h-full w-full object-contain p-3" />
              <button
                onClick={() => onLogoChange(undefined)}
                className="absolute top-2 right-2 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-md hover:bg-destructive/90 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 text-muted-foreground/50">
              <Upload className="h-8 w-8" />
              <span className="text-xs">Arraste ou clique para enviar</span>
            </div>
          )}
        </div>

        {/* Upload Button e Informações */}
        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            size="sm"
            className="w-fit"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-4 w-4 mr-2" />
            {logo ? 'Trocar Logo' : 'Upload Logo'}
          </Button>
          <p className="text-xs text-muted-foreground">
            PNG, JPG ou SVG. Máx. 2MB.
            <br />
            <span className="text-primary/70">Recomendado: 600x200px ou maior</span>
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
