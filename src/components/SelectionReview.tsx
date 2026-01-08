import { ArrowLeft, Image, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GalleryPhoto } from '@/types/gallery';
import { cn } from '@/lib/utils';

interface SelectionReviewProps {
  photos: GalleryPhoto[];
  includedPhotos: number;
  onBack: () => void;
  onContinue: () => void;
}

export function SelectionReview({ 
  photos, 
  includedPhotos, 
  onBack, 
  onContinue 
}: SelectionReviewProps) {
  const selectedPhotos = photos.filter(p => p.isSelected);
  const extraCount = Math.max(0, selectedPhotos.length - includedPhotos);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border/50">
        <div className="flex items-center justify-between px-4 py-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onBack}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
          
          <h1 className="font-display text-lg font-semibold">Revisar Seleção</h1>
          
          <div className="w-20" /> {/* Spacer */}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 py-6 pb-24">
        {/* Summary Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Image className="h-8 w-8 text-primary" />
          </div>
          <h2 className="font-display text-2xl font-semibold mb-2">
            Você selecionou {selectedPhotos.length} fotos
          </h2>
          <p className="text-muted-foreground">
            {includedPhotos} incluídas 
            {extraCount > 0 && (
              <span className="text-primary font-medium"> • {extraCount} extras</span>
            )}
          </p>
        </div>

        {/* Selected Photos Grid */}
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-1 sm:gap-2">
          {selectedPhotos.map((photo, index) => (
            <div 
              key={photo.id} 
              className={cn(
                "relative aspect-square overflow-hidden group",
                index >= includedPhotos && "ring-2 ring-primary ring-inset"
              )}
            >
              <img
                src={photo.thumbnailUrl}
                alt={photo.filename}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                  <Check className="h-4 w-4 text-primary-foreground" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {selectedPhotos.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p>Nenhuma foto selecionada ainda.</p>
            <Button variant="outline" onClick={onBack} className="mt-4">
              Voltar à Galeria
            </Button>
          </div>
        )}
      </main>

      {/* Bottom Action Bar */}
      {selectedPhotos.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t border-border/50 p-4 z-50">
          <div className="max-w-md mx-auto">
            <Button 
              variant="terracotta" 
              size="xl" 
              className="w-full"
              onClick={onContinue}
            >
              Continuar para Confirmação
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
