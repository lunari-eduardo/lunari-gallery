import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CreditPackage {
  id: string;
  credits: number;
  price_cents: number;
  name: string;
  description: string | null;
  active: boolean;
  sort_order: number;
}

export interface CreditPurchase {
  id: string;
  user_id: string;
  package_id: string;
  credits_amount: number;
  price_cents: number;
  payment_method: 'pix' | 'credit_card';
  mp_payment_id: string | null;
  mp_status: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'refunded';
  pix_qr_code: string | null;
  pix_qr_code_base64: string | null;
  pix_copia_cola: string | null;
  pix_expiration: string | null;
  created_at: string;
  paid_at: string | null;
}

export interface CreatePaymentResponse {
  success: boolean;
  purchase_id: string;
  mp_payment_id: number;
  status: string;
  status_detail: string;
  credits: number;
  amount: number;
  pix?: {
    qr_code: string;
    qr_code_base64: string;
    expiration: string;
  };
  error?: string;
  details?: string;
}

export interface CheckPaymentResponse {
  success: boolean;
  status: string;
  mp_status?: string;
  mp_status_detail?: string;
  credits?: number;
  paid_at?: string;
  ledger_id?: string;
  message?: string;
}

export function useCreditPackages() {
  const queryClient = useQueryClient();

  // Buscar pacotes disponíveis
  const { data: packages, isLoading: isLoadingPackages } = useQuery({
    queryKey: ['credit-packages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gallery_credit_packages')
        .select('*')
        .eq('active', true)
        .order('sort_order');

      if (error) throw error;
      return data as CreditPackage[];
    },
  });

  // Buscar compras do usuário
  const { data: purchases, isLoading: isLoadingPurchases } = useQuery({
    queryKey: ['credit-purchases'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('credit_purchases')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data as CreditPurchase[];
    },
  });

  // Criar pagamento
  const createPaymentMutation = useMutation({
    mutationFn: async ({
      packageId,
      paymentMethod,
      cardToken,
      payerEmail,
    }: {
      packageId: string;
      paymentMethod: 'pix' | 'credit_card';
      cardToken?: string;
      payerEmail: string;
    }): Promise<CreatePaymentResponse> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || 'https://tlnjspsywycbudhewsfv.supabase.co'}/functions/v1/mercadopago-credits-payment`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            package_id: packageId,
            payment_method: paymentMethod,
            card_token: cardToken,
            payer_email: payerEmail,
          }),
        }
      );

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || result.details || 'Erro ao criar pagamento');
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit-purchases'] });
    },
  });

  // Verificar status do pagamento (polling)
  const checkPaymentMutation = useMutation({
    mutationFn: async (purchaseId: string): Promise<CheckPaymentResponse> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || 'https://tlnjspsywycbudhewsfv.supabase.co'}/functions/v1/mercadopago-check-payment`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ purchase_id: purchaseId }),
        }
      );

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Erro ao verificar pagamento');
      }

      return result;
    },
    onSuccess: (data) => {
      if (data.status === 'approved') {
        queryClient.invalidateQueries({ queryKey: ['credit-purchases'] });
        queryClient.invalidateQueries({ queryKey: ['photo-credits'] });
      }
    },
  });

  return {
    packages,
    purchases,
    isLoadingPackages,
    isLoadingPurchases,
    createPayment: createPaymentMutation.mutateAsync,
    isCreatingPayment: createPaymentMutation.isPending,
    checkPayment: checkPaymentMutation.mutateAsync,
    isCheckingPayment: checkPaymentMutation.isPending,
  };
}
