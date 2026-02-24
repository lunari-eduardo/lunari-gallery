import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthContext } from '@/contexts/AuthContext';
import { getStorageLimitBytes, getPlanDisplayName, hasTransferStorage } from '@/lib/transferPlans';

export function useTransferStorage() {
  const { user, isAdmin } = useAuthContext();

  // Fetch active subscription plan_type
  const { data: subscription, isLoading: isLoadingSub } = useQuery({
    queryKey: ['transfer-subscription', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('subscriptions_asaas' as any)
        .select('plan_type, status')
        .eq('user_id', user.id)
        .in('status', ['ACTIVE', 'PENDING', 'OVERDUE'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) {
        console.error('Error fetching transfer subscription:', error);
        return null;
      }
      return data as unknown as { plan_type: string; status: string } | null;
    },
    enabled: !!user?.id,
  });

  // Fetch storage used via RPC
  const { data: storageUsedBytes = 0, isLoading: isLoadingStorage } = useQuery({
    queryKey: ['transfer-storage-bytes', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { data, error } = await supabase.rpc('get_transfer_storage_bytes' as any, {
        _user_id: user.id,
      });
      if (error) {
        console.error('Error fetching transfer storage:', error);
        return 0;
      }
      return (data as number) || 0;
    },
    enabled: !!user?.id,
  });

  const planType = subscription?.plan_type ?? null;
  const storageLimitBytes = getStorageLimitBytes(planType);
  const hasTransferPlan = hasTransferStorage(planType);
  const planName = getPlanDisplayName(planType);

  const storageUsedPercent = storageLimitBytes > 0
    ? Math.min(100, Math.round((storageUsedBytes / storageLimitBytes) * 100))
    : 0;

  const canCreateTransfer = isAdmin || (hasTransferPlan && storageUsedBytes < storageLimitBytes);

  return {
    storageUsedBytes,
    storageLimitBytes,
    storageUsedPercent,
    hasTransferPlan,
    planName,
    canCreateTransfer,
    isAdmin,
    isLoading: isLoadingSub || isLoadingStorage,
  };
}
