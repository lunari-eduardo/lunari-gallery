import { Gallery, DiscountPackage } from '@/types/gallery';
import { Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { calcularPrecoProgressivoComCredito, RegrasCongeladas } from '@/lib/pricingUtils';
import { useDiscountAnalysis, InlineDiscountTiers } from '@/components/DiscountProgressBar';
import { useIsMobile } from '@/hooks/use-mobile';

interface SelectionSummaryProps {
  gallery: Gallery;
  onConfirm?: () => void;
  isClient?: boolean;
  variant?: 'default' | 'bottom-bar';
  regrasCongeladas?: RegrasCongeladas | null;
  extrasPagasTotal?: number;
  extrasACobrar?: number;
  valorJaPago?: number;
  saleSettings?: {
    pricingModel?: string;
    discountPackages?: DiscountPackage[];
    fixedPrice?: number;
  } | null;
}

export function SelectionSummary({ 
  gallery, 
  onConfirm, 
  isClient = false,
  variant = 'default',
  regrasCongeladas,
  extrasPagasTotal = 0,
  extrasACobrar: extrasACobrarProp,
  valorJaPago = 0,
  saleSettings,
}: SelectionSummaryProps) {
  const { includedPhotos, selectedCount, extraPhotoPrice, selectionStatus } = gallery;
  const extraCount = Math.max(0, selectedCount - includedPhotos);
  const isOverLimit = extraCount > 0;
  const isConfirmed = selectionStatus === 'confirmed';
  const isBlocked = selectionStatus === 'blocked';
  const isMobile = useIsMobile();
  
  const extrasACobrar = extrasACobrarProp ?? Math.max(0, extraCount - extrasPagasTotal);
  
  const { valorUnitario, valorACobrar, valorTotalIdeal, economia, totalExtras } = calcularPrecoProgressivoComCredito(
    extrasACobrar,
    extrasPagasTotal,
    valorJaPago,
    regrasCongeladas,
    extraPhotoPrice
  );
  
  const displayUnitPrice = valorUnitario;
  const displayTotal = valorACobrar;

  // Discount analysis for inline tier display
  const discountAnalysis = useDiscountAnalysis({
    regrasCongeladas,
    totalExtras: totalExtras,
    extraPhotoPrice,
    saleSettings,
    includedPhotos,
  });

  const showDiscountTiers = discountAnalysis && selectedCount >= includedPhotos;

  // Bottom bar variant for client gallery
  if (variant === 'bottom-bar') {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 backdrop-blur-xl bg-card/80 border-t border-border/30 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
        {/* Discount tier row */}
        {showDiscountTiers && (
          <div className={cn(
            "border-b border-border/20",
            isMobile ? "px-3 py-1.5" : "px-4 py-2"
          )}>
            <InlineDiscountTiers
              analysis={discountAnalysis}
              totalExtras={totalExtras}
              isMobile={isMobile}
            />
          </div>
        )}

        {/* Main selection row */}
        <div className={cn(
          "flex items-center justify-between gap-3",
          isMobile ? "px-3 py-2" : "px-4 py-3 gap-4"
        )}>
          {/* Selection count */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className={cn(
                "font-bold",
                isMobile ? "text-base" : "text-lg"
              )}>{selectedCount}</span>
              <span className={cn(
                "text-muted-foreground",
                isMobile ? "text-xs" : "text-sm"
              )}>/ {includedPhotos}</span>
            </div>
            
            {isOverLimit && (
              <div className="flex items-center gap-1.5 text-primary">
                <span className={cn(
                  "font-medium",
                  isMobile ? "text-xs" : "text-sm"
                )}>+{totalExtras} extras</span>
                <span className={cn(
                  "font-bold",
                  isMobile ? "text-xs" : "text-sm"
                )}>R$ {displayTotal.toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Status or action */}
          <div className="flex items-center gap-2">
            {isConfirmed ? (
              <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                <Check className={cn(isMobile ? "h-4 w-4" : "h-5 w-5")} />
                <span className={cn(
                  "font-medium hidden sm:inline",
                  isMobile ? "text-xs" : "text-sm"
                )}>Confirmada</span>
              </div>
            ) : isBlocked ? (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <AlertCircle className={cn(isMobile ? "h-4 w-4" : "h-5 w-5")} />
                <span className={cn(
                  "font-medium hidden sm:inline",
                  isMobile ? "text-xs" : "text-sm"
                )}>Bloqueada</span>
              </div>
            ) : (
              <Button 
                onClick={onConfirm}
                variant="terracotta"
                size={isMobile ? "default" : "lg"}
                className={cn(isMobile ? "px-4 text-xs h-8" : "px-6")}
              >
                <Check className={cn(isMobile ? "h-3 w-3 mr-1" : "h-4 w-4 mr-2")} />
                Confirmar
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Default card variant
  return (
    <div className="lunari-card p-4 md:p-6 space-y-4">
      <h3 className="text-lg font-semibold">Resumo da Seleção</h3>
      
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Fotos incluídas</span>
          <span className="font-medium">{includedPhotos}</span>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Selecionadas</span>
          <span className={cn(
            'font-medium',
            isOverLimit ? 'text-primary' : 'text-foreground'
          )}>
            {selectedCount}
          </span>
        </div>

        {isOverLimit && (
          <>
            <div className="h-px bg-border" />
            
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Fotos extras totais</span>
              <span className="font-medium text-primary">+{totalExtras}</span>
            </div>
            
            {extrasPagasTotal > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Extras já pagas</span>
                <span className="font-medium text-muted-foreground">-{extrasPagasTotal}</span>
              </div>
            )}
            
            {extrasACobrar > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Extras a pagar</span>
                <span className="font-medium text-primary">+{extrasACobrar}</span>
              </div>
            )}
            
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Valor por extra</span>
              <span className="font-medium">R$ {displayUnitPrice.toFixed(2)}</span>
            </div>
            
            <div className="h-px bg-border" />
            
            {valorJaPago > 0 && valorTotalIdeal > 0 && (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Valor total ({totalExtras} fotos)</span>
                  <span className="font-medium">R$ {valorTotalIdeal.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Já pago</span>
                  <span className="font-medium text-muted-foreground">-R$ {valorJaPago.toFixed(2)}</span>
                </div>
              </>
            )}
            
            <div className="flex items-center justify-between">
              <span className="font-medium">Valor a pagar</span>
              <span className="text-lg font-bold text-primary">
                R$ {displayTotal.toFixed(2)}
              </span>
            </div>
          </>
        )}
      </div>

      {isOverLimit && gallery.settings.allowExtraPhotos && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/10 text-sm">
          <AlertCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
          <p className="text-primary">
            {isClient 
              ? `Você selecionou ${extraCount} foto${extraCount > 1 ? 's' : ''} além do pacote. O valor adicional será cobrado posteriormente.`
              : displayTotal > 0
                ? `Cliente selecionou ${extraCount} foto${extraCount > 1 ? 's' : ''} extra${extraCount > 1 ? 's' : ''}. Valor adicional: R$ ${displayTotal.toFixed(2)}`
                : `Cliente selecionou ${extraCount} foto${extraCount > 1 ? 's' : ''} extra${extraCount > 1 ? 's' : ''}. Valor já pago: R$ ${valorJaPago.toFixed(2)}`
            }
          </p>
        </div>
      )}

      {isClient && !isConfirmed && !isBlocked && (
        <Button 
          onClick={onConfirm}
          variant="terracotta"
          className="w-full"
          size="lg"
        >
          <Check className="h-4 w-4 mr-2" />
          Confirmar Seleção
        </Button>
      )}

      {isConfirmed && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-sm">
          <Check className="h-4 w-4 flex-shrink-0" />
          <p>Seleção confirmada com sucesso!</p>
        </div>
      )}
    </div>
  );
}
