import { useState, useCallback } from 'react';
import { Upload, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface WatermarkUploaderProps {
  currentPath: string | null;
  onUpload: (file: File) => Promise<string | null>;
  onDelete: () => Promise<boolean>;
  disabled?: boolean;
  /** Opacity 0-100 for live tile preview */
  opacity?: number;
  /** Tile size in % (15 = small, 25 = medium, 40 = large) for live tile preview */
  scale?: number;
}

export function WatermarkUploader({
  currentPath,
  onUpload,
  onDelete,
  disabled = false,
  opacity = 40,
  scale = 25,
}: WatermarkUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const R2_PUBLIC_URL = import.meta.env.VITE_R2_PUBLIC_URL || 'https://media.lunarihub.com';
  const getPreviewUrl = useCallback((path: string | null) => {
    if (!path) return null;
    return `https://lunarihub.com/cdn-cgi/image/width=400,fit=scale-down/${R2_PUBLIC_URL}/${path}`;
  }, [R2_PUBLIC_URL]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    const file = e.dataTransfer.files[0];
    if (file) await handleUpload(file);
  }, [disabled]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await handleUpload(file);
    e.target.value = '';
  }, []);

  const handleUpload = async (file: File) => {
    if (!file.type.includes('png')) return;

    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    setIsUploading(true);
    try {
      const path = await onUpload(file);
      if (!path) setPreview(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async () => {
    const success = await onDelete();
    if (success) setPreview(null);
  };

  const displayUrl = preview || getPreviewUrl(currentPath);

  // Map scale (15/25/40) to background-size in px for tile preview
  // Smaller % → smaller tile in preview
  const tilePx = scale <= 15 ? 60 : scale >= 40 ? 130 : 90;

  return (
    <div className="space-y-4">
      {displayUrl ? (
        <div className="relative">
          {/* Tile preview over a neutral photo-like backdrop */}
          <div className="relative bg-gradient-to-br from-muted to-muted/60 rounded-lg overflow-hidden h-[160px]">
            {/* Checkerboard for context */}
            <div 
              className="absolute inset-0 opacity-30"
              style={{
                backgroundImage: `
                  linear-gradient(45deg, hsl(var(--muted-foreground) / 0.15) 25%, transparent 25%),
                  linear-gradient(-45deg, hsl(var(--muted-foreground) / 0.15) 25%, transparent 25%),
                  linear-gradient(45deg, transparent 75%, hsl(var(--muted-foreground) / 0.15) 75%),
                  linear-gradient(-45deg, transparent 75%, hsl(var(--muted-foreground) / 0.15) 75%)
                `,
                backgroundSize: '20px 20px',
                backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
              }}
            />
            {/* Tiled watermark */}
            <div
              className="absolute -inset-[40%]"
              style={{
                backgroundImage: `url(${displayUrl})`,
                backgroundRepeat: 'repeat',
                backgroundSize: `${tilePx}px auto`,
                transform: 'rotate(-45deg)',
                opacity: opacity / 100,
              }}
            />
            {isUploading && (
              <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={handleDelete}
            disabled={disabled || isUploading}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "relative border-2 border-dashed rounded-lg p-6 transition-colors",
            "flex flex-col items-center justify-center gap-2 min-h-[120px]",
            isDragging && "border-primary bg-primary/5",
            !isDragging && "border-muted-foreground/25 hover:border-muted-foreground/50",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <input
            type="file"
            accept="image/png"
            onChange={handleFileSelect}
            disabled={disabled || isUploading}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
          />
          
          {isUploading ? (
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          ) : (
            <>
              <Upload className="h-8 w-8 text-muted-foreground" />
              <div className="text-center">
                <p className="text-sm font-medium">
                  Arraste ou clique para enviar
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  PNG com transparência (máx. 2MB)
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
