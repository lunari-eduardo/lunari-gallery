import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthContext } from '@/contexts/AuthContext';

export interface ReferralItem {
  id: string;
  referred_user_id: string;
  referred_name: string | null;
  created_at: string;
  select_bonus_granted: boolean;
  transfer_bonus_active: boolean;
  transfer_bonus_bytes: number;
}

export function useReferrals() {
  const { user } = useAuthContext();

  // Ensure referral code exists
  const { data: referralCode, isLoading: isLoadingCode } = useQuery({
    queryKey: ['referral-code', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase.rpc('ensure_referral_code' as any);
      if (error) {
        console.error('Error ensuring referral code:', error);
        return null;
      }
      return data as string;
    },
    enabled: !!user?.id,
  });

  // Fetch referrals where current user is the referrer
  const { data: referrals = [], isLoading: isLoadingReferrals } = useQuery({
    queryKey: ['referrals', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('referrals' as any)
        .select('id, referred_user_id, created_at, select_bonus_granted, transfer_bonus_active, transfer_bonus_bytes')
        .eq('referrer_user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching referrals:', error);
        return [];
      }

      const items = (data as unknown as any[]) || [];
      
      // Fetch names from profiles for referred users
      if (items.length > 0) {
        const userIds = items.map(r => r.referred_user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, nome')
          .in('user_id', userIds);
        
        const nameMap = new Map((profiles || []).map(p => [p.user_id, p.nome]));
        
        return items.map(r => ({
          ...r,
          referred_name: nameMap.get(r.referred_user_id) || null,
        })) as ReferralItem[];
      }
      
      return items as ReferralItem[];
    },
    enabled: !!user?.id,
  });

  // Fetch storage bonus from photographer_accounts
  const { data: storageBonusBytes = 0, isLoading: isLoadingBonus } = useQuery({
    queryKey: ['referral-storage-bonus', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { data, error } = await supabase
        .from('photographer_accounts' as any)
        .select('storage_bonus_bytes')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) {
        console.error('Error fetching storage bonus:', error);
        return 0;
      }
      return ((data as any)?.storage_bonus_bytes as number) || 0;
    },
    enabled: !!user?.id,
  });

  const totalReferrals = referrals.length;
  const selectBonusCount = referrals.filter(r => r.select_bonus_granted).length;
  const creditsEarned = selectBonusCount * 1000;
  const activeTransferReferrals = referrals.filter(r => r.transfer_bonus_active).length;

  const referralLink = referralCode
    ? `${window.location.origin}/auth?ref=${referralCode}`
    : null;

  return {
    referralCode,
    referralLink,
    referrals,
    totalReferrals,
    creditsEarned,
    storageBonusBytes,
    activeTransferReferrals,
    isLoading: isLoadingCode || isLoadingReferrals || isLoadingBonus,
  };
}
