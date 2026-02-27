import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Upload, X, AlertCircle, CheckCircle2, Loader2, RefreshCw, Coins, AlertTriangle, StopCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { isValidImageType, formatFileSize, type WatermarkConfig } from '@/lib/imageCompression';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { usePhotoCredits } from '@/hooks/usePhotoCredits';
import { UploadPipeline, type PipelineItem, type UploadResult } from '@/lib/uploadPipeline';

export interface UploadedPhoto {
  id: string;
  filename: string;
  originalFilename: string;
  storageKey: string;
  fileSize: number;
  mimeType: string;
  width: number;
  height: number;
}

interface PhotoUploaderProps {
  galleryId: string;
  maxLongEdge?: 1024 | 1920 | 2560;
  watermarkConfig?: WatermarkConfig;
  allowDownload?: boolean;
  skipCredits?: boolean;
  storageLimit?: number;
  storageUsed?: number;
  onStorageLimitHit?: () => void;
  onUploadComplete?: (photos: UploadedPhoto[]) => void;
  onUploadStart?: () => void;
  onUploadingChange?: (isUploading: boolean) => void;
  className?: string;
}

export function PhotoUploader({
  galleryId,
  maxLongEdge = 1920,
  watermarkConfig,
  allowDownload = false,
  skipCredits = false,
  storageLimit,
  storageUsed,
  onStorageLimitHit,
  onUploadComplete,
  onUploadStart,
  onUploadingChange,
  className,
}: PhotoUploaderProps) {
  const [items, setItems] = useState<PipelineItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pipelineRef = useRef<UploadPipeline | null>(null);
  const completedResults = useRef<UploadResult[]>([]);

  const { photoCredits, isAdmin, canUpload, refetch: refetchCredits } = usePhotoCredits();

  // Lazy-init pipeline
  const getPipeline = useCallback(() => {
    if (!pipelineRef.current) {
      pipelineRef.current = new UploadPipeline({
        galleryId,
        maxLongEdge,
        quality: 0.8,
        watermarkConfig,
        allowDownload,
        skipCredits,
        maxCompressionSlots: 2,
        onItemUpdate: (item) => {
          setItems(prev => prev.map(i => i.id === item.id ? { ...item } : i));
        },
        onItemDone: (item) => {
          if (item.result) {
            completedResults.current.push(item.result);
            refetchCredits();
          }
        },
        onPipelineComplete: () => {
          const results = completedResults.current;
          const currentItems = pipelineRef.current?.items || [];
          const errorCount = currentItems.filter(i => i.status === 'error').length;

          setIsUploading(false);
          onUploadingChange?.(false);

          if (results.length > 0) {
            if (errorCount > 0) {
              toast.warning(`${results.length} foto(s) enviada(s), ${errorCount} com erro.`);
            } else {
              toast.success(`${results.length} foto(s) enviada(s) com sucesso!`);
            }
            onUploadComplete?.(results as UploadedPhoto[]);
          } else if (errorCount > 0) {
            toast.error('Falha ao enviar fotos. Tente novamente.');
          }

          completedResults.current = [];

          // Clear done items after delay
          setTimeout(() => {
            setItems(prev => prev.filter(i => i.status !== 'done'));
          }, 2000);
        },
      });
    }
    return pipelineRef.current;
  }, [galleryId, maxLongEdge, watermarkConfig, allowDownload, skipCredits, onUploadComplete, onUploadingChange, refetchCredits]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      pipelineRef.current?.destroy();
      pipelineRef.current = null;
    };
  }, []);

  const storageRemaining = (storageLimit != null && storageUsed != null) ? Math.max(0, storageLimit - storageUsed) : Infinity;
  const storageUsedPercent = (storageLimit != null && storageLimit > 0 && storageUsed != null) ? Math.round((storageUsed / storageLimit) * 100) : 0;
  const isStorageFull = storageLimit != null && storageUsed != null && storageUsed >= storageLimit;

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    let validFiles = fileArray.filter(isValidImageType);

    if (validFiles.length !== fileArray.length) {
      toast.error('Alguns arquivos foram ignorados. Formatos aceitos: JPG, PNG, WEBP');
    }

    if (!skipCredits && !isAdmin && !canUpload(validFiles.length)) {
      toast.error(`Créditos insuficientes. Você tem ${photoCredits} créditos e está tentando enviar ${validFiles.length} fotos.`);
      return;
    }

    // Enforce storage limits for Transfer galleries
    if (skipCredits && storageLimit != null && storageUsed != null) {
      const remaining = Math.max(0, storageLimit - storageUsed);
      if (remaining <= 0) {
        toast.error('Armazenamento cheio. Faça upgrade ou exclua galerias antigas para liberar espaço.');
        onStorageLimitHit?.();
        return;
      }
      let cumulativeSize = 0;
      const fitFiles: File[] = [];
      for (const f of validFiles) {
        if (cumulativeSize + f.size <= remaining) {
          cumulativeSize += f.size;
          fitFiles.push(f);
        } else {
          break;
        }
      }
      if (fitFiles.length < validFiles.length) {
        toast.warning(`Galeria será salva com ${fitFiles.length} de ${validFiles.length} fotos. Faça upgrade ou exclua galerias antigas para liberar espaço.`);
        onStorageLimitHit?.();
      }
      if (fitFiles.length === 0) return;
      validFiles = fitFiles;
    }

    // Refresh session before starting
    if (!isUploading) {
      console.log('[PhotoUploader] Refreshing session token before pipeline...');
      await supabase.auth.refreshSession();
    }

    const pipeline = getPipeline();
    const newItems = pipeline.add(validFiles);
    setItems(prev => [...prev, ...newItems]);

    if (!isUploading) {
      setIsUploading(true);
      onUploadStart?.();
      onUploadingChange?.(true);
    }
  }, [isAdmin, canUpload, photoCredits, skipCredits, isUploading, getPipeline, onUploadStart, onUploadingChange, storageLimit, storageUsed, onStorageLimitHit]);

  const removeItem = useCallback((id: string) => {
    pipelineRef.current?.revokePreview(id);
    setItems(prev => prev.filter(i => i.id !== id));
  }, []);

  const retryItem = useCallback((id: string) => {
    pipelineRef.current?.retry(id);
  }, []);

  const cancelAll = useCallback(() => {
    pipelineRef.current?.cancel();
    setIsUploading(false);
    onUploadingChange?.(false);
  }, [onUploadingChange]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const pendingCount = items.filter(i => i.status === 'queued').length;
  const completedCount = items.filter(i => i.status === 'done').length;
  const errorCount = items.filter(i => i.status === 'error').length;
  const inProgressCount = items.filter(i =>
    i.status === 'compressing' || i.status === 'uploading-original' || i.status === 'uploading-preview'
  ).length;

  const overallProgress = items.length > 0
    ? Math.round(items.reduce((sum, i) => sum + i.progress, 0) / items.length)
    : 0;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Storage Warning for Transfer */}
      {skipCredits && storageLimit != null && storageUsedPercent >= 90 && (
        <div className={cn(
          "flex items-center gap-2 p-3 rounded-lg border",
          isStorageFull
            ? "bg-destructive/10 border-destructive/20"
            : "bg-warning/10 border-warning/20"
        )}>
          <AlertTriangle className={cn("h-4 w-4 shrink-0", isStorageFull ? "text-destructive" : "text-warning")} />
          <span className={cn("text-sm", isStorageFull ? "text-destructive" : "text-warning")}>
            {isStorageFull
              ? 'Armazenamento cheio. Faça upgrade ou exclua galerias antigas.'
              : 'Armazenamento quase cheio. Considere fazer upgrade.'}
          </span>
        </div>
      )}

      {/* Credit Warning */}
      {!skipCredits && !isAdmin && photoCredits < 10 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
          <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
          <span className="text-sm text-warning">
            {photoCredits === 0
              ? 'Você não tem créditos. Compre mais para enviar fotos.'
              : `Você tem apenas ${photoCredits} créditos restantes.`
            }
          </span>
          <Button variant="outline" size="sm" className="ml-auto shrink-0" disabled>
            <Coins className="h-3 w-3 mr-1" />
            Comprar
          </Button>
        </div>
      )}

      {/* Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !skipCredits && !isAdmin && photoCredits === 0 ? null : fileInputRef.current?.click()}
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
          !skipCredits && !isAdmin && photoCredits === 0
            ? 'border-muted-foreground/10 bg-muted/50 cursor-not-allowed opacity-60'
            : 'cursor-pointer',
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-primary/50'
        )}
      >
        <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
        <p className="text-lg font-medium">Arraste fotos aqui</p>
        <p className="text-sm text-muted-foreground mt-1">
          ou clique para selecionar • JPG, PNG, WEBP • Máx. 20MB por foto
        </p>
        {!skipCredits && !isAdmin && (
          <p className="text-xs text-muted-foreground mt-2 flex items-center justify-center gap-1">
            <Coins className="h-3 w-3" />
            {photoCredits} créditos disponíveis (1 foto = 1 crédito)
          </p>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && addFiles(e.target.files)}
      />

      {/* Upload List */}
      {items.length > 0 && (
        <div className="space-y-2">
          {/* Progress Summary */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <p className="text-sm text-muted-foreground">
                {completedCount} de {items.length} enviadas
                {errorCount > 0 && <span className="text-destructive"> • {errorCount} erro(s)</span>}
              </p>
              {isUploading && inProgressCount > 0 && (
                <span className="flex items-center gap-1.5 text-xs text-primary">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {inProgressCount} em andamento
                </span>
              )}
            </div>
            {isUploading && (
              <Button variant="ghost" size="sm" onClick={cancelAll} className="text-destructive hover:text-destructive">
                <StopCircle className="h-3 w-3 mr-1" />
                Cancelar tudo
              </Button>
            )}
          </div>

          {/* Overall progress bar */}
          {isUploading && items.length > 1 && (
            <Progress value={overallProgress} className="h-1.5" />
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="relative aspect-square rounded-lg overflow-hidden bg-muted"
              >
                <img
                  src={item.preview}
                  alt={item.file.name}
                  className="w-full h-full object-cover"
                />

                {/* Status Overlay */}
                {item.status !== 'queued' && (
                  <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center">
                    {item.status === 'done' ? (
                      <CheckCircle2 className="h-8 w-8 text-green-400" />
                    ) : item.status === 'error' ? (
                      <>
                        <AlertCircle className="h-8 w-8 text-red-400" />
                        <p className="text-xs text-white mt-1 px-2 text-center line-clamp-2">
                          {item.error}
                        </p>
                        {item.retryCount < 3 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              retryItem(item.id);
                            }}
                            className="mt-2 flex items-center gap-1 text-xs text-white bg-white/20 hover:bg-white/30 px-2 py-1 rounded transition-colors"
                          >
                            <RefreshCw className="h-3 w-3" />
                            Tentar novamente
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        <Loader2 className="h-6 w-6 text-white animate-spin" />
                        <p className="text-xs text-white mt-1">
                          {item.status === 'compressing' && 'Comprimindo...'}
                          {item.status === 'uploading-original' && 'Enviando original...'}
                          {item.status === 'uploading-preview' && 'Enviando...'}
                        </p>
                        <Progress value={item.progress} className="w-3/4 mt-2 h-1" />
                      </>
                    )}
                  </div>
                )}

                {/* Remove Button (only for queued or error) */}
                {(item.status === 'queued' || item.status === 'error') && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeItem(item.id);
                    }}
                    className="absolute top-1 right-1 p-1 rounded-full bg-black/50 text-white hover:bg-black/70"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}

                {/* File Size */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                  <p className="text-xs text-white truncate">{item.file.name}</p>
                  <p className="text-xs text-white/70">
                    {formatFileSize(item.file.size)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
