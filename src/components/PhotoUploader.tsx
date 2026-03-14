import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, X, AlertCircle, CheckCircle2, Loader2, RefreshCw, Coins, AlertTriangle, StopCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { isValidImageType, formatFileSize, type WatermarkConfig } from '@/lib/imageCompression';
import { isValidTransferMedia, isVideoFile, isWithinSizeLimit, MAX_VIDEO_SIZE, MAX_IMAGE_SIZE } from '@/lib/mediaValidation';
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

export interface QueueState {
  isUploading: boolean;
  errorCount: number;
  totalCount: number;
  doneCount: number;
}

interface PhotoUploaderProps {
  galleryId: string;
  folderId?: string | null;
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
  onQueueStateChange?: (state: QueueState) => void;
  className?: string;
}

export function PhotoUploader({
  galleryId,
  folderId,
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
  onQueueStateChange,
  className,
}: PhotoUploaderProps) {
  const navigate = useNavigate();
  const [items, setItems] = useState<PipelineItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pipelineRef = useRef<UploadPipeline | null>(null);
  const completedResults = useRef<UploadResult[]>([]);
  const retryRoundRef = useRef(0);
  const maxAutoRetryRounds = 2;

  const { photoCredits, isAdmin, canUpload, refetch: refetchCredits } = usePhotoCredits();

  // Lazy-init pipeline (recreate if destroyed or folderId changed)
  const getPipeline = useCallback(() => {
    if (pipelineRef.current) {
      const shouldRecreate =
        pipelineRef.current.isDestroyed ||
        (pipelineRef.current.folderId !== folderId && !pipelineRef.current.isActive);
      if (shouldRecreate) {
        pipelineRef.current.destroy();
        pipelineRef.current = null;
      }
    }
    if (!pipelineRef.current) {
      pipelineRef.current = new UploadPipeline({
        galleryId,
        folderId,
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
          const errItems = currentItems.filter(i => i.status === 'error');
          const retryableItems = errItems.filter(i => i.retryCount < 3);

          // Auto-retry logic
          if (retryableItems.length > 0 && retryRoundRef.current < maxAutoRetryRounds) {
            retryRoundRef.current++;
            const round = retryRoundRef.current;
            const delay = round * 5000;
            toast.info(`${retryableItems.length} arquivo(s) com erro. Tentando novamente automaticamente...`);
            setTimeout(() => {
              if (!pipelineRef.current) return;
              retryableItems.forEach(item => pipelineRef.current?.retry(item.id));
            }, delay);
            return; // Don't finalize yet
          }

          setIsUploading(false);
          onUploadingChange?.(false);
          retryRoundRef.current = 0;

          // Notify queue state
          onQueueStateChange?.({
            isUploading: false,
            errorCount: errItems.length,
            totalCount: currentItems.length,
            doneCount: currentItems.filter(i => i.status === 'done').length,
          });

          if (results.length > 0) {
            if (errItems.length > 0) {
              toast.warning(`${results.length} foto(s) enviada(s), ${errItems.length} com erro.`);
            } else {
              toast.success(`${results.length} foto(s) enviada(s) com sucesso!`);
            }
            onUploadComplete?.(results as UploadedPhoto[]);
          } else if (errItems.length > 0) {
            toast.error('Falha ao enviar fotos. Tente novamente.');
          }

          completedResults.current = [];

          // Clear done items after delay and destroy pipeline for fresh state
          setTimeout(() => {
            setItems(prev => prev.filter(i => i.status !== 'done'));
            if (pipelineRef.current && !pipelineRef.current.isActive) {
              pipelineRef.current.destroy();
              pipelineRef.current = null;
            }
          }, 2000);
        },
      });
    }
    return pipelineRef.current;
  }, [galleryId, folderId, maxLongEdge, watermarkConfig, allowDownload, skipCredits, onUploadComplete, onUploadingChange, onQueueStateChange, refetchCredits]);

  // Cleanup on unmount or when folderId changes
  useEffect(() => {
    return () => {
      pipelineRef.current?.destroy();
      pipelineRef.current = null;
    };
  }, []);

  // Reset pipeline when folderId changes
  useEffect(() => {
    if (pipelineRef.current && !pipelineRef.current.isActive) {
      pipelineRef.current.destroy();
      pipelineRef.current = null;
    }
  }, [folderId]);

  const storageRemaining = (storageLimit != null && storageUsed != null) ? Math.max(0, storageLimit - storageUsed) : Infinity;
  const storageUsedPercent = (storageLimit != null && storageLimit > 0 && storageUsed != null) ? Math.round((storageUsed / storageLimit) * 100) : 0;
  const isStorageFull = storageLimit != null && storageUsed != null && storageUsed >= storageLimit;

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const validateFn = skipCredits ? isValidTransferMedia : isValidImageType;
    let validFiles = fileArray.filter(validateFn);

    // Log diagnostic info for debugging
    const rejected = fileArray.filter(f => !validateFn(f));
    if (rejected.length > 0) {
      console.warn('[PhotoUploader] Arquivos rejeitados:', rejected.map(f => ({
        name: f.name, type: f.type, size: f.size,
      })));
    }
    console.log(`[PhotoUploader] addFiles: total=${fileArray.length}, valid=${validFiles.length}, folderId=${folderId}`);

    if (validFiles.length === 0) {
      const formats = skipCredits ? 'JPG/JPEG, PNG, WEBP, MP4, MOV, WEBM' : 'JPG/JPEG, PNG, WEBP';
      toast.error(`Nenhum arquivo válido selecionado. Formatos aceitos: ${formats}`);
      return;
    }

    // Check file size limits (especially for videos)
    const oversized = validFiles.filter(f => !isWithinSizeLimit(f));
    if (oversized.length > 0) {
      const videoOversized = oversized.filter(isVideoFile);
      const imageOversized = oversized.filter(f => !isVideoFile(f));
      if (videoOversized.length > 0) toast.error(`${videoOversized.length} vídeo(s) excede(m) o limite de ${formatFileSize(MAX_VIDEO_SIZE)}`);
      if (imageOversized.length > 0) toast.error(`${imageOversized.length} foto(s) excede(m) o limite de ${formatFileSize(MAX_IMAGE_SIZE)}`);
      validFiles = validFiles.filter(isWithinSizeLimit);
      if (validFiles.length === 0) return;
    }

    if (validFiles.length !== fileArray.length) {
      const formats = skipCredits ? 'JPG, PNG, WEBP, MP4, MOV' : 'JPG, PNG, WEBP';
      const extraInfo = oversized.length > 0 ? '' : `Formatos aceitos: ${formats}`;
      if (extraInfo) toast.error(`Alguns arquivos foram ignorados. ${extraInfo}`);
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

    // Session is fetched lazily inside the pipeline when needed — no refresh here
    // to avoid triggering auth state changes that unmount parent components.

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
          <Button variant="outline" size="sm" className="ml-auto shrink-0" onClick={() => navigate('/credits')}>
            <Coins className="h-3 w-3 mr-1" />
            Comprar
          </Button>
        </div>
      )}

      {/* Drop Zone */}
      <div
        onDrop={isStorageFull && skipCredits ? undefined : handleDrop}
        onDragOver={isStorageFull && skipCredits ? undefined : handleDragOver}
        onDragLeave={isStorageFull && skipCredits ? undefined : handleDragLeave}
        onClick={() => {
          if (isStorageFull && skipCredits) return;
          if (!skipCredits && !isAdmin && photoCredits === 0) return;
          fileInputRef.current?.click();
        }}
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
          (isStorageFull && skipCredits) || (!skipCredits && !isAdmin && photoCredits === 0)
            ? 'border-muted-foreground/10 bg-muted/50 cursor-not-allowed opacity-60'
            : 'cursor-pointer',
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-primary/50'
        )}
      >
        <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
        {isStorageFull && skipCredits ? (
          <>
            <p className="text-lg font-medium text-muted-foreground">Armazenamento cheio</p>
            <p className="text-sm text-muted-foreground mt-1">
              Faça upgrade ou exclua galerias antigas para liberar espaço.
            </p>
          </>
        ) : (
          <>
            <p className="text-lg font-medium">Arraste arquivos aqui</p>
            <p className="text-sm text-muted-foreground mt-1">
              {skipCredits
                ? 'ou clique para selecionar • JPG, PNG, WEBP, MP4, MOV, WEBM • Máx. 500MB por vídeo'
                : 'ou clique para selecionar • JPG, PNG, WEBP • Máx. 20MB por foto'}
            </p>
          </>
        )}
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
        accept={skipCredits
          ? ".jpg,.jpeg,.png,.webp,.mp4,.mov,.webm,.m4v,image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"
          : ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
        }
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) addFiles(e.target.files);
          e.target.value = '';
        }}
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
                {isVideoFile(item.file) ? (
                  <video
                    src={item.preview}
                    className="w-full h-full object-cover"
                    muted
                    playsInline
                  />
                ) : (
                  <img
                    src={item.preview}
                    alt={item.file.name}
                    className="w-full h-full object-cover"
                  />
                )}

                {/* Status Overlay */}
                {item.status !== 'queued' && (
                  <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center z-10">
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

                {/* File Size - hidden when error to avoid blocking retry button */}
                {item.status !== 'error' && (
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 pointer-events-none">
                    <p className="text-xs text-white truncate">{item.file.name}</p>
                    <p className="text-xs text-white/70">
                      {formatFileSize(item.file.size)}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
