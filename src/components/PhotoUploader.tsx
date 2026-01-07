import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Upload, X, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { 
  compressImage, 
  isValidImageType, 
  formatFileSize,
  CompressionOptions 
} from '@/lib/imageCompression';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
}

interface PhotoUploaderProps {
  galleryId: string;
  maxWidth?: 800 | 1024 | 1920;
  onUploadComplete?: (photos: UploadedPhoto[]) => void;
  onUploadStart?: () => void;
  onUploadingChange?: (isUploading: boolean) => void;
  className?: string;
}

export function PhotoUploader({
  galleryId,
  maxWidth = 1920,
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

  const addFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const validFiles = fileArray.filter(isValidImageType);
    
    if (validFiles.length !== fileArray.length) {
      toast.error('Alguns arquivos foram ignorados. Formatos aceitos: JPG, PNG, WEBP');
    }

    const newItems: PhotoUploadItem[] = validFiles.map((file) => ({
      id: crypto.randomUUID(),
      file,
      preview: URL.createObjectURL(file),
      status: 'pending',
      progress: 0,
    }));

    setItems((prev) => [...prev, ...newItems]);
  }, []);

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
      // Step 1: Compress
      updateItem(item.id, { status: 'compressing', progress: 10 });
      
      const compressionOptions: Partial<CompressionOptions> = {
        maxWidth,
        quality: 0.8,
        removeExif: true,
      };
      
      const compressed = await compressImage(item.file, compressionOptions);
      updateItem(item.id, { progress: 30 });

      // Step 2: Get upload URL
      updateItem(item.id, { status: 'uploading', progress: 40 });
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Não autenticado');
      }

      const response = await fetch(
        `https://tlnjspsywycbudhewsfv.supabase.co/functions/v1/get-upload-url`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            galleryId,
            filename: compressed.filename,
            contentType: compressed.blob.type,
            fileSize: compressed.compressedSize,
            width: compressed.width,
            height: compressed.height,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Falha ao obter URL de upload');
      }

      const uploadData = await response.json();
      updateItem(item.id, { progress: 50 });

      // Step 3: Upload to B2
      const uploadResponse = await fetch(uploadData.uploadUrl, {
        method: 'POST',
        headers: {
          Authorization: uploadData.authorizationToken,
          'Content-Type': compressed.blob.type,
          'X-Bz-File-Name': encodeURIComponent(uploadData.storageKey),
          'X-Bz-Content-Sha1': 'do_not_verify',
        },
        body: compressed.blob,
      });

      if (!uploadResponse.ok) {
        throw new Error('Falha ao enviar arquivo para storage');
      }

      updateItem(item.id, { progress: 80 });

      // Step 4: Save to database
      updateItem(item.id, { status: 'saving', progress: 90 });
      
      const { data: photoRecord, error: dbError } = await supabase
        .from('galeria_fotos')
        .insert({
          galeria_id: galleryId,
          user_id: session.user.id,
          filename: compressed.filename,
          original_filename: item.file.name,
          storage_key: uploadData.storageKey,
          file_size: compressed.compressedSize,
          mime_type: compressed.blob.type,
          width: compressed.width,
          height: compressed.height,
          is_selected: false,
          order_index: 0,
        })
        .select()
        .single();

      if (dbError) {
        throw new Error('Falha ao salvar foto no banco');
      }

      updateItem(item.id, { status: 'done', progress: 100 });

      return {
        id: photoRecord.id,
        filename: photoRecord.filename,
        originalFilename: photoRecord.original_filename,
        storageKey: photoRecord.storage_key,
        fileSize: photoRecord.file_size,
        mimeType: photoRecord.mime_type,
        width: photoRecord.width,
        height: photoRecord.height,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      updateItem(item.id, { status: 'error', error: message });
      return null;
    }
  };

  const startUpload = async () => {
    const pendingItems = items.filter((item) => item.status === 'pending');
    if (pendingItems.length === 0) return;

    setIsUploading(true);
    onUploadStart?.();
    onUploadingChange?.(true);

    const results: UploadedPhoto[] = [];

    // Upload in parallel batches of 3
    const batchSize = 3;
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

    if (results.length > 0) {
      toast.success(`${results.length} foto(s) enviada(s) com sucesso!`);
      onUploadComplete?.(results);
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

  return (
    <div className={cn('space-y-4', className)}>
      {/* Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
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
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {completedCount} de {items.length} enviadas
              {errorCount > 0 && ` • ${errorCount} erro(s)`}
              {isUploading && pendingCount > 0 && ' • Enviando...'}
            </p>
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
                        <p className="text-xs text-white mt-1 px-2 text-center">
                          {item.error}
                        </p>
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

                {/* Remove Button (only for pending) */}
                {item.status === 'pending' && (
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
