import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthContext } from '@/contexts/AuthContext';

export interface PhotoCreditsData {
  photoCredits: number;
  creditsPurchased: number;
  creditsSubscription: number;
  isAdmin: boolean;
  canUpload: (photoCount: number) => boolean;
}

export function usePhotoCredits() {
  const { user, accessLevel } = useAuthContext();
  
  const isAdmin = accessLevel === 'admin';

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['photo-credits', user?.id],
    queryFn: async () => {
      if (!user) {
        return { photoCredits: 0, creditsPurchased: 0, creditsSubscription: 0 };
      }

      const { data: account, error } = await supabase
        .from('photographer_accounts')
        .select('photo_credits, credits_subscription')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Error fetching photo credits:', error);
        return { photoCredits: 0, creditsPurchased: 0, creditsSubscription: 0 };
      }

      const purchased = account?.photo_credits ?? 0;
      const subscription = (account as any)?.credits_subscription ?? 0;

      return {
        photoCredits: purchased + subscription,
        creditsPurchased: purchased,
        creditsSubscription: subscription,
      };
    },
    enabled: !!user,
    staleTime: 10 * 1000,
  });

  const canUpload = (photoCount: number): boolean => {
    if (isAdmin) return true;
    return (data?.photoCredits ?? 0) >= photoCount;
  };

  const photoCredits = data?.photoCredits ?? 0;
  const creditsPurchased = data?.creditsPurchased ?? 0;
  const creditsSubscription = data?.creditsSubscription ?? 0;

  return {
    photoCredits,
    creditsPurchased,
    creditsSubscription,
    isAdmin,
    isLoading,
    canUpload,
    refetch,
  };
}
