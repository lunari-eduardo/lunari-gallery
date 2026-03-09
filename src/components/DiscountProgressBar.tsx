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
import { Sparkles } from 'lucide-react';

interface DiscountAnalysisInput {
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

export interface DiscountAnalysis {
  faixas: FaixaPreco[];
  faixaAtual: FaixaPreco | null;
  currentPrice: number;
  currentDiscount: number;
  nextFaixa: FaixaPreco | null;
  nextDiscount: number | null;
  photosToNext: number;
  basePrice: number;
  atMaxTier: boolean;
}

export function useDiscountAnalysis({
  regrasCongeladas,
  totalExtras,
  extraPhotoPrice,
  saleSettings,
  includedPhotos = 0,
}: DiscountAnalysisInput): DiscountAnalysis | null {
  return useMemo(() => {
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
}

// Compact inline tier display for use inside SelectionSummary bottom-bar
interface InlineDiscountTiersProps {
  analysis: DiscountAnalysis;
  totalExtras: number;
  isMobile?: boolean;
}

export function InlineDiscountTiers({ analysis, totalExtras, isMobile = false }: InlineDiscountTiersProps) {
  const { faixas, faixaAtual, currentDiscount, nextDiscount, photosToNext, atMaxTier } = analysis;

  if (isMobile) {
    // Mobile: text only, no tier segments
    return (
      <div className="flex items-center gap-1 text-[10px]">
        <Sparkles className="h-2.5 w-2.5 text-primary/70 shrink-0" />
        {atMaxTier && currentDiscount > 0 ? (
          <span className="text-primary font-semibold whitespace-nowrap">
            Desconto máximo: {currentDiscount}%! 🎉
          </span>
        ) : totalExtras === 0 ? (
          <span className="text-muted-foreground whitespace-nowrap">
            Extras desbloqueiam descontos
          </span>
        ) : photosToNext > 0 && nextDiscount !== null && nextDiscount > 0 ? (
          <span className="text-muted-foreground whitespace-nowrap">
            Falta{photosToNext > 1 ? 'm' : ''} {photosToNext} foto{photosToNext > 1 ? 's' : ''} para desconto de <span className="text-primary font-semibold">{nextDiscount}%</span>
          </span>
        ) : currentDiscount > 0 ? (
          <span className="text-primary font-semibold whitespace-nowrap">
            Você tem {currentDiscount}% de desconto em extras
          </span>
        ) : (
          <span className="text-muted-foreground whitespace-nowrap">
            Mais extras = descontos
          </span>
        )}
      </div>
    );
  }

  // Desktop: tier segments + text in one line
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5 max-w-[140px]">
        {faixas.map((faixa, idx) => {
          const isActive = faixaAtual && faixa.min === faixaAtual.min && faixa.max === faixaAtual.max;
          const isPast = faixaAtual && faixa.min < faixaAtual.min;
          return (
            <div 
              key={idx} 
              className={cn(
                'flex-1 h-1.5 rounded-full transition-all duration-500',
                isActive 
                  ? 'bg-gradient-to-r from-primary to-primary/70 shadow-[0_0_6px_hsl(var(--primary)/0.4)]' 
                  : isPast 
                    ? 'bg-primary/30' 
                    : 'bg-muted/50'
              )}
            />
          );
        })}
      </div>
      <div className="flex items-center gap-1 text-[11px] shrink-0">
        <Sparkles className="h-3 w-3 text-primary/70 shrink-0" />
        {atMaxTier && currentDiscount > 0 ? (
          <span className="text-primary font-semibold whitespace-nowrap">
            Desconto máximo: {currentDiscount}%! 🎉
          </span>
        ) : totalExtras === 0 ? (
          <span className="text-muted-foreground whitespace-nowrap">
            Selecione extras para descontos
          </span>
        ) : photosToNext > 0 && nextDiscount !== null && nextDiscount > 0 ? (
          <span className="text-muted-foreground whitespace-nowrap">
            Falta{photosToNext > 1 ? 'm' : ''} {photosToNext} foto{photosToNext > 1 ? 's' : ''} para desconto de <span className="text-primary font-semibold">{nextDiscount}%</span>
          </span>
        ) : currentDiscount > 0 ? (
          <span className="text-primary font-semibold whitespace-nowrap">
            Você tem {currentDiscount}% de desconto em extras
          </span>
        ) : (
          <span className="text-muted-foreground whitespace-nowrap">
            Mais extras = descontos
          </span>
        )}
      </div>
    </div>
  );
}
