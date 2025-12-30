import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { format, differenceInHours, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Calendar, 
  Image, 
  Check, 
  AlertTriangle, 
  Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/Logo';
import { MasonryGrid, MasonryItem } from '@/components/MasonryGrid';
import { PhotoCard } from '@/components/PhotoCard';
import { Lightbox } from '@/components/Lightbox';
import { SelectionSummary } from '@/components/SelectionSummary';
import { SelectionReview } from '@/components/SelectionReview';
import { SelectionCheckout } from '@/components/SelectionCheckout';
import { useGalleries } from '@/hooks/useGalleries';
import { GalleryPhoto } from '@/types/gallery';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type SelectionStep = 'gallery' | 'review' | 'checkout';

export default function ClientGallery() {
  const { id } = useParams();
  const { getGallery, updatePhotoSelection, updatePhotoComment, confirmSelection } = useGalleries();
  const [showWelcome, setShowWelcome] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [currentStep, setCurrentStep] = useState<SelectionStep>('gallery');
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [isConfirmed, setIsConfirmed] = useState(false);

  const gallery = getGallery(id || '');

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
    if (isBlocked || !gallery) return;
    
    const photo = photos.find(p => p.id === photoId);
    if (photo) {
      updatePhotoSelection(gallery.id, photoId, !photo.isSelected);
      setPhotos(prev => prev.map(p => 
        p.id === photoId ? { ...p, isSelected: !p.isSelected } : p
      ));
    }
  };

  const handleComment = (photoId: string, comment: string) => {
    if (!gallery) return;
    updatePhotoComment(gallery.id, photoId, comment);
    setPhotos(prev => prev.map(p => 
      p.id === photoId ? { ...p, comment } : p
    ));
    toast.success('Comentário salvo!');
  };

  const handleStartConfirmation = () => {
    // If there are extra photos, go through review first
    if (extraCount > 0) {
      setCurrentStep('review');
    } else {
      // No extras, go directly to checkout
      setCurrentStep('checkout');
    }
  };

  const handleConfirm = () => {
    if (!gallery) return;
    confirmSelection(gallery.id);
    setIsConfirmed(true);
    setCurrentStep('gallery');
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
        <header className="flex items-center justify-center p-4 border-b border-border/50">
          <Logo size="sm" />
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

  // Render Review Step
  if (currentStep === 'review') {
    return (
      <SelectionReview
        photos={photos}
        includedPhotos={gallery.includedPhotos}
        onBack={() => setCurrentStep('gallery')}
        onContinue={() => setCurrentStep('checkout')}
      />
    );
  }

  // Render Checkout Step
  if (currentStep === 'checkout') {
    return (
      <SelectionCheckout
        gallery={gallery}
        selectedCount={selectedCount}
        extraCount={extraCount}
        extraTotal={extraTotal}
        onBack={() => extraCount > 0 ? setCurrentStep('review') : setCurrentStep('gallery')}
        onConfirm={handleConfirm}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border/50">
        <div className="flex items-center justify-between px-3 py-3">
          <Logo size="sm" />
          
          <div className="text-right">
            <p className="text-sm font-medium">{gallery.sessionName}</p>
            <p className="text-xs text-muted-foreground">
              {format(gallery.settings.deadline, "dd 'de' MMMM", { locale: ptBR })}
            </p>
          </div>
        </div>

        {/* Selection Bar */}
        <div className={cn(
          'border-t border-border/50 bg-muted/50 py-2 px-3',
          isBlocked && 'bg-destructive/10'
        )}>
          <div className="flex items-center justify-between">
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

      {/* Main Content - Full width gallery */}
      <main className="flex-1 px-1 sm:px-2 py-2 pb-20">
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
      </main>

      {/* Bottom Bar Summary */}
      <SelectionSummary 
        gallery={{
          ...gallery,
          selectedCount,
          extraCount,
          extraTotal,
          selectionStatus: isConfirmed ? 'confirmed' : 'in_progress',
        }}
        onConfirm={handleStartConfirmation}
        isClient
        variant="bottom-bar"
      />

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
    </div>
  );
}
