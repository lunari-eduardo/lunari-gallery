import { useState, useMemo } from 'react';
import { ArrowLeft, Check, Loader2, Heart, MessageSquare, ImageOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Gallery, GalleryPhoto } from '@/types/gallery';
import { calcularPrecoProgressivoComCredito, RegrasCongeladas } from '@/lib/pricingUtils';
import { cn } from '@/lib/utils';

interface SelectionConfirmationProps {
  gallery: Gallery;
  photos: GalleryPhoto[];
  selectedCount: number;
  extraCount: number;
  extrasACobrar: number;
  extrasPagasAnteriormente: number;
  valorJaPago: number;
  regrasCongeladas?: RegrasCongeladas | null;
  hasPaymentProvider?: boolean;
  isConfirming?: boolean;
  onBack: () => void;
  onConfirm: () => void;
  themeStyles?: React.CSSProperties;
  backgroundMode?: 'light' | 'dark';
}

interface SelectedPhotoCardProps {
  photo: GalleryPhoto;
  extraIndex: number | null; // null = within package, number >= 1 = extra position
}

function SelectedPhotoCard({ photo, extraIndex }: SelectedPhotoCardProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const displayName = photo.displayName || photo.originalFilename || photo.filename;

  return (
    <div className="group relative flex flex-col gap-1.5">
      <div className="relative aspect-square overflow-hidden rounded-md bg-muted">
        {hasError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
            <ImageOff className="h-5 w-5" />
          </div>
        ) : (
          <>
            {!isLoaded && <div className="absolute inset-0 bg-muted animate-pulse" />}
            <img
              src={photo.previewUrl}
              alt={displayName}
              loading="lazy"
              draggable={false}
              onLoad={() => setIsLoaded(true)}
              onError={() => setHasError(true)}
              onContextMenu={(e) => e.preventDefault()}
              className={cn(
                'h-full w-full object-cover select-none transition-opacity duration-300',
                !isLoaded && 'opacity-0',
                isLoaded && 'opacity-100'
              )}
            />
          </>
        )}

        {/* Favorite badge */}
        {photo.isFavorite && (
          <div className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow-md">
            <Heart className="h-3.5 w-3.5 fill-current" />
          </div>
        )}

        {/* Extra pill */}
        {extraIndex !== null && (
          <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded-full bg-primary/90 text-primary-foreground text-[10px] font-semibold shadow-md backdrop-blur-sm">
            +{extraIndex}
          </div>
        )}

        {/* Comment badge */}
        {photo.comment && (
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="absolute bottom-1.5 right-1.5 h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md cursor-help">
                  <MessageSquare className="h-3.5 w-3.5" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[240px]">
                <p className="text-xs whitespace-pre-wrap break-words">{photo.comment}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      <div className="px-0.5 space-y-0.5">
        <p className="text-[11px] leading-tight font-medium truncate" title={displayName}>
          {displayName}
        </p>
        {photo.comment && (
          <p className="text-[10px] leading-tight text-muted-foreground line-clamp-2 italic">
            "{photo.comment}"
          </p>
        )}
      </div>
    </div>
  );
}

export function SelectionConfirmation({ 
  gallery,
  photos,
  selectedCount, 
  extraCount,
  extrasACobrar,
  extrasPagasAnteriormente,
  valorJaPago,
  regrasCongeladas,
  hasPaymentProvider = false,
  isConfirming = false,
  onBack, 
  onConfirm,
  themeStyles = {},
  backgroundMode = 'light',
}: SelectionConfirmationProps) {
  const { saleSettings } = gallery;
  const isNoSale = saleSettings?.mode === 'no_sale';
  const isWithPayment = saleSettings?.mode === 'sale_with_payment';
  
  const { valorUnitario, valorACobrar, valorTotalIdeal, totalExtras } = calcularPrecoProgressivoComCredito(
    extrasACobrar,
    extrasPagasAnteriormente,
    valorJaPago,
    regrasCongeladas,
    gallery.extraPhotoPrice
  );
  
  const priceInfo = {
    chargeableCount: extrasACobrar,
    total: valorACobrar,
    pricePerPhoto: valorUnitario,
    valorTotalIdeal,
    totalExtras,
  };

  const hasCharge = !isNoSale && priceInfo.chargeableCount > 0;
  const isQuited = isNoSale || priceInfo.chargeableCount === 0;

  // Selected photos sorted by order (stable)
  const selectedPhotos = useMemo(() => {
    return photos
      .filter((p) => p.isSelected)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [photos]);

  const includedLimit = gallery.includedPhotos ?? 0;
  const favoriteCount = selectedPhotos.filter((p) => p.isFavorite).length;
  const commentCount = selectedPhotos.filter((p) => !!p.comment).length;

  return (
    <div 
      className={cn(
        "min-h-screen flex flex-col bg-background text-foreground",
        backgroundMode === 'dark' && 'dark'
      )}
      style={themeStyles}
    >
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border/30">
        <div className="flex items-center justify-between px-4 py-3 max-w-6xl mx-auto">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onBack}
            className="gap-1.5 text-muted-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
          
          <span className="text-sm font-medium tracking-wide">Confirmar Seleção</span>
          
          <div className="w-20" />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 py-8 pb-28 overflow-y-auto">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] lg:gap-10">
          
          {/* LEFT (desktop) / BOTTOM (mobile): Visual grid */}
          <section className="order-2 lg:order-1">
            <div className="flex items-baseline justify-between mb-4 mt-8 lg:mt-0">
              <h2 className="text-xl font-semibold">
                Suas fotos <span className="text-muted-foreground font-normal">({selectedPhotos.length})</span>
              </h2>
            </div>

            {(favoriteCount > 0 || commentCount > 0) && (
              <div className="flex items-center gap-3 mb-4 text-xs text-muted-foreground">
                {favoriteCount > 0 && (
                  <span className="flex items-center gap-1">
                    <Heart className="h-3 w-3 fill-red-500 text-red-500" />
                    {favoriteCount} {favoriteCount === 1 ? 'favorita' : 'favoritas'}
                  </span>
                )}
                {commentCount > 0 && (
                  <span className="flex items-center gap-1">
                    <MessageSquare className="h-3 w-3 text-primary" />
                    {commentCount} com comentário
                  </span>
                )}
              </div>
            )}

            <div className="grid grid-cols-3 gap-2 lg:grid-cols-2 lg:gap-3">
              {selectedPhotos.map((photo, idx) => {
                const position = idx + 1; // 1-indexed
                const extraIndex = position > includedLimit ? position - includedLimit : null;
                return (
                  <SelectedPhotoCard
                    key={photo.id}
                    photo={photo}
                    extraIndex={extraIndex}
                  />
                );
              })}
            </div>
          </section>

          {/* RIGHT (desktop) / TOP (mobile): Descriptive summary */}
          <aside className="order-1 lg:order-2 lg:sticky lg:top-20 lg:self-start">
            <h2 className="text-xl font-semibold mb-6">Sua seleção</h2>

            {/* Selection breakdown */}
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Selecionadas</span>
                <span className="font-medium">{selectedCount}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Incluídas no pacote</span>
                <span className="font-medium">{gallery.includedPhotos}</span>
              </div>
              
              {extrasPagasAnteriormente > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Extras já pagas</span>
                  <span className="font-medium text-green-600 dark:text-green-400">+{extrasPagasAnteriormente}</span>
                </div>
              )}
              
              {extraCount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Extras</span>
                  <span className="font-medium text-primary">{extraCount}</span>
                </div>
              )}

              {hasCharge && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Valor por foto</span>
                  <span className="font-medium">R$ {priceInfo.pricePerPhoto.toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* Separator */}
            <div className="border-t border-border/30 my-5" />

            {/* Total or no-charge message */}
            {hasCharge ? (
              <div className="space-y-2">
                <div className="flex justify-between items-baseline">
                  <span className="text-base font-medium">Total adicional</span>
                  <span className="text-xl font-bold text-primary">
                    R$ {priceInfo.total.toFixed(2)}
                  </span>
                </div>
                
                {valorJaPago > 0 && (
                  <div className="space-y-1 mt-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Valor total ({totalExtras} fotos)</span>
                      <span>R$ {priceInfo.valorTotalIdeal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Já pago anteriormente</span>
                      <span className="text-green-600 dark:text-green-400">- R$ {valorJaPago.toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                <span className="text-sm text-green-600 dark:text-green-400 font-medium">
                  {isNoSale 
                    ? 'Seleção concluída' 
                    : extrasPagasAnteriormente > 0 && extraCount > 0
                      ? 'Dentro do crédito — sem valor adicional'
                      : 'Dentro do pacote — sem valor adicional'}
                </span>
              </div>
            )}

            {/* Separator */}
            <div className="border-t border-border/30 my-5" />

            {/* Payment notice - inline, no card */}
            {hasCharge && (
              <p className="text-sm text-muted-foreground mb-3">
                {isWithPayment 
                  ? (hasPaymentProvider 
                      ? 'Pagamento online após confirmar.' 
                      : 'O fotógrafo entrará em contato para cobrança.')
                  : `Valor de R$ ${priceInfo.total.toFixed(2)} será cobrado posteriormente.`
                }
              </p>
            )}

            {/* Warning - inline, short */}
            <p className="text-sm text-muted-foreground/70">
              Não será possível alterar após confirmar.
            </p>
          </aside>
        </div>
      </main>

      {/* Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t border-border/30 p-4 z-50">
        <div className="max-w-6xl mx-auto">
          <Button 
            variant="terracotta" 
            size="lg" 
            className="w-full lg:max-w-md lg:mx-auto lg:flex gap-2"
            onClick={onConfirm}
            disabled={isConfirming}
          >
            {isConfirming ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Confirmando...
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                {isWithPayment && hasPaymentProvider && priceInfo.chargeableCount > 0
                  ? 'Confirmar e Pagar'
                  : 'Confirmar Seleção'}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
