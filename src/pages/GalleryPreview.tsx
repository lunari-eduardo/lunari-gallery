import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowLeft, Eye, Image, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/Logo';
import { MasonryGrid, MasonryItem } from '@/components/MasonryGrid';
import { PhotoCard } from '@/components/PhotoCard';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useSupabaseGalleries, GaleriaPhoto } from '@/hooks/useSupabaseGalleries';
import { useQuery } from '@tanstack/react-query';
import { GalleryPhoto, WatermarkSettings } from '@/types/gallery';

export default function GalleryPreview() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const { getGallery, fetchGalleryPhotos, getPhotoUrl, isLoading } = useSupabaseGalleries();
  
  const gallery = getGallery(id || '');
  
  const { data: photos = [], isLoading: isLoadingPhotos } = useQuery({
    queryKey: ['galeria-fotos-preview', id],
    queryFn: () => fetchGalleryPhotos(id!),
    enabled: !!gallery && !!id,
  });

  const transformedPhotos: GalleryPhoto[] = useMemo(() => {
    if (!gallery) return [];
    
    return photos.map((photo: GaleriaPhoto, index: number) => ({
      id: photo.id,
      filename: photo.filename,
      originalFilename: photo.originalFilename || photo.filename,
      thumbnailUrl: getPhotoUrl(photo, gallery, 'thumbnail'),
      previewUrl: getPhotoUrl(photo, gallery, 'preview'),
      originalUrl: getPhotoUrl(photo, gallery, 'full'),
      width: photo.width,
      height: photo.height,
      isSelected: photo.isSelected,
      isFavorite: photo.isFavorite ?? false,
      comment: photo.comment || undefined,
      order: photo.orderIndex || index,
    }));
  }, [photos, gallery, getPhotoUrl]);

  const watermark: WatermarkSettings = (gallery?.configuracoes?.watermark as WatermarkSettings) || {
    type: 'standard',
    opacity: 40,
    position: 'center',
  };

  const deadline = gallery?.prazoSelecao || 
    (gallery ? new Date(gallery.createdAt.getTime() + 7 * 24 * 60 * 60 * 1000) : new Date());

  if (isLoading || isLoadingPhotos) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">Carregando galeria...</p>
        </div>
      </div>
    );
  }

  if (!gallery) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-2xl font-bold mb-2">
          Galeria não encontrada
        </h2>
        <p className="text-muted-foreground mb-4">
          O link pode estar incorreto ou a galeria foi removida.
        </p>
        <Button variant="outline" onClick={() => navigate('/')}>
          Voltar ao Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Read-only Banner */}
      <Alert className="rounded-none border-x-0 border-t-0 bg-amber-500/10 border-amber-500/20">
        <Eye className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-700 dark:text-amber-400">
          <strong>Visualização como o cliente verá a galeria</strong> — Modo somente leitura
        </AlertDescription>
      </Alert>

      {/* Header */}
      <header className="bg-background border-b border-border/50">
        <div className="flex items-center justify-between px-3 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(`/gallery/${id}`)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Logo size="sm" />
          </div>
          
          <div className="text-right">
            <p className="text-sm font-medium">{gallery.nomeSessao || 'Sessão'}</p>
            <p className="text-xs text-muted-foreground">
              {format(deadline, "dd 'de' MMMM", { locale: ptBR })}
            </p>
          </div>
        </div>

        {/* Info Bar */}
        <div className="border-t border-border/50 bg-muted/50 py-2 px-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm">
                <span className="font-semibold">{transformedPhotos.length}</span>
                <span className="text-muted-foreground"> fotos disponíveis</span>
              </span>
              <span className="text-sm text-muted-foreground">
                {gallery.fotosIncluidas} incluídas no pacote
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 py-2 pb-20">
        {transformedPhotos.length > 0 ? (
          <MasonryGrid>
            {transformedPhotos.map((photo) => (
              <MasonryItem key={photo.id} photoWidth={photo.width} photoHeight={photo.height}>
                <PhotoCard
                  photo={photo}
                  isSelected={photo.isSelected}
                  allowComments={false}
                  disabled={true}
                  onSelect={() => {}}
                  onViewFullscreen={() => {}}
                />
              </MasonryItem>
            ))}
          </MasonryGrid>
        ) : (
          <div className="flex flex-col items-center justify-center py-16">
            <Image className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhuma foto na galeria</p>
          </div>
        )}
      </main>

      {/* Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t border-border p-4">
        <div className="max-w-md mx-auto">
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => navigate(`/gallery/${id}`)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar para detalhes da galeria
          </Button>
        </div>
      </div>
    </div>
  );
}
