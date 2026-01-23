import { useSearchParams } from 'react-router-dom';
import { useMemo } from 'react';
import { SaleMode, PricingModel } from '@/types/gallery';

/**
 * Parameters received from the Gestão system via URL query params
 * Used for assisted gallery creation when coming from the management system
 */
export interface GestaoSessionParams {
  session_id?: string;
  cliente_id?: string;
  cliente_nome?: string;
  cliente_email?: string;
  cliente_telefone?: string;
  pacote_categoria?: string;  // Maps to session name
  pacote_nome?: string;       // Maps to package name
  fotos_incluidas_no_pacote?: number;
  preco_da_foto_extra?: number;
  modelo_de_cobranca?: SaleMode;     // 'no_sale' | 'sale_with_payment' | 'sale_without_payment'
  modelo_de_preco?: PricingModel;    // 'fixed' | 'packages'
}

interface UseGestaoParamsResult {
  gestaoParams: GestaoSessionParams;
  hasGestaoParams: boolean;
  isAssistedMode: boolean;
  clearParams: () => void;
}

/**
 * Hook to read and validate query params from Gestão system
 * Detects if gallery creation is in "assisted mode" (coming from Gestão)
 */
export function useGestaoParams(): UseGestaoParamsResult {
  const [searchParams, setSearchParams] = useSearchParams();

  const gestaoParams = useMemo<GestaoSessionParams>(() => {
    const sessionId = searchParams.get('session_id') || undefined;
    const fotosIncluidas = searchParams.get('fotos_incluidas_no_pacote');
    const precoFotoExtra = searchParams.get('preco_da_foto_extra');
    const modeloCobranca = searchParams.get('modelo_de_cobranca') as SaleMode | null;
    const modeloPreco = searchParams.get('modelo_de_preco') as PricingModel | null;

    return {
      session_id: sessionId,
      cliente_id: searchParams.get('cliente_id') || undefined,
      cliente_nome: searchParams.get('cliente_nome') || undefined,
      cliente_email: searchParams.get('cliente_email') || undefined,
      cliente_telefone: searchParams.get('cliente_telefone') || undefined,
      pacote_categoria: searchParams.get('pacote_categoria') || undefined,
      pacote_nome: searchParams.get('pacote_nome') || undefined,
      fotos_incluidas_no_pacote: fotosIncluidas ? parseInt(fotosIncluidas, 10) : undefined,
      preco_da_foto_extra: precoFotoExtra ? parseFloat(precoFotoExtra) : undefined,
      modelo_de_cobranca: modeloCobranca && ['no_sale', 'sale_with_payment', 'sale_without_payment'].includes(modeloCobranca) 
        ? modeloCobranca 
        : undefined,
      modelo_de_preco: modeloPreco && ['fixed', 'packages'].includes(modeloPreco) 
        ? modeloPreco 
        : undefined,
    };
  }, [searchParams]);

  // Assisted mode is determined by the presence of session_id
  const hasGestaoParams = !!gestaoParams.session_id;

  const clearParams = () => {
    setSearchParams({});
  };

  return {
    gestaoParams,
    hasGestaoParams,
    isAssistedMode: hasGestaoParams,
    clearParams,
  };
}
