import { ArrowLeft, Check, Loader2 } from 'lucide-react';
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
        <div className="flex items-center justify-between px-4 py-3">
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
        <div className="max-w-lg mx-auto">
          
          {/* Title */}
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
        </div>
      </main>

      {/* Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t border-border/30 p-4 z-50">
        <div className="max-w-lg mx-auto">
          <Button 
            variant="terracotta" 
            size="lg" 
            className="w-full gap-2"
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
