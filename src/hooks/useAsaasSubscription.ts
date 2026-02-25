import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthContext } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface AsaasSubscription {
  id: string;
  user_id: string;
  asaas_customer_id: string | null;
  asaas_subscription_id: string | null;
  plan_type: string;
  billing_cycle: string;
  status: string;
  value_cents: number;
  next_due_date: string | null;
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown> | null;
  pending_downgrade_plan: string | null;
  pending_downgrade_cycle: string | null;
}

interface DowngradeSubscriptionParams {
  subscriptionId: string;
  newPlanType: string;
  newBillingCycle?: string;
}

interface CreateCustomerParams {
  name: string;
  cpfCnpj: string;
  email?: string;
}

interface CreateSubscriptionParams {
  planType: string;
  billingCycle: 'MONTHLY' | 'YEARLY';
  creditCard: {
    holderName: string;
    number: string;
    expiryMonth: string;
    expiryYear: string;
    ccv: string;
  };
  creditCardHolderInfo: {
    name: string;
    email: string;
    cpfCnpj: string;
    postalCode: string;
    addressNumber: string;
    phone: string;
  };
  remoteIp: string;
}

interface CreatePaymentParams {
  productType: 'select' | 'subscription_yearly';
  planType?: string;
  packageId?: string;
  credits?: number;
  priceCents?: number;
  installmentCount?: number;
  creditCard: {
    holderName: string;
    number: string;
    expiryMonth: string;
    expiryYear: string;
    ccv: string;
  };
  creditCardHolderInfo: {
    name: string;
    email: string;
    cpfCnpj: string;
    postalCode: string;
    addressNumber: string;
    phone: string;
  };
  remoteIp: string;
}

interface UpgradeSubscriptionParams {
  currentSubscriptionId: string;
  newPlanType: string;
  billingCycle: 'MONTHLY' | 'YEARLY';
  creditCard: {
    holderName: string;
    number: string;
    expiryMonth: string;
    expiryYear: string;
    ccv: string;
  };
  creditCardHolderInfo: {
    name: string;
    email: string;
    cpfCnpj: string;
    postalCode: string;
    addressNumber: string;
    phone: string;
  };
  remoteIp: string;
}

export function useAsaasSubscription() {
  const { user } = useAuthContext();
  const queryClient = useQueryClient();

  const { data: subscription, isLoading } = useQuery({
    queryKey: ['asaas-subscription', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('subscriptions_asaas' as any)
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['ACTIVE', 'PENDING', 'OVERDUE'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error fetching subscription:', error);
        return null;
      }
      return data as unknown as AsaasSubscription | null;
    },
    enabled: !!user?.id,
  });

  const createCustomerMutation = useMutation({
    mutationFn: async (params: CreateCustomerParams) => {
      const { data, error } = await supabase.functions.invoke('asaas-create-customer', {
        body: params,
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data as { customerId: string };
    },
  });

  const createSubscriptionMutation = useMutation({
    mutationFn: async (params: CreateSubscriptionParams) => {
      const { data, error } = await supabase.functions.invoke('asaas-create-subscription', {
        body: params,
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data as {
        subscriptionId: string;
        status: string;
        localId: string;
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asaas-subscription'] });
    },
  });

  const createPaymentMutation = useMutation({
    mutationFn: async (params: CreatePaymentParams) => {
      const { data, error } = await supabase.functions.invoke('asaas-create-payment', {
        body: params,
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data as {
        paymentId: string;
        status: string;
        productType: string;
        localId?: string;
        credits?: number;
        installmentCount?: number;
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asaas-subscription'] });
    },
  });

  const upgradeSubscriptionMutation = useMutation({
    mutationFn: async (params: UpgradeSubscriptionParams) => {
      const { data, error } = await supabase.functions.invoke('asaas-upgrade-subscription', {
        body: params,
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data as {
        newSubscriptionId: string;
        status: string;
        prorataPaymentId?: string;
        prorataValueCents: number;
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asaas-subscription'] });
      toast.success('Upgrade realizado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao realizar upgrade.');
    },
  });

  const cancelSubscriptionMutation = useMutation({
    mutationFn: async (subscriptionId: string) => {
      const { data, error } = await supabase.functions.invoke('asaas-cancel-subscription', {
        body: { subscriptionId },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asaas-subscription'] });
      toast.success('Assinatura cancelada com sucesso.');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao cancelar assinatura.');
    },
  });

  const downgradeSubscriptionMutation = useMutation({
    mutationFn: async (params: DowngradeSubscriptionParams) => {
      const { data, error } = await supabase.functions.invoke('asaas-downgrade-subscription', {
        body: params,
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data as { success: boolean; scheduledPlan: string; message: string };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['asaas-subscription'] });
      toast.success(data.message || 'Downgrade agendado com sucesso.');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao agendar downgrade.');
    },
  });

  const cancelDowngradeMutation = useMutation({
    mutationFn: async (subscriptionId: string) => {
      // Clear pending downgrade fields directly
      const { error } = await supabase
        .from('subscriptions_asaas' as any)
        .update({ pending_downgrade_plan: null, pending_downgrade_cycle: null } as any)
        .eq('id', subscriptionId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asaas-subscription'] });
      toast.success('Downgrade cancelado.');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao cancelar downgrade.');
    },
  });

  return {
    subscription,
    isLoading,
    createCustomer: createCustomerMutation.mutateAsync,
    isCreatingCustomer: createCustomerMutation.isPending,
    createSubscription: createSubscriptionMutation.mutateAsync,
    isCreatingSubscription: createSubscriptionMutation.isPending,
    createPayment: createPaymentMutation.mutateAsync,
    isCreatingPayment: createPaymentMutation.isPending,
    upgradeSubscription: upgradeSubscriptionMutation.mutateAsync,
    isUpgrading: upgradeSubscriptionMutation.isPending,
    cancelSubscription: cancelSubscriptionMutation.mutateAsync,
    isCancelling: cancelSubscriptionMutation.isPending,
    downgradeSubscription: downgradeSubscriptionMutation.mutateAsync,
    isDowngrading: downgradeSubscriptionMutation.isPending,
    cancelDowngrade: cancelDowngradeMutation.mutateAsync,
    isCancellingDowngrade: cancelDowngradeMutation.isPending,
  };
}
