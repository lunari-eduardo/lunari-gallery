import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Upload, X, AlertCircle, CheckCircle2, Loader2, RefreshCw, Coins, AlertTriangle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { 
  compressImage, 
  isValidImageType, 
  formatFileSize,
  CompressionOptions,
  WatermarkConfig
} from '@/lib/imageCompression';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  retryWithBackoff, 
  getUploadErrorMessage, 
  getOptimalBatchSize 
} from '@/lib/retryFetch';
import { usePhotoCredits } from '@/hooks/usePhotoCredits';

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

interface PhotoUploadItem {
  id: string;
  file: File;
  preview: string;
  status: 'pending' | 'compressing' | 'uploading' | 'saving' | 'done' | 'error';
  progress: number;
  error?: string;
  result?: UploadedPhoto;
  retryCount?: number;
}

interface PhotoUploaderProps {
  galleryId: string;
  maxLongEdge?: 1024 | 1920 | 2560;
  /** Watermark configuration for burn-in during compression */
  watermarkConfig?: WatermarkConfig;
  /** When true, also uploads original file to B2 for download (before compression) */
  allowDownload?: boolean;
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
  onUploadComplete,
  onUploadStart,
  onUploadingChange,
  className,
}: PhotoUploaderProps) {
  const [items, setItems] = useState<PhotoUploadItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTriggeredRef = useRef(false);
  
  // Photo credits hook
  const { photoCredits, isAdmin, canUpload, refetch: refetchCredits } = usePhotoCredits();

  const addFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const validFiles = fileArray.filter(isValidImageType);
    
    if (validFiles.length !== fileArray.length) {
      toast.error('Alguns arquivos foram ignorados. Formatos aceitos: JPG, PNG, WEBP');
    }

    // Check credits BEFORE adding files (except for admins)
    if (!isAdmin && !canUpload(validFiles.length)) {
      toast.error(`Créditos insuficientes. Você tem ${photoCredits} créditos e está tentando enviar ${validFiles.length} fotos.`);
      return;
    }

    const newItems: PhotoUploadItem[] = validFiles.map((file) => ({
      id: crypto.randomUUID(),
      file,
      preview: URL.createObjectURL(file),
      status: 'pending',
      progress: 0,
      retryCount: 0,
    }));

    setItems((prev) => [...prev, ...newItems]);
  }, [isAdmin, canUpload, photoCredits]);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item) {
        URL.revokeObjectURL(item.preview);
      }
      return prev.filter((i) => i.id !== id);
    });
  }, []);

  const updateItem = useCallback((id: string, updates: Partial<PhotoUploadItem>) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  }, []);

  const uploadSingleFile = async (item: PhotoUploadItem): Promise<UploadedPhoto | null> => {
    try {
      let originalPath: string | null = null;

      // Step 1: If allowDownload is enabled, upload ORIGINAL to B2 FIRST (before compression discards it)
      if (allowDownload) {
        updateItem(item.id, { status: 'uploading', progress: 5 });
        console.log(`[PhotoUploader] allowDownload=true, uploading original to B2 first: ${item.file.name}`);
        
        // Upload original file to B2
        const originalFormData = new FormData();
        originalFormData.append('file', item.file, item.file.name);
        originalFormData.append('galleryId', galleryId);
        originalFormData.append('originalFilename', item.file.name);
        originalFormData.append('isOriginalOnly', 'true'); // Flag to indicate this is just for storing original

        try {
          const { data: b2Data, error: b2Error } = await supabase.functions.invoke('b2-upload', {
            body: originalFormData,
          });

          if (b2Error) {
            console.error('[PhotoUploader] B2 original upload error:', b2Error);
            // Don't fail the whole upload, just skip original storage
          } else if (b2Data?.success && b2Data?.photo?.storageKey) {
            originalPath = b2Data.photo.storageKey;
            console.log(`[PhotoUploader] Original saved to B2: ${originalPath}`);
          }
        } catch (b2Err) {
          console.error('[PhotoUploader] B2 upload exception:', b2Err);
          // Continue with preview upload even if B2 fails
        }
        
        updateItem(item.id, { progress: 20 });
      }

      // Step 2: Compress (with watermark burn-in if configured)
      updateItem(item.id, { status: 'compressing', progress: allowDownload ? 25 : 10 });
      
      const compressionOptions: Partial<CompressionOptions> = {
        maxLongEdge,
        quality: 0.8,
        removeExif: true,
        watermark: watermarkConfig,
      };
      
      let compressed;
      try {
        compressed = await compressImage(item.file, compressionOptions);
      } catch (compressionError) {
        // Watermark load failure = upload failure (by design)
        const errorMessage = compressionError instanceof Error 
          ? compressionError.message 
          : 'Erro ao processar imagem';
        throw new Error(errorMessage);
      }
      
      updateItem(item.id, { progress: allowDownload ? 40 : 30 });

      // Step 3: Upload preview to R2
      updateItem(item.id, { status: 'uploading', progress: allowDownload ? 50 : 40 });

      // Create FormData with compressed file
      const formData = new FormData();
      formData.append('file', compressed.blob, compressed.filename);
      formData.append('galleryId', galleryId);
      formData.append('originalFilename', item.file.name);
      formData.append('width', compressed.width.toString());
      formData.append('height', compressed.height.toString());
      
      // Pass the B2 original path if we have one
      if (originalPath) {
        formData.append('originalPath', originalPath);
      }

      // Upload via Supabase Edge Function (auto-deploys, no manual wrangler needed)
      const result = await retryWithBackoff(
        async () => {
          const { data, error } = await supabase.functions.invoke('r2-upload', {
            body: formData,
          });

          if (error) {
            throw new Error(error.message || 'Falha ao enviar foto');
          }

          if (!data?.success) {
            // Handle insufficient credits error specifically
            if (data?.code === 'INSUFFICIENT_CREDITS') {
              throw new Error('Créditos insuficientes');
            }
            throw new Error(data?.error || 'Falha ao enviar foto');
          }

          return data;
        },
        {
          maxAttempts: 3,
          baseDelay: 2000,
          onRetry: (attempt, error, delay) => {
            updateItem(item.id, { 
              progress: allowDownload ? 50 : 40,
              error: `Tentativa ${attempt + 1}...` 
            });
            console.log(`[PhotoUploader] Retry ${attempt} for ${item.file.name}: ${error.message}`);
          },
        }
      );

      updateItem(item.id, { status: 'done', progress: 100, error: undefined });
      
      // Refetch credits after successful upload
      refetchCredits();

      return {
        id: result.photo.id,
        filename: result.photo.filename,
        originalFilename: result.photo.originalFilename,
        storageKey: result.photo.storageKey,
        fileSize: result.photo.fileSize,
        mimeType: result.photo.mimeType,
        width: result.photo.width,
        height: result.photo.height,
      };
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      const message = getUploadErrorMessage(errorObj);
      updateItem(item.id, { status: 'error', error: message });
      console.error('[PhotoUploader] Upload error:', error);
      return null;
    }
  };

  const retryItem = useCallback(async (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item || item.status !== 'error') return;

    const currentRetryCount = item.retryCount || 0;
    if (currentRetryCount >= 3) {
      toast.error('Número máximo de tentativas excedido. Tente novamente mais tarde.');
      return;
    }

    updateItem(id, { 
      status: 'pending', 
      progress: 0, 
      error: undefined,
      retryCount: currentRetryCount + 1,
    });

    // Trigger upload for this single item
    const result = await uploadSingleFile(item);
    if (result) {
      toast.success(`Foto "${item.file.name}" enviada com sucesso!`);
      onUploadComplete?.([result]);
    }
  }, [items, updateItem, onUploadComplete]);

  const startUpload = async () => {
    const pendingItems = items.filter((item) => item.status === 'pending');
    if (pendingItems.length === 0) return;

    setIsUploading(true);
    onUploadStart?.();
    onUploadingChange?.(true);

    const results: UploadedPhoto[] = [];

    // Dynamic batch size based on connection quality
    const batchSize = getOptimalBatchSize();
    console.log(`[PhotoUploader] Using batch size: ${batchSize} for ${pendingItems.length} files`);

    for (let i = 0; i < pendingItems.length; i += batchSize) {
      const batch = pendingItems.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map((item) => uploadSingleFile(item))
      );
      results.push(...batchResults.filter((r): r is UploadedPhoto => r !== null));
    }

    setIsUploading(false);
    onUploadingChange?.(false);
    uploadTriggeredRef.current = false;

    const errorCount = items.filter(i => i.status === 'error').length;

    if (results.length > 0) {
      if (errorCount > 0) {
        toast.warning(`${results.length} foto(s) enviada(s), ${errorCount} com erro.`);
      } else {
        toast.success(`${results.length} foto(s) enviada(s) com sucesso!`);
      }
      onUploadComplete?.(results);
    } else if (errorCount > 0) {
      toast.error('Falha ao enviar fotos. Tente novamente.');
    }

    // Clear completed items after a delay
    setTimeout(() => {
      setItems((prev) => prev.filter((item) => item.status !== 'done'));
    }, 2000);
  };

  // Auto-upload when files are added
  useEffect(() => {
    const pendingItems = items.filter((item) => item.status === 'pending');
    if (pendingItems.length > 0 && !isUploading && !uploadTriggeredRef.current) {
      uploadTriggeredRef.current = true;
      startUpload();
    }
  }, [items, isUploading]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      addFiles(e.dataTransfer.files);
    },
    [addFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const pendingCount = items.filter((i) => i.status === 'pending').length;
  const completedCount = items.filter((i) => i.status === 'done').length;
  const errorCount = items.filter((i) => i.status === 'error').length;
  const inProgressCount = items.filter((i) => 
    i.status === 'compressing' || i.status === 'uploading' || i.status === 'saving'
  ).length;

  // Calculate compression savings
  const totalOriginalSize = items.reduce((sum, i) => sum + i.file.size, 0);
  const totalCompressedSize = items
    .filter((i) => i.result)
    .reduce((sum, i) => sum + (i.result?.fileSize || 0), 0);
  const savedBytes = totalOriginalSize - totalCompressedSize;
  const savedPercent = totalOriginalSize > 0 ? Math.round((savedBytes / totalOriginalSize) * 100) : 0;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Credit Warning */}
      {!isAdmin && photoCredits < 10 && (
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
        onClick={() => !isAdmin && photoCredits === 0 ? null : fileInputRef.current?.click()}
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
          !isAdmin && photoCredits === 0 
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
        {!isAdmin && (
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
            {completedCount > 0 && savedPercent > 0 && (
              <p className="text-xs text-muted-foreground">
                Economia: {formatFileSize(savedBytes)} ({savedPercent}%)
              </p>
            )}
          </div>

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
                {item.status !== 'pending' && (
                  <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center">
                    {item.status === 'done' ? (
                      <CheckCircle2 className="h-8 w-8 text-green-400" />
                    ) : item.status === 'error' ? (
                      <>
                        <AlertCircle className="h-8 w-8 text-red-400" />
                        <p className="text-xs text-white mt-1 px-2 text-center line-clamp-2">
                          {item.error}
                        </p>
                        {(item.retryCount || 0) < 3 && (
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
                          {item.status === 'uploading' && 'Enviando...'}
                          {item.status === 'saving' && 'Salvando...'}
                        </p>
                        <Progress value={item.progress} className="w-3/4 mt-2 h-1" />
                      </>
                    )}
                  </div>
                )}

                {/* Remove Button (only for pending or error) */}
                {(item.status === 'pending' || item.status === 'error') && (
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
