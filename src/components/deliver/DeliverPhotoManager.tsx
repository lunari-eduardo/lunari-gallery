import { useState, useEffect, useCallback } from 'react';
import { X, ImageIcon, Star } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getPhotoUrl, PhotoPaths } from '@/lib/photoUrl';
import { toast } from 'sonner';

interface GalleryPhoto {
  id: string;
  storage_key: string;
  original_filename: string;
  width: number | null;
  height: number | null;
  preview_path: string | null;
  thumb_path: string | null;
}

interface DeliverPhotoManagerProps {
  galleryId: string;
  refreshKey?: number;
  coverPhotoId?: string | null;
  onCoverChange?: (photoId: string | null) => void;
  onPhotosChange?: (count: number) => void;
}

export function DeliverPhotoManager({
  galleryId,
  refreshKey = 0,
  coverPhotoId,
  onCoverChange,
  onPhotosChange,
}: DeliverPhotoManagerProps) {
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchPhotos = useCallback(async () => {
    const { data, error } = await supabase
      .from('galeria_fotos')
      .select('id, storage_key, original_filename, width, height, preview_path, thumb_path')
      .eq('galeria_id', galleryId)
      .order('created_at');

    if (error) {
      console.error('Error fetching photos:', error);
      return;
    }
    setPhotos(data || []);
    onPhotosChange?.(data?.length || 0);
    setIsLoading(false);
  }, [galleryId, onPhotosChange]);

  useEffect(() => {
    fetchPhotos();
  }, [fetchPhotos, refreshKey]);

  const handleDelete = async (photo: GalleryPhoto) => {
    if (deletingId) return;
    setDeletingId(photo.id);

    try {
      // Call delete-photos edge function to remove from R2
      const { error: fnError } = await supabase.functions.invoke('delete-photos', {
        body: {
          photoIds: [photo.id],
          galleryId,
        },
      });
      if (fnError) throw fnError;

      // Remove from database
      const { error: dbError } = await supabase
        .from('galeria_fotos')
        .delete()
        .eq('id', photo.id);
      if (dbError) throw dbError;

      // If deleted photo was cover, reset cover
      if (coverPhotoId === photo.id) {
        onCoverChange?.(null);
      }

      setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
      onPhotosChange?.(photos.length - 1);
      toast.success('Foto excluída');
    } catch (error) {
      console.error('Error deleting photo:', error);
      toast.error('Erro ao excluir foto');
    } finally {
      setDeletingId(null);
    }
  };

  const handleSetCover = (photoId: string) => {
    const newCoverId = coverPhotoId === photoId ? null : photoId;
    onCoverChange?.(newCoverId);
    toast.success(newCoverId ? 'Foto definida como capa' : 'Capa removida');
  };

  if (isLoading && photos.length === 0) return null;
  if (photos.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {photos.length} foto{photos.length !== 1 ? 's' : ''} enviada{photos.length !== 1 ? 's' : ''}
        </p>
        {coverPhotoId && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            Capa selecionada
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {photos.map((photo) => {
          const isCover = coverPhotoId === photo.id;
          const isDeleting = deletingId === photo.id;
          const paths: PhotoPaths = {
            storageKey: photo.storage_key,
            thumbPath: photo.thumb_path,
            previewPath: photo.preview_path,
            width: photo.width || undefined,
            height: photo.height || undefined,
          };
          const url = getPhotoUrl(paths, 'thumbnail');

          return (
            <div
              key={photo.id}
              className={`group relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                isCover ? 'border-amber-400 ring-2 ring-amber-400/30' : 'border-transparent hover:border-border'
              } ${isDeleting ? 'opacity-50 pointer-events-none' : ''}`}
            >
              <img
                src={url}
                alt={photo.original_filename}
                className="w-full h-full object-cover"
                loading="lazy"
              />

              {/* Cover badge */}
              {isCover && (
                <div className="absolute top-1.5 left-1.5 bg-amber-400 text-black text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                  <Star className="h-2.5 w-2.5 fill-current" />
                  CAPA
                </div>
              )}

              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <button
                  onClick={() => handleSetCover(photo.id)}
                  className={`p-2 rounded-full transition-colors ${
                    isCover
                      ? 'bg-amber-400 text-black hover:bg-amber-300'
                      : 'bg-white/90 text-black hover:bg-white'
                  }`}
                  title={isCover ? 'Remover capa' : 'Definir como capa'}
                >
                  <ImageIcon className="h-4 w-4" />
                </button>

                <button
                  onClick={() => handleDelete(photo)}
                  className="p-2 bg-red-500/90 text-white rounded-full hover:bg-red-500 transition-colors"
                  title="Excluir foto"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
