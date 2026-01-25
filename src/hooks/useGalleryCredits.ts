import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthContext } from '@/contexts/AuthContext';

export interface GalleryCreditsData {
  credits: number;
  galleriesPublished: number;
  canPublish: boolean;
  isAdmin: boolean;
  isLoading: boolean;
}

export function useGalleryCredits() {
  const { user, accessLevel } = useAuthContext();
  const queryClient = useQueryClient();
  
  const isAdmin = accessLevel === 'admin';

  const { data, isLoading } = useQuery({
    queryKey: ['gallery-credits', user?.id],
    queryFn: async () => {
      if (!user) {
        return { credits: 0, galleriesPublished: 0 };
      }

      const { data: account, error } = await supabase
        .from('photographer_accounts')
        .select('gallery_credits, galleries_published_total')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching gallery credits:', error);
        return { credits: 0, galleriesPublished: 0 };
      }

      return {
        credits: account?.gallery_credits ?? 0,
        galleriesPublished: account?.galleries_published_total ?? 0,
      };
    },
    enabled: !!user,
    staleTime: 30 * 1000, // 30 seconds
  });

  // Mutation to deduct credits when publishing
  const deductCreditMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('User not authenticated');
      
      const { data, error } = await supabase.rpc('deduct_gallery_credit', {
        _user_id: user.id,
      });

      if (error) throw error;
      if (!data) throw new Error('Insufficient credits');
      
      return data;
    },
    onSuccess: () => {
      // Invalidate credits query to refresh balance
      queryClient.invalidateQueries({ queryKey: ['gallery-credits', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['photographer-account', user?.id] });
    },
  });

  // Mutation to add credits (after purchase)
  const addCreditsMutation = useMutation({
    mutationFn: async (amount: number) => {
      if (!user) throw new Error('User not authenticated');
      
      const { data, error } = await supabase.rpc('add_gallery_credits', {
        _user_id: user.id,
        _amount: amount,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery-credits', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['photographer-account', user?.id] });
    },
  });

  const credits = data?.credits ?? 0;
  const galleriesPublished = data?.galleriesPublished ?? 0;
  
  // Admins can always publish, others need credits
  const canPublish = isAdmin || credits > 0;

  return {
    credits,
    galleriesPublished,
    canPublish,
    isAdmin,
    isLoading,
    deductCredit: deductCreditMutation.mutateAsync,
    addCredits: addCreditsMutation.mutateAsync,
    isDeducting: deductCreditMutation.isPending,
    isAddingCredits: addCreditsMutation.isPending,
  };
}
