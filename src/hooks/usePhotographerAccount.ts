import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthContext } from '@/contexts/AuthContext';

export type AccountType = 'none' | 'starter' | 'pro' | 'pro_gallery';
export type AccountStatus = 'active' | 'suspended' | 'canceled';

export interface PhotographerAccount {
  id: string;
  user_id: string;
  account_type: AccountType;
  account_status: AccountStatus;
  gallery_credits: number;
  galleries_published_total: number;
  created_at: string;
  updated_at: string;
}

export interface PaymentProvider {
  provedor: string;
  status: string;
}

export interface PhotographerAccountData {
  account: PhotographerAccount | null;
  paymentProvider: PaymentProvider | null;
  hasPaymentConfigured: boolean;
  isActive: boolean;
  hasGestaoIntegration: boolean;
  credits: number;
  galleriesPublished: number;
  canPublish: boolean;
  isAdmin: boolean;
}

export function usePhotographerAccount() {
  const { user, accessLevel } = useAuthContext();
  const isAdmin = accessLevel === 'admin';

  return useQuery({
    queryKey: ['photographer-account', user?.id],
    queryFn: async (): Promise<PhotographerAccountData> => {
      if (!user) {
        return {
          account: null,
          paymentProvider: null,
          hasPaymentConfigured: false,
          isActive: false,
          hasGestaoIntegration: false,
          credits: 0,
          galleriesPublished: 0,
          canPublish: false,
          isAdmin: false,
        };
      }

      // Fetch photographer account
      const { data: account, error: accountError } = await supabase
        .from('photographer_accounts')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (accountError) {
        console.error('Error fetching photographer account:', accountError);
      }

      // Fetch payment provider integration
      const { data: paymentProvider, error: providerError } = await supabase
        .from('usuarios_integracoes')
        .select('provedor, status')
        .eq('user_id', user.id)
        .eq('status', 'ativo')
        .maybeSingle();

      if (providerError) {
        console.error('Error fetching payment provider:', providerError);
      }

      const typedAccount = account as PhotographerAccount | null;
      const typedProvider = paymentProvider as PaymentProvider | null;

      const credits = typedAccount?.gallery_credits ?? 0;
      const galleriesPublished = typedAccount?.galleries_published_total ?? 0;
      
      // Only pro_gallery has Gestão integration (or admin)
      const hasGestaoIntegration = isAdmin || typedAccount?.account_type === 'pro_gallery';
      
      // Admins can always publish, others need credits
      const canPublish = isAdmin || credits > 0;

      return {
        account: typedAccount,
        paymentProvider: typedProvider,
        hasPaymentConfigured: !!typedProvider,
        isActive: typedAccount?.account_status === 'active',
        hasGestaoIntegration,
        credits,
        galleriesPublished,
        canPublish,
        isAdmin,
      };
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Helper to get account type display name
export function getAccountTypeLabel(type: AccountType): string {
  const labels: Record<AccountType, string> = {
    none: 'Sem plano',
    starter: 'Starter',
    pro: 'Pro',
    pro_gallery: 'Pro + Gallery',
  };
  return labels[type] || type;
}

// Helper to get account status display
export function getAccountStatusLabel(status: AccountStatus): string {
  const labels: Record<AccountStatus, string> = {
    active: 'Ativo',
    suspended: 'Suspenso',
    canceled: 'Cancelado',
  };
  return labels[status] || status;
}
