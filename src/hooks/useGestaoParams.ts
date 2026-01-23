import { useSearchParams } from 'react-router-dom';
import { useMemo, useCallback, useState, useRef } from 'react';
import { SaleMode, PricingModel, GestaoSessionParams } from '@/types/gallery';

interface UseGestaoParamsResult {
  gestaoParams: GestaoSessionParams;
  hasGestaoParams: boolean;
  isAssistedMode: boolean;
  paramsProcessed: boolean;
  markAsProcessed: () => void;
  clearParams: () => void;
}

/**
 * Hook to read and validate query params from Gestão system
 * Detects if gallery creation is in "assisted mode" (coming from Gestão)
 * 
 * Key features:
 * - Persists initial params even after URL is cleared
 * - Tracks if params have been processed to prevent re-application
 * - Clears URL without adding to browser history
 */
export function useGestaoParams(): UseGestaoParamsResult {
  const [searchParams, setSearchParams] = useSearchParams();
  const [paramsProcessed, setParamsProcessed] = useState(false);
  
  // Store the initial params to persist after URL clear
  const initialParamsRef = useRef<GestaoSessionParams | null>(null);

  const gestaoParams = useMemo<GestaoSessionParams>(() => {
    // If we already captured params, return them even after URL is cleared
    if (initialParamsRef.current) {
      return initialParamsRef.current;
    }
    
    const sessionId = searchParams.get('session_id') || undefined;
    
    // If no session_id, return empty params
    if (!sessionId) {
      return {};
    }
    
    const fotosIncluidas = searchParams.get('fotos_incluidas_no_pacote');
    const precoFotoExtra = searchParams.get('preco_da_foto_extra');
    const modeloCobranca = searchParams.get('modelo_de_cobranca') as SaleMode | null;
    const modeloPreco = searchParams.get('modelo_de_preco') as PricingModel | null;

    // Validate sale mode
    const validSaleModes: SaleMode[] = ['no_sale', 'sale_with_payment', 'sale_without_payment'];
    const saleMode = modeloCobranca && validSaleModes.includes(modeloCobranca) ? modeloCobranca : undefined;
    
    // Validate pricing model
    const validPricingModels: PricingModel[] = ['fixed', 'packages'];
    const pricingModel = modeloPreco && validPricingModels.includes(modeloPreco) ? modeloPreco : undefined;

    const params: GestaoSessionParams = {
      session_id: sessionId,
      cliente_id: searchParams.get('cliente_id') || undefined,
      cliente_nome: searchParams.get('cliente_nome') || undefined,
      cliente_email: searchParams.get('cliente_email') || undefined,
      cliente_telefone: searchParams.get('cliente_telefone') || undefined,
      pacote_categoria: searchParams.get('pacote_categoria') || undefined,
      pacote_nome: searchParams.get('pacote_nome') || undefined,
      fotos_incluidas_no_pacote: fotosIncluidas 
        ? Math.max(0, Math.min(9999, parseInt(fotosIncluidas, 10))) 
        : undefined,
      preco_da_foto_extra: precoFotoExtra 
        ? Math.max(0, parseFloat(precoFotoExtra)) 
        : undefined,
      modelo_de_cobranca: saleMode,
      modelo_de_preco: pricingModel,
    };
    
    // Store in ref to persist after URL clear
    initialParamsRef.current = params;
    
    return params;
  }, [searchParams]);

  // Assisted mode is determined by the presence of session_id
  const hasGestaoParams = !!gestaoParams.session_id;

  // Clear URL params without adding to browser history
  const clearParams = useCallback(() => {
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);

  // Mark params as processed to prevent re-application
  const markAsProcessed = useCallback(() => {
    setParamsProcessed(true);
  }, []);

  return {
    gestaoParams,
    hasGestaoParams,
    isAssistedMode: hasGestaoParams,
    paramsProcessed,
    markAsProcessed,
    clearParams,
  };
}
