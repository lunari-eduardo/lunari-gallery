import { SaleSettings } from '@/types/gallery';

// Função para calcular preço baseado nas configurações de venda
// Esta função permanece como utilitário pois é usada em outros lugares
export function calculatePhotoPrice(
  selectedCount: number,
  includedPhotos: number,
  saleSettings: SaleSettings
): { chargeableCount: number; total: number; pricePerPhoto: number } {
  if (saleSettings.mode === 'no_sale') {
    return { chargeableCount: 0, total: 0, pricePerPhoto: 0 };
  }

  // Determinar fotos cobráveis
  const chargeableCount = saleSettings.chargeType === 'only_extras'
    ? Math.max(0, selectedCount - includedPhotos)
    : selectedCount;

  if (chargeableCount === 0) {
    return { chargeableCount: 0, total: 0, pricePerPhoto: saleSettings.fixedPrice };
  }

  // Calcular preço por foto (fixo ou pacote)
  if (saleSettings.pricingModel === 'fixed') {
    return {
      chargeableCount,
      total: chargeableCount * saleSettings.fixedPrice,
      pricePerPhoto: saleSettings.fixedPrice,
    };
  }

  // Encontrar pacote aplicável (null = infinito)
  const sortedPackages = [...saleSettings.discountPackages].sort((a, b) => b.minPhotos - a.minPhotos);
  const applicablePackage = sortedPackages.find(pkg => {
    const inMin = chargeableCount >= pkg.minPhotos;
    const inMax = pkg.maxPhotos === null || chargeableCount <= pkg.maxPhotos;
    return inMin && inMax;
  });

  const pricePerPhoto = applicablePackage?.pricePerPhoto || saleSettings.fixedPrice;

  return {
    chargeableCount,
    total: chargeableCount * pricePerPhoto,
    pricePerPhoto,
  };
}

// LocalStorage galleries removed - system now uses only Supabase
// The useGalleries hook is deprecated, use useSupabaseGalleries instead
