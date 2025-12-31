import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowLeft, Eye, Image } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/Logo';
import { MasonryGrid, MasonryItem } from '@/components/MasonryGrid';
import { PhotoCard } from '@/components/PhotoCard';
import { useGalleries } from '@/hooks/useGalleries';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function GalleryPreview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getGallery, isLoading } = useGalleries();

  const gallery = getGallery(id || '');

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Carregando galeria...</p>
        </div>
      </div>
    );
  }

  if (!gallery) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h2 className="font-display text-2xl font-semibold mb-2">
            Galeria não encontrada
          </h2>
          <p className="text-muted-foreground mb-4">
            O link pode estar incorreto ou a galeria foi removida.
          </p>
          <Button variant="outline" onClick={() => navigate('/')}>
            Voltar ao Dashboard
          </Button>
        </div>
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
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border/50">
        <div className="flex items-center justify-between px-3 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(`/gallery/${id}`)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Logo size="sm" />
          </div>
          
          <div className="text-right">
            <p className="text-sm font-medium">{gallery.sessionName}</p>
            <p className="text-xs text-muted-foreground">
              {format(gallery.settings.deadline, "dd 'de' MMMM", { locale: ptBR })}
            </p>
          </div>
        </div>

        {/* Info Bar */}
        <div className="border-t border-border/50 bg-muted/50 py-2 px-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm">
                <span className="font-semibold">{gallery.photos.length}</span>
                <span className="text-muted-foreground"> fotos disponíveis</span>
              </span>
              <span className="text-sm text-muted-foreground">
                {gallery.includedPhotos} incluídas no pacote
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - Full width gallery */}
      <main className="flex-1 px-1 sm:px-2 py-2 pb-20">
        {gallery.photos.length > 0 ? (
          <MasonryGrid>
            {gallery.photos.map((photo) => (
              <MasonryItem key={photo.id}>
                <PhotoCard
                  photo={photo}
                  watermark={gallery.settings.watermark}
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
