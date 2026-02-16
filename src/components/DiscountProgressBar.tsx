import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { 
  RegrasCongeladas, 
  FaixaPreco, 
  getFaixasFromRegras, 
  encontrarFaixaPreco, 
  normalizarValor,
  buildRegrasFromDiscountPackages 
} from '@/lib/pricingUtils';
import { DiscountPackage } from '@/types/gallery';
import { Tag } from 'lucide-react';

interface DiscountProgressBarProps {
  regrasCongeladas: RegrasCongeladas | null | undefined;
  totalExtras: number;
  extraPhotoPrice: number;
  saleSettings?: {
    pricingModel?: string;
    discountPackages?: DiscountPackage[];
    fixedPrice?: number;
  } | null;
  includedPhotos?: number;
}

export function DiscountProgressBar({
  regrasCongeladas,
  totalExtras,
  extraPhotoPrice,
  saleSettings,
  includedPhotos = 0,
}: DiscountProgressBarProps) {
  const analysis = useMemo(() => {
    // Build regras from standalone discountPackages if needed
    let regras = regrasCongeladas;
    if (!regras && saleSettings?.pricingModel === 'packages' && saleSettings?.discountPackages?.length) {
      regras = buildRegrasFromDiscountPackages(
        saleSettings.discountPackages,
        saleSettings.fixedPrice || extraPhotoPrice,
        includedPhotos
      );
    }

    const faixas = getFaixasFromRegras(regras);
    if (faixas.length < 2) return null;

    const sortedFaixas = [...faixas].sort((a, b) => a.min - b.min);
    const basePrice = normalizarValor(regras?.pacote?.valorFotoExtra || extraPhotoPrice);
    
    // Current tier
    const faixaAtual = totalExtras > 0 ? encontrarFaixaPreco(totalExtras, sortedFaixas) : null;
    const currentPrice = faixaAtual ? normalizarValor(faixaAtual.valor) : basePrice;
    
    // Find next tier
    const currentIdx = faixaAtual ? sortedFaixas.findIndex(f => f.min === faixaAtual.min && f.max === faixaAtual.max) : -1;
    const nextFaixa = currentIdx >= 0 && currentIdx < sortedFaixas.length - 1 ? sortedFaixas[currentIdx + 1] : null;
    
    // If no extras yet, point to the first tier as "next"
    const effectiveNext = totalExtras === 0 ? sortedFaixas[0] : nextFaixa;
    
    const photosToNext = effectiveNext ? effectiveNext.min - totalExtras : 0;
    
    // Current discount percentage
    const currentDiscount = basePrice > 0 ? Math.round(((basePrice - currentPrice) / basePrice) * 100) : 0;
    
    // Next discount percentage
    const nextPrice = effectiveNext ? normalizarValor(effectiveNext.valor) : null;
    const nextDiscount = nextPrice !== null && basePrice > 0 
      ? Math.round(((basePrice - nextPrice) / basePrice) * 100) 
      : null;
    
    // Already at max tier?
    const atMaxTier = currentIdx === sortedFaixas.length - 1;

    return {
      faixas: sortedFaixas,
      faixaAtual,
      currentPrice,
      currentDiscount,
      nextFaixa: effectiveNext,
      nextDiscount,
      photosToNext,
      basePrice,
      atMaxTier,
    };
  }, [regrasCongeladas, totalExtras, extraPhotoPrice, saleSettings, includedPhotos]);

  if (!analysis) return null;

  const { faixas, faixaAtual, currentDiscount, nextDiscount, photosToNext, atMaxTier, basePrice } = analysis;

  // Don't show if no extras selected and no meaningful next tier
  // Show when there are extras OR when user is about to get a discount
  const maxPhotos = faixas[faixas.length - 1]?.max ?? faixas[faixas.length - 1]?.min ?? 1;
  const totalRange = (typeof maxPhotos === 'number' ? maxPhotos : faixas[faixas.length - 1].min + 10);

  return (
    <div className="fixed bottom-[60px] left-0 right-0 z-40 bg-card/95 backdrop-blur border-t border-border/50 animate-fade-in">
      <div className="px-4 py-2.5 max-w-2xl mx-auto">
        {/* Tier segments */}
        <div className="flex gap-0.5 mb-1.5">
          {faixas.map((faixa, idx) => {
            const isActive = faixaAtual && faixa.min === faixaAtual.min && faixa.max === faixaAtual.max;
            const isPast = faixaAtual && faixa.min < faixaAtual.min;
            const discount = basePrice > 0 ? Math.round(((basePrice - normalizarValor(faixa.valor)) / basePrice) * 100) : 0;
            
            return (
              <div 
                key={idx} 
                className="flex-1 flex flex-col items-center gap-0.5"
              >
                <div 
                  className={cn(
                    'w-full h-1.5 rounded-full transition-all duration-300',
                    isActive ? 'bg-primary' : isPast ? 'bg-primary/40' : 'bg-muted'
                  )}
                />
                <span className={cn(
                  'text-[10px] leading-tight',
                  isActive ? 'text-primary font-medium' : 'text-muted-foreground'
                )}>
                  {discount > 0 ? `-${discount}%` : 'Base'}
                </span>
              </div>
            );
          })}
        </div>

        {/* Status text */}
        <div className="flex items-center justify-center gap-1.5 text-xs">
          <Tag className="h-3 w-3 text-muted-foreground" />
          {atMaxTier && currentDiscount > 0 ? (
            <span className="text-primary font-medium">
              Desconto máximo ativado: {currentDiscount}%
            </span>
          ) : photosToNext > 0 && nextDiscount !== null && nextDiscount > 0 ? (
            <span className="text-muted-foreground">
              +{photosToNext} foto{photosToNext > 1 ? 's' : ''} para desconto de{' '}
              <span className="text-primary font-medium">{nextDiscount}%</span>
            </span>
          ) : currentDiscount > 0 ? (
            <span className="text-primary font-medium">
              Desconto ativo: {currentDiscount}%
            </span>
          ) : (
            <span className="text-muted-foreground">
              Adicione extras para ativar descontos progressivos
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
