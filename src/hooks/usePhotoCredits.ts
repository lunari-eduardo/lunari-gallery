import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthContext } from '@/contexts/AuthContext';

export interface PhotoCreditsData {
  photoCredits: number;
  isAdmin: boolean;
  canUpload: (photoCount: number) => boolean;
}

export interface CreditLedgerEntry {
  id: string;
  operation_type: 'purchase' | 'bonus' | 'upload' | 'refund' | 'adjustment';
  amount: number;
  gallery_id: string | null;
  photo_id: string | null;
  description: string | null;
  created_at: string;
}

export function usePhotoCredits() {
  const { user, accessLevel } = useAuthContext();
  const queryClient = useQueryClient();
  
  const isAdmin = accessLevel === 'admin';

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['photo-credits', user?.id],
    queryFn: async () => {
      if (!user) {
        return { photoCredits: 0 };
      }

      const { data: balance, error } = await supabase.rpc('get_photo_credit_balance', {
        _user_id: user.id,
      });

      if (error) {
        console.error('Error fetching photo credits:', error);
        return { photoCredits: 0 };
      }

      return {
        photoCredits: balance ?? 0,
      };
    },
    enabled: !!user,
    staleTime: 10 * 1000, // 10 seconds - credits change frequently during uploads
  });

  // Fetch credit history
  const { data: history, isLoading: isLoadingHistory } = useQuery({
    queryKey: ['credit-history', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('credit_ledger')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching credit history:', error);
        return [];
      }

      return data as CreditLedgerEntry[];
    },
    enabled: !!user,
    staleTime: 30 * 1000,
  });

  // Check if user can upload N photos
  const canUpload = (photoCount: number): boolean => {
    if (isAdmin) return true;
    return (data?.photoCredits ?? 0) >= photoCount;
  };

  // Mutation to consume credits (called by edge function, but we can also check client-side)
  const consumeCreditsMutation = useMutation({
    mutationFn: async (photoCount: number) => {
      if (!user) throw new Error('User not authenticated');
      if (isAdmin) return true;
      
      const { data, error } = await supabase.rpc('consume_photo_credits', {
        _user_id: user.id,
        _gallery_id: null,
        _photo_count: photoCount,
      });

      if (error) throw error;
      if (!data) throw new Error('Créditos insuficientes');
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['photo-credits', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['credit-history', user?.id] });
    },
  });

  const photoCredits = data?.photoCredits ?? 0;

  return {
    photoCredits,
    isAdmin,
    isLoading,
    canUpload,
    history,
    isLoadingHistory,
    refetch,
    consumeCredits: consumeCreditsMutation.mutateAsync,
    isConsuming: consumeCreditsMutation.isPending,
  };
}
