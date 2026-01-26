import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthContext } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';

export type PaymentProvider = 'pix_manual' | 'infinitepay' | 'mercadopago';
export type PixKeyType = 'cpf' | 'email' | 'telefone' | 'aleatoria';

export interface PixManualData {
  chavePix: string;
  tipoChave: PixKeyType;
  nomeTitular: string;
}

export interface InfinitePayData {
  handle: string;
}

export interface PaymentIntegration {
  id: string;
  provedor: PaymentProvider;
  status: 'ativo' | 'inativo';
  dadosExtras: PixManualData | InfinitePayData | null;
  conectadoEm: string | null;
}

export interface PaymentIntegrationData {
  activeIntegration: PaymentIntegration | null;
  allIntegrations: PaymentIntegration[];
  hasPayment: boolean;
  isPixManual: boolean;
  isInfinitePay: boolean;
  isMercadoPago: boolean;
}

// Helper to convert to JSON-compatible format
function toJsonData(data: PixManualData | InfinitePayData): Json {
  return JSON.parse(JSON.stringify(data)) as Json;
}

export function usePaymentIntegration() {
  const { user } = useAuthContext();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['payment-integration', user?.id],
    queryFn: async (): Promise<PaymentIntegrationData> => {
      if (!user) {
        return {
          activeIntegration: null,
          allIntegrations: [],
          hasPayment: false,
          isPixManual: false,
          isInfinitePay: false,
          isMercadoPago: false,
        };
      }

      // Fetch all payment integrations for the user
      const { data: integrations, error } = await supabase
        .from('usuarios_integracoes')
        .select('id, provedor, status, dados_extras, conectado_em')
        .eq('user_id', user.id)
        .in('provedor', ['pix_manual', 'infinitepay', 'mercadopago'])
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching payment integrations:', error);
        throw error;
      }

      const mappedIntegrations: PaymentIntegration[] = (integrations || []).map((i) => {
        const extras = i.dados_extras;
        return {
          id: i.id,
          provedor: i.provedor as PaymentProvider,
          status: i.status as 'ativo' | 'inativo',
          dadosExtras: extras as unknown as PixManualData | InfinitePayData | null,
          conectadoEm: i.conectado_em,
        };
      });

      const activeIntegration = mappedIntegrations.find((i) => i.status === 'ativo') || null;

      return {
        activeIntegration,
        allIntegrations: mappedIntegrations,
        hasPayment: !!activeIntegration,
        isPixManual: activeIntegration?.provedor === 'pix_manual',
        isInfinitePay: activeIntegration?.provedor === 'infinitepay',
        isMercadoPago: activeIntegration?.provedor === 'mercadopago',
      };
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Mutation to save PIX Manual configuration
  const savePixManual = useMutation({
    mutationFn: async (data: PixManualData) => {
      if (!user) throw new Error('User not authenticated');

      // First, deactivate all other payment integrations
      await supabase
        .from('usuarios_integracoes')
        .update({ status: 'inativo' })
        .eq('user_id', user.id)
        .in('provedor', ['pix_manual', 'infinitepay', 'mercadopago']);

      // Check if PIX manual already exists for this user
      const { data: existing } = await supabase
        .from('usuarios_integracoes')
        .select('id')
        .eq('user_id', user.id)
        .eq('provedor', 'pix_manual')
        .maybeSingle();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('usuarios_integracoes')
          .update({
            status: 'ativo',
            dados_extras: toJsonData(data),
            conectado_em: new Date().toISOString(),
          })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('usuarios_integracoes')
          .insert([{
            user_id: user.id,
            provedor: 'pix_manual',
            status: 'ativo',
            dados_extras: toJsonData(data),
            conectado_em: new Date().toISOString(),
          }]);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-integration'] });
      queryClient.invalidateQueries({ queryKey: ['photographer-account'] });
      toast.success('Chave PIX configurada com sucesso!');
    },
    onError: (error) => {
      console.error('Error saving PIX manual:', error);
      toast.error('Erro ao salvar configuração PIX');
    },
  });

  // Mutation to save InfinitePay configuration
  const saveInfinitePay = useMutation({
    mutationFn: async (data: InfinitePayData) => {
      if (!user) throw new Error('User not authenticated');

      // Deactivate all other payment integrations
      await supabase
        .from('usuarios_integracoes')
        .update({ status: 'inativo' })
        .eq('user_id', user.id)
        .in('provedor', ['pix_manual', 'infinitepay', 'mercadopago']);

      // Check if InfinitePay already exists for this user
      const { data: existing } = await supabase
        .from('usuarios_integracoes')
        .select('id')
        .eq('user_id', user.id)
        .eq('provedor', 'infinitepay')
        .maybeSingle();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('usuarios_integracoes')
          .update({
            status: 'ativo',
            dados_extras: toJsonData(data),
            conectado_em: new Date().toISOString(),
          })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('usuarios_integracoes')
          .insert([{
            user_id: user.id,
            provedor: 'infinitepay',
            status: 'ativo',
            dados_extras: toJsonData(data),
            conectado_em: new Date().toISOString(),
          }]);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-integration'] });
      queryClient.invalidateQueries({ queryKey: ['photographer-account'] });
      toast.success('InfinitePay configurado com sucesso!');
    },
    onError: (error) => {
      console.error('Error saving InfinitePay:', error);
      toast.error('Erro ao salvar configuração InfinitePay');
    },
  });

  // Mutation to deactivate all payment methods
  const deactivateAll = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('usuarios_integracoes')
        .update({ status: 'inativo' })
        .eq('user_id', user.id)
        .in('provedor', ['pix_manual', 'infinitepay', 'mercadopago']);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-integration'] });
      queryClient.invalidateQueries({ queryKey: ['photographer-account'] });
      toast.success('Método de pagamento desativado');
    },
    onError: (error) => {
      console.error('Error deactivating payment:', error);
      toast.error('Erro ao desativar método de pagamento');
    },
  });

  return {
    ...query,
    savePixManual,
    saveInfinitePay,
    deactivateAll,
  };
}

// Helper to get payment provider display name
export function getProviderLabel(provider: PaymentProvider): string {
  const labels: Record<PaymentProvider, string> = {
    pix_manual: 'PIX Manual',
    infinitepay: 'InfinitePay',
    mercadopago: 'Mercado Pago',
  };
  return labels[provider] || provider;
}

// Helper to get PIX key type label
export function getPixKeyTypeLabel(type: PixKeyType): string {
  const labels: Record<PixKeyType, string> = {
    cpf: 'CPF',
    email: 'E-mail',
    telefone: 'Telefone',
    aleatoria: 'Chave Aleatória',
  };
  return labels[type] || type;
}
