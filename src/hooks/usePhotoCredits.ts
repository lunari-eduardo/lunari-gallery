import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthContext } from '@/contexts/AuthContext';

export interface PhotoCreditsData {
  photoCredits: number;
  isAdmin: boolean;
  canUpload: (photoCount: number) => boolean;
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

  // Check if user can upload N photos
  const canUpload = (photoCount: number): boolean => {
    if (isAdmin) return true;
    return (data?.photoCredits ?? 0) >= photoCount;
  };

  const photoCredits = data?.photoCredits ?? 0;

  return {
    photoCredits,
    isAdmin,
    isLoading,
    canUpload,
    refetch,
  };
}
