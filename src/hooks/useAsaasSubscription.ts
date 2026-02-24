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

  return {
    subscription,
    isLoading,
    createCustomer: createCustomerMutation.mutateAsync,
    isCreatingCustomer: createCustomerMutation.isPending,
    createSubscription: createSubscriptionMutation.mutateAsync,
    isCreatingSubscription: createSubscriptionMutation.isPending,
    createPayment: createPaymentMutation.mutateAsync,
    isCreatingPayment: createPaymentMutation.isPending,
    cancelSubscription: cancelSubscriptionMutation.mutateAsync,
    isCancelling: cancelSubscriptionMutation.isPending,
  };
}
