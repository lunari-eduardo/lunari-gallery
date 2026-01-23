import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useGalleryAccess } from '@/hooks/useGalleryAccess';

export interface GestaoPackage {
  id: string;
  nome: string;
  categoria?: string;
  fotosIncluidas?: number;
  valorFotoExtra?: number;
}

interface UseGestaoPackagesResult {
  packages: GestaoPackage[];
  isLoading: boolean;
  hasGestaoIntegration: boolean;
}

/**
 * Hook to fetch packages from the Gestão system
 * Only available for PRO + Gallery users
 */
export function useGestaoPackages(): UseGestaoPackagesResult {
  const { user } = useAuth();
  const { hasGestaoIntegration } = useGalleryAccess(user);

  const { data: packages = [], isLoading } = useQuery({
    queryKey: ['gestao-pacotes', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('pacotes')
        .select('id, nome, categoria_id, fotos_incluidas, valor_foto_extra')
        .eq('user_id', user.id)
        .order('nome');

      if (error) {
        console.error('Error fetching packages:', error);
        return [];
      }

      return data.map((pkg): GestaoPackage => ({
        id: pkg.id,
        nome: pkg.nome,
        fotosIncluidas: pkg.fotos_incluidas || undefined,
        valorFotoExtra: pkg.valor_foto_extra || undefined,
      }));
    },
    enabled: !!user && hasGestaoIntegration,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
  });

  return {
    packages,
    isLoading,
    hasGestaoIntegration,
  };
}
