import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthContext } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { PLAN_FAMILIES, PLAN_INCLUDES } from '@/lib/transferPlans';

/**
 * Parse the real error message from Supabase FunctionsHttpError.
 * supabase.functions.invoke() returns a generic "Edge Function returned a non-2xx status code"
 * but the actual JSON body from the edge function is available via error.context.
 */
async function parseEdgeFunctionError(error: unknown): Promise<string> {
  if (!error || typeof error !== 'object') {
    return error instanceof Error ? error.message : 'Erro desconhecido';
  }

  const err = error as any;

  // FunctionsHttpError: the response body is in error.context (a Response object)
  if (err.context && typeof err.context === 'object' && typeof err.context.json === 'function') {
    try {
      const body = await err.context.json();
      if (body?.error) return body.error;
      if (body?.message) return body.message;
    } catch {
      // fall through
    }
  }

  // Fallback
  if (err.message && !err.message.includes('non-2xx')) return err.message;
  return 'Erro ao processar requisição. Tente novamente.';
}

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
  currentSubscriptionId?: string;
  subscriptionIdsToCancel?: string[];
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

/* ─── helpers ─── */

function getSubFamily(planType: string): string {
  return PLAN_FAMILIES[planType] ?? 'unknown';
}

function subHasTransfer(planType: string): boolean {
  return PLAN_INCLUDES[planType]?.transfer ?? false;
}

function subHasStudio(planType: string): boolean {
  return PLAN_INCLUDES[planType]?.studio ?? false;
}

export function useAsaasSubscription() {
  const { user } = useAuthContext();
  const queryClient = useQueryClient();

  // Fetch ALL active/relevant subscriptions (user can have Studio + Transfer simultaneously)
  const { data: allSubscriptions = [], isLoading } = useQuery({
    queryKey: ['asaas-subscription', user?.id],
    queryFn: async (): Promise<AsaasSubscription[]> => {
      if (!user?.id) return [];

      // Fetch ACTIVE/PENDING/OVERDUE
      const { data: activeSubs, error: activeError } = await supabase
        .from('subscriptions_asaas' as any)
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['ACTIVE', 'PENDING', 'OVERDUE'])
        .order('created_at', { ascending: false });

      if (activeError) {
        console.error('Error fetching subscriptions:', activeError);
        return [];
      }

      const results = (activeSubs as unknown as AsaasSubscription[]) || [];

      // Fallback: CANCELLED with future next_due_date (still in active period)
      const { data: cancelledSubs, error: cancelledError } = await supabase
        .from('subscriptions_asaas' as any)
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'CANCELLED')
        .gte('next_due_date', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (!cancelledError && cancelledSubs) {
        const cancelledTyped = cancelledSubs as unknown as AsaasSubscription[];
        // Only add cancelled subs whose plan_type isn't already covered by an active sub
        const activePlanTypes = new Set(results.map(s => s.plan_type));
        for (const cs of cancelledTyped) {
          if (!activePlanTypes.has(cs.plan_type)) {
            results.push(cs);
          }
        }
      }

      return results;
    },
    enabled: !!user?.id,
  });

  // Backwards-compatible: first subscription found
  const subscription = allSubscriptions.length > 0 ? allSubscriptions[0] : null;

  // Helpers by family/capability
  const getByFamily = (family: string): AsaasSubscription | undefined =>
    allSubscriptions.find(s => getSubFamily(s.plan_type) === family);

  const transferSub = allSubscriptions.find(s => subHasTransfer(s.plan_type)) ?? undefined;
  const studioSub = allSubscriptions.find(s => subHasStudio(s.plan_type)) ?? undefined;

  // ─── Mutations ───

  const createCustomerMutation = useMutation({
    mutationFn: async (params: CreateCustomerParams) => {
      const { data, error } = await supabase.functions.invoke('asaas-create-customer', {
        body: params,
      });
      if (error) {
        const msg = await parseEdgeFunctionError(error);
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);
      return data as { customerId: string };
    },
  });

  const createSubscriptionMutation = useMutation({
    mutationFn: async (params: CreateSubscriptionParams) => {
      const { data, error } = await supabase.functions.invoke('asaas-create-subscription', {
        body: params,
      });
      if (error) {
        const msg = await parseEdgeFunctionError(error);
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);
      return data as { subscriptionId: string; status: string; localId: string };
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
      if (error) {
        const msg = await parseEdgeFunctionError(error);
        throw new Error(msg);
      }
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
      if (error) {
        const msg = await parseEdgeFunctionError(error);
        throw new Error(msg);
      }
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

  const reactivateSubscriptionMutation = useMutation({
    mutationFn: async (subscriptionId: string) => {
      const { data, error } = await supabase.functions.invoke('asaas-cancel-subscription', {
        body: { subscriptionId, action: 'reactivate' },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asaas-subscription'] });
      toast.success('Assinatura reativada com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao reativar assinatura.');
    },
  });

  return {
    // Multiple subscriptions support
    subscriptions: allSubscriptions,
    subscription, // backwards compat
    transferSub,
    studioSub,
    getByFamily,
    isLoading,
    // Mutations
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
    reactivateSubscription: reactivateSubscriptionMutation.mutateAsync,
    isReactivating: reactivateSubscriptionMutation.isPending,
  };
}
