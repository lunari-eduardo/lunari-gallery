import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthContext } from '@/contexts/AuthContext';
import { getStorageLimitBytes, getPlanDisplayName, hasTransferStorage, FREE_TRANSFER_BYTES } from '@/lib/transferPlans';
import { differenceInDays } from 'date-fns';

export function useTransferStorage() {
  const { user, isAdmin } = useAuthContext();

  // Fetch active subscription with transfer storage (user may have multiple subs)
  const { data: subscription, isLoading: isLoadingSub } = useQuery({
    queryKey: ['transfer-subscription', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      // Fetch ALL ACTIVE/PENDING/OVERDUE subscriptions
      const { data: activeSubs, error: activeError } = await supabase
        .from('subscriptions_asaas' as any)
        .select('plan_type, status')
        .eq('user_id', user.id)
        .in('status', ['ACTIVE', 'PENDING', 'OVERDUE'])
        .order('created_at', { ascending: false });
      if (activeError) {
        console.error('Error fetching transfer subscription:', activeError);
        return null;
      }
      const activeCasted = (activeSubs as unknown as { plan_type: string; status: string }[]) || [];
      // Find the one that has transfer storage
      const transferSub = activeCasted.find(s => hasTransferStorage(s.plan_type));
      if (transferSub) return transferSub;

      // Fallback: CANCELLED with future next_due_date (still in active period)
      const { data: cancelledSubs, error: cancelledError } = await supabase
        .from('subscriptions_asaas' as any)
        .select('plan_type, status')
        .eq('user_id', user.id)
        .eq('status', 'CANCELLED')
        .gte('next_due_date', new Date().toISOString())
        .order('created_at', { ascending: false });
      if (cancelledError) {
        console.error('Error fetching cancelled subscription:', cancelledError);
        return null;
      }
      const cancelledCasted = (cancelledSubs as unknown as { plan_type: string; status: string }[]) || [];
      return cancelledCasted.find(s => hasTransferStorage(s.plan_type)) || null;
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

  // Fetch over-limit data + free_transfer_bytes from photographer_accounts
  const { data: accountData, isLoading: isLoadingAccount } = useQuery({
    queryKey: ['transfer-account-data', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('photographer_accounts' as any)
        .select('account_over_limit, over_limit_since, deletion_scheduled_at, free_transfer_bytes')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) {
        console.error('Error fetching account data:', error);
        return null;
      }
      return data as unknown as {
        account_over_limit: boolean;
        over_limit_since: string | null;
        deletion_scheduled_at: string | null;
        free_transfer_bytes: number;
      } | null;
    },
    enabled: !!user?.id,
  });

  const planType = subscription?.plan_type ?? null;
  const planStorageBytes = getStorageLimitBytes(planType);
  const freeBytes = accountData?.free_transfer_bytes ?? FREE_TRANSFER_BYTES;
  // Effective limit = plan limit + free bytes (free always applies)
  const storageLimitBytes = planStorageBytes > 0 ? planStorageBytes + freeBytes : freeBytes;
  const hasTransferPlan = hasTransferStorage(planType);
  const planName = getPlanDisplayName(planType);
  // Users can always use free storage even without a plan
  const hasFreeStorageOnly = !hasTransferPlan && freeBytes > 0;

  const storageUsedPercent = storageLimitBytes > 0
    ? Math.min(100, Math.round((storageUsedBytes / storageLimitBytes) * 100))
    : 0;

  // Allow transfer creation if: admin, has paid plan with room, OR has free storage with room
  const canCreateTransfer = isAdmin || (storageUsedBytes < storageLimitBytes);

  const isOverLimit = accountData?.account_over_limit ?? false;
  const deletionScheduledAt = accountData?.deletion_scheduled_at ?? null;
  const daysUntilDeletion = deletionScheduledAt
    ? Math.max(0, differenceInDays(new Date(deletionScheduledAt), new Date()))
    : null;

  return {
    storageUsedBytes,
    storageLimitBytes,
    storageUsedPercent,
    hasTransferPlan,
    hasFreeStorageOnly,
    planName,
    canCreateTransfer: canCreateTransfer && !isOverLimit,
    isAdmin,
    isLoading: isLoadingSub || isLoadingStorage || isLoadingAccount,
    isOverLimit,
    deletionScheduledAt,
    daysUntilDeletion,
    freeTransferBytes: freeBytes,
  };
}
