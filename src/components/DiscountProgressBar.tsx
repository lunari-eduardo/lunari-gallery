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
import { Sparkles, ChevronRight } from 'lucide-react';

interface DiscountProgressBarProps {
  regrasCongeladas: RegrasCongeladas | null | undefined;
  totalExtras: number;
  extraPhotoPrice: number;
  selectedCount?: number;
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
  selectedCount = 0,
  saleSettings,
  includedPhotos = 0,
}: DiscountProgressBarProps) {
  const analysis = useMemo(() => {
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
    
    const faixaAtual = totalExtras > 0 ? encontrarFaixaPreco(totalExtras, sortedFaixas) : null;
    const currentPrice = faixaAtual ? normalizarValor(faixaAtual.valor) : basePrice;
    
    const currentIdx = faixaAtual ? sortedFaixas.findIndex(f => f.min === faixaAtual.min && f.max === faixaAtual.max) : -1;
    const nextFaixa = currentIdx >= 0 && currentIdx < sortedFaixas.length - 1 ? sortedFaixas[currentIdx + 1] : null;
    
    const effectiveNext = totalExtras === 0 ? sortedFaixas[0] : nextFaixa;
    
    const photosToNext = effectiveNext ? effectiveNext.min - totalExtras : 0;
    
    const currentDiscount = basePrice > 0 ? Math.round(((basePrice - currentPrice) / basePrice) * 100) : 0;
    
    const nextPrice = effectiveNext ? normalizarValor(effectiveNext.valor) : null;
    const nextDiscount = nextPrice !== null && basePrice > 0 
      ? Math.round(((basePrice - nextPrice) / basePrice) * 100) 
      : null;
    
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

  return (
    <div className="fixed bottom-[60px] left-0 right-0 z-40 animate-slide-up">
      <div className="mx-auto max-w-2xl px-3 pb-1">
        <div className="rounded-2xl backdrop-blur-xl bg-card border border-border/30 shadow-lg overflow-hidden">
          <div className="px-4 py-3">
            {/* Tier segments */}
            <div className="flex gap-1 mb-2">
              {faixas.map((faixa, idx) => {
                const isActive = faixaAtual && faixa.min === faixaAtual.min && faixa.max === faixaAtual.max;
                const isPast = faixaAtual && faixa.min < faixaAtual.min;
                const discount = basePrice > 0 ? Math.round(((basePrice - normalizarValor(faixa.valor)) / basePrice) * 100) : 0;
                
                return (
                  <div 
                    key={idx} 
                    className="flex-1 flex flex-col items-center gap-1"
                  >
                    <div 
                      className={cn(
                        'w-full h-2 rounded-full transition-all duration-500',
                        isActive 
                          ? 'bg-gradient-to-r from-primary to-primary-hover shadow-[0_0_8px_hsl(var(--primary)/0.4)]' 
                          : isPast 
                            ? 'bg-primary/30' 
                            : 'bg-muted/60'
                      )}
                    />
                    <span className={cn(
                      'text-[10px] leading-none font-medium tracking-wide',
                      isActive ? 'text-primary' : isPast ? 'text-primary/50' : 'text-muted-foreground/60'
                    )}>
                      {discount > 0 ? `-${discount}%` : 'Base'}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Status text */}
            <div className="flex items-center justify-center gap-1.5 text-xs">
              <Sparkles className="h-3.5 w-3.5 text-primary/70" />
              {atMaxTier && currentDiscount > 0 ? (
                <span className="text-primary font-semibold">
                  Desconto máximo ativado: {currentDiscount}% 🎉
                </span>
              ) : totalExtras === 0 ? (
                <span className="text-muted-foreground">
                  Selecione fotos extras para ativar descontos progressivos
                </span>
              ) : photosToNext > 0 && nextDiscount !== null && nextDiscount > 0 ? (
                <span className="text-muted-foreground">
                  +{photosToNext} foto{photosToNext > 1 ? 's' : ''} para{' '}
                  <span className="text-primary font-semibold">{nextDiscount}% de desconto</span>
                </span>
              ) : currentDiscount > 0 ? (
                <span className="text-primary font-semibold">
                  Desconto ativo: {currentDiscount}%
                </span>
              ) : (
                <span className="text-muted-foreground">
                  Adicione mais fotos para ativar descontos
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
