import { useState, useMemo, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { format, differenceInHours, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Calendar, 
  Image, 
  Check, 
  AlertTriangle, 
  Clock,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { MasonryGrid, MasonryItem } from '@/components/MasonryGrid';
import { PhotoCard } from '@/components/PhotoCard';
import { Lightbox } from '@/components/Lightbox';
import { SelectionSummary } from '@/components/SelectionSummary';
import { mockGalleries } from '@/data/mockData';
import { GalleryPhoto } from '@/types/gallery';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function ClientGallery() {
  const { id } = useParams();
  const [showWelcome, setShowWelcome] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [isConfirmed, setIsConfirmed] = useState(false);

  const gallery = mockGalleries.find(g => g.id === id);

  useEffect(() => {
    if (gallery) {
      setPhotos(gallery.photos.map(p => ({ ...p })));
      setIsConfirmed(gallery.selectionStatus === 'confirmed');
    }
  }, [gallery]);

  if (!gallery) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h2 className="font-display text-2xl font-semibold mb-2">
            Galeria não encontrada
          </h2>
          <p className="text-muted-foreground">
            O link pode estar incorreto ou a galeria foi removida.
          </p>
        </div>
      </div>
    );
  }

  const hoursUntilDeadline = differenceInHours(gallery.settings.deadline, new Date());
  const isNearDeadline = hoursUntilDeadline <= 48 && hoursUntilDeadline > 0;
  const isExpired = isPast(gallery.settings.deadline);
  const isBlocked = isExpired || isConfirmed;

  const selectedCount = photos.filter(p => p.isSelected).length;
  const extraCount = Math.max(0, selectedCount - gallery.includedPhotos);
  const extraTotal = extraCount * gallery.extraPhotoPrice;

  const toggleSelection = (photoId: string) => {
    if (isBlocked) return;
    
    setPhotos(prev => prev.map(p => 
      p.id === photoId ? { ...p, isSelected: !p.isSelected } : p
    ));
  };

  const handleComment = (photoId: string, comment: string) => {
    setPhotos(prev => prev.map(p => 
      p.id === photoId ? { ...p, comment } : p
    ));
    toast.success('Comentário salvo!');
  };

  const handleConfirm = () => {
    setShowConfirmDialog(false);
    setIsConfirmed(true);
    toast.success('Seleção confirmada!', {
      description: 'O fotógrafo receberá sua seleção.',
    });
  };

  // Parse welcome message
  const welcomeMessage = gallery.settings.welcomeMessage
    .replace('{cliente}', gallery.clientName.split(' ')[0])
    .replace('{sessao}', gallery.sessionName)
    .replace('{estudio}', 'Studio Lunari');

  if (showWelcome) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <header className="flex items-center justify-between p-4 border-b border-border/50">
          <Logo size="sm" />
          <ThemeToggle />
        </header>
        
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full text-center space-y-6 animate-slide-up">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Image className="h-10 w-10 text-primary" />
            </div>
            
            <div>
              <h1 className="font-display text-3xl font-semibold mb-2">
                {gallery.sessionName}
              </h1>
              <p className="text-muted-foreground">
                {gallery.photos.length} fotos disponíveis
              </p>
            </div>

            <div className="lunari-card p-6 text-left">
              <p className="whitespace-pre-line text-sm leading-relaxed">
                {welcomeMessage}
              </p>
            </div>

            <div className="flex items-center justify-center gap-4 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Check className="h-4 w-4 text-primary" />
                <span>{gallery.includedPhotos} fotos incluídas</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>
                  até {format(gallery.settings.deadline, "dd 'de' MMM", { locale: ptBR })}
                </span>
              </div>
            </div>

            {isNearDeadline && (
              <div className="flex items-center gap-2 justify-center text-warning">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm font-medium">
                  Atenção: {hoursUntilDeadline}h restantes para seleção
                </span>
              </div>
            )}

            {isExpired && (
              <div className="flex items-center gap-2 justify-center text-destructive">
                <Clock className="h-4 w-4" />
                <span className="text-sm font-medium">
                  Prazo de seleção expirado
                </span>
              </div>
            )}

            <Button 
              variant="terracotta" 
              size="xl" 
              className="w-full"
              onClick={() => setShowWelcome(false)}
            >
              {isExpired ? 'Visualizar Galeria' : 'Começar Seleção'}
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border/50">
        <div className="container flex items-center justify-between py-3">
          <Logo size="sm" />
          
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium">{gallery.sessionName}</p>
              <p className="text-xs text-muted-foreground">
                {format(gallery.settings.deadline, "dd 'de' MMMM", { locale: ptBR })}
              </p>
            </div>
            <ThemeToggle />
          </div>
        </div>

        {/* Selection Bar */}
        <div className={cn(
          'border-t border-border/50 bg-muted/50 py-2',
          isBlocked && 'bg-destructive/10'
        )}>
          <div className="container flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm">
                <span className="font-semibold">{selectedCount}</span>
                <span className="text-muted-foreground">/{gallery.includedPhotos} selecionadas</span>
              </span>
              {extraCount > 0 && (
                <span className="text-sm text-primary font-medium">
                  +{extraCount} extras (R$ {extraTotal.toFixed(2)})
                </span>
              )}
            </div>
            
            {isNearDeadline && !isExpired && (
              <span className="text-sm text-warning font-medium flex items-center gap-1">
                <AlertTriangle className="h-4 w-4" />
                {hoursUntilDeadline}h restantes
              </span>
            )}

            {isExpired && (
              <span className="text-sm text-destructive font-medium flex items-center gap-1">
                <Clock className="h-4 w-4" />
                Prazo expirado
              </span>
            )}

            {isConfirmed && (
              <span className="text-sm text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
                <Check className="h-4 w-4" />
                Seleção confirmada
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container py-6">
        <div className="grid gap-6 lg:grid-cols-4">
          <div className="lg:col-span-3">
            <MasonryGrid>
              {photos.map((photo, index) => (
                <MasonryItem key={photo.id}>
                  <PhotoCard
                    photo={photo}
                    watermark={gallery.settings.watermark}
                    isSelected={photo.isSelected}
                    allowComments={gallery.settings.allowComments}
                    disabled={isBlocked}
                    onSelect={() => toggleSelection(photo.id)}
                    onViewFullscreen={() => setLightboxIndex(index)}
                    onComment={() => {}}
                  />
                </MasonryItem>
              ))}
            </MasonryGrid>
          </div>

          <div className="lg:col-span-1">
            <div className="sticky top-36">
              <SelectionSummary 
                gallery={{
                  ...gallery,
                  selectedCount,
                  extraCount,
                  extraTotal,
                  selectionStatus: isConfirmed ? 'confirmed' : 'in_progress',
                }}
                onConfirm={() => setShowConfirmDialog(true)}
                isClient
              />
            </div>
          </div>
        </div>
      </main>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <Lightbox
          photos={photos}
          currentIndex={lightboxIndex}
          watermark={gallery.settings.watermark}
          allowComments={gallery.settings.allowComments}
          disabled={isBlocked}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
          onSelect={(photoId) => toggleSelection(photoId)}
          onComment={handleComment}
        />
      )}

      {/* Confirm Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Seleção</DialogTitle>
            <DialogDescription>
              Você está prestes a confirmar sua seleção de {selectedCount} fotos.
              {extraCount > 0 && (
                <span className="block mt-2 text-primary font-medium">
                  Valor adicional: R$ {extraTotal.toFixed(2)} ({extraCount} fotos extras)
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="p-4 rounded-lg bg-muted text-sm">
            <p className="font-medium mb-1">⚠️ Atenção</p>
            <p className="text-muted-foreground">
              Após confirmar, você não poderá alterar sua seleção. 
              Certifique-se de que escolheu todas as fotos desejadas.
            </p>
          </div>

          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Revisar
            </Button>
            <Button variant="terracotta" onClick={handleConfirm}>
              <Check className="h-4 w-4 mr-2" />
              Confirmar Seleção
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
