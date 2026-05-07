import { useState, useMemo } from 'react';
import { ArrowLeft, Check, Loader2, Heart, MessageSquare, ImageOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
}

function SelectedPhotoCard({ photo }: SelectedPhotoCardProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const displayName = photo.displayName || photo.originalFilename || photo.filename;

  return (
    <div className="group flex gap-3 rounded-lg border border-border/20 bg-card/40 p-2">
      <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-md bg-muted md:h-32 md:w-32">
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
                'h-full w-full object-contain select-none transition-opacity duration-300',
                !isLoaded && 'opacity-0',
                isLoaded && 'opacity-100'
              )}
            />
          </>
        )}

      </div>

      <div className="min-w-0 flex-1 space-y-2 py-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-sm font-medium leading-tight" title={displayName}>
            {displayName}
          </p>
          {photo.isFavorite && (
            <Heart className="h-4 w-4 shrink-0 fill-destructive text-destructive" />
          )}
        </div>
        {photo.comment && (
          <p className="line-clamp-2 text-xs leading-snug text-muted-foreground italic" title={photo.comment}>
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
        <div className="mx-auto grid max-w-6xl grid-cols-1 lg:grid-cols-[minmax(420px,520px)_minmax(360px,460px)] lg:justify-center lg:gap-16">
          
          {/* LEFT (desktop) / BOTTOM (mobile): Visual grid */}
          <section className="order-2 lg:order-1">
            <div className="flex items-baseline justify-between mb-4 mt-8 lg:mt-0">
              <h2 className="text-xl font-semibold">
                Resumo de seleção <span className="text-muted-foreground font-normal">({selectedPhotos.length})</span>
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

            <div className="flex flex-col gap-3 lg:max-h-[calc(100vh-220px)] lg:max-w-[520px] lg:overflow-y-auto lg:pr-2">
              {selectedPhotos.map((photo) => (
                <SelectedPhotoCard
                  key={photo.id}
                  photo={photo}
                />
              ))}
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
                  <span className="text-base font-medium">Valor a pagar agora</span>
                  <span className="text-2xl font-bold text-primary">
                    R$ {priceInfo.total.toFixed(2)}
                  </span>
                </div>

                {valorJaPago > 0 && (
                  <>
                    <p className="text-xs text-muted-foreground mt-1">
                      Você já pagou R$ {valorJaPago.toFixed(2)} por {extrasPagasAnteriormente} foto{extrasPagasAnteriormente === 1 ? '' : 's'} extra{extrasPagasAnteriormente === 1 ? '' : 's'} anteriormente. Agora paga apenas o adicional.
                    </p>
                    <details className="mt-2 text-xs text-muted-foreground">
                      <summary className="cursor-pointer select-none hover:text-foreground transition-colors">
                        Ver detalhes do cálculo
                      </summary>
                      <div className="mt-2 space-y-1 pl-2 border-l-2 border-border/40">
                        <div className="flex justify-between">
                          <span>Valor total ({totalExtras} fotos)</span>
                          <span>R$ {priceInfo.valorTotalIdeal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Já pago anteriormente</span>
                          <span className="text-green-600 dark:text-green-400">- R$ {valorJaPago.toFixed(2)}</span>
                        </div>
                      </div>
                    </details>
                  </>
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
