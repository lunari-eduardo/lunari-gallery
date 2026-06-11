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
  const currentExtras = extraCount; // extras da seleção atual (não billing)
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

  // Discount analysis uses current selection extras (not billing totalExtras)
  const discountAnalysis = useDiscountAnalysis({
    regrasCongeladas,
    totalExtras: currentExtras,
    extraPhotoPrice,
    saleSettings,
    includedPhotos,
  });

  const showDiscountTiers = discountAnalysis && currentExtras > 0;

  // Bottom bar variant for client gallery
  if (variant === 'bottom-bar') {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 backdrop-blur-xl bg-card/80 border-t border-border/30 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
        <div className={cn(
          "flex items-center justify-between",
          isMobile ? "px-3 py-2 gap-2" : "px-4 py-3 gap-4"
        )}>
          {/* Left: Selection count + extras */}
          <div className={cn("flex items-center shrink-0", isMobile ? "gap-1.5" : "gap-3")}>
            <div className="flex items-center gap-1">
              <span className={cn("font-bold", isMobile ? "text-sm" : "text-lg")}>{selectedCount}</span>
              <span className={cn("text-muted-foreground", isMobile ? "text-[10px]" : "text-sm")}>/ {includedPhotos}</span>
            </div>
            {isOverLimit && (
              <div className={cn("flex items-center gap-1 text-primary", isMobile ? "text-[10px]" : "text-sm")}>
                <span className="font-medium">+{totalExtras}</span>
                {extrasPagasTotal > 0 && (
                  <span className={cn("text-muted-foreground font-normal", isMobile ? "text-[9px]" : "text-xs")}>
                    (−{extrasPagasTotal} já pagas)
                  </span>
                )}
                <span className="font-bold">R$ {displayTotal.toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Center: Discount tiers (desktop: segments+text, mobile: text only) */}
          {showDiscountTiers && (
            <div className="flex-1 flex justify-center min-w-0">
              <InlineDiscountTiers
                analysis={discountAnalysis}
                totalExtras={currentExtras}
                isMobile={isMobile}
              />
            </div>
          )}

          {/* Right: Status or action */}
          <div className="flex items-center shrink-0">
            {isConfirmed ? (
              <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                <Check className={cn(isMobile ? "h-4 w-4" : "h-5 w-5")} />
                <span className={cn("font-medium hidden sm:inline", isMobile ? "text-xs" : "text-sm")}>Confirmada</span>
              </div>
            ) : isBlocked ? (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <AlertCircle className={cn(isMobile ? "h-4 w-4" : "h-5 w-5")} />
                <span className={cn("font-medium hidden sm:inline", isMobile ? "text-xs" : "text-sm")}>Bloqueada</span>
              </div>
            ) : (
              <Button 
                onClick={onConfirm}
                variant="terracotta"
                size={isMobile ? "sm" : "lg"}
                className={cn(isMobile ? "px-3 text-[11px] h-7" : "px-6")}
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
    <div className="glass p-6 md:p-8 space-y-6 shadow-xl border-white/5">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-light tracking-tight">Resumo da Seleção</h3>
        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
          <Check className="h-4 w-4 text-primary" />
        </div>
      </div>
      
      <div className="space-y-4">
        {/* Progress Bar Section */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs uppercase tracking-widest opacity-50">
            <span>Progresso da Seleção</span>
            <span>{Math.round((selectedCount / includedPhotos) * 100)}%</span>
          </div>
          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
            <div 
              className={cn(
                "h-full transition-all duration-1000 ease-out",
                isOverLimit ? "bg-amber-500" : "bg-primary"
              )}
              style={{ width: `${Math.min(100, (selectedCount / includedPhotos) * 100)}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 py-2">
          <div className="space-y-1">
            <span className="text-[10px] uppercase tracking-widest opacity-40 block">Fotos Incluídas</span>
            <span className="text-xl font-medium">{includedPhotos}</span>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] uppercase tracking-widest opacity-40 block">Selecionadas</span>
            <span className={cn(
              'text-xl font-bold transition-colors',
              isOverLimit ? 'text-amber-500' : 'text-primary'
            )}>
              {selectedCount}
            </span>
          </div>
        </div>

        {isOverLimit && (
          <div className="space-y-4 pt-4 border-t border-white/5 animate-fade-in">
            <div className="flex items-center justify-between text-sm">
              <span className="opacity-60">Fotos extras</span>
              <span className="font-semibold text-amber-500">+{totalExtras}</span>
            </div>
            
            {extrasPagasTotal > 0 && (
              <div className="flex items-center justify-between text-xs opacity-50">
                <span>Extras já pagas</span>
                <span className="line-through">-{extrasPagasTotal}</span>
              </div>
            )}

            <div className="flex items-center justify-between text-sm">
              <span className="opacity-60">Valor unitário</span>
              <span>R$ {displayUnitPrice.toFixed(2)}</span>
            </div>
            
            <div className="flex items-center justify-between pt-2 border-t border-white/5">
              <span className="text-base font-medium">Total adicional</span>
              <span className="text-2xl font-bold text-primary">
                R$ {displayTotal.toFixed(2)}
              </span>
            </div>
          </div>
        )}
      </div>

      {isOverLimit && gallery.settings.allowExtraPhotos && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-sm">
          <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
          <p className="text-amber-500/90 leading-relaxed">
            {isClient 
              ? `Você selecionou ${extraCount} foto${extraCount > 1 ? 's' : ''} além do seu pacote original.`
              : `O cliente selecionou ${extraCount} foto${extraCount > 1 ? 's' : ''} extra${extraCount > 1 ? 's' : ''}.`
            }
          </p>
        </div>
      )}

      {isClient && !isConfirmed && !isBlocked && (
        <Button 
          onClick={onConfirm}
          variant="default"
          className="w-full shadow-lg hover:shadow-primary/20 transition-all duration-500 h-14 text-base tracking-wide"
          size="lg"
          style={{ 
            backgroundColor: 'var(--gallery-primary)',
            color: 'var(--gallery-primary-foreground)',
            borderRadius: 'var(--gallery-radius)'
          }}
        >
          <Check className="h-5 w-5 mr-2" />
          Confirmar Seleção
        </Button>
      )}

      {isConfirmed && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400 text-sm animate-scale-in">
          <Check className="h-5 w-5 flex-shrink-0" />
          <p className="font-medium">Sua seleção foi enviada com sucesso!</p>
        </div>
      )}
    </div>
  );
}
