import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthContext } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';

export type PaymentProvider = 'pix_manual' | 'infinitepay' | 'mercadopago';
export type PixKeyType = 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria';

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
  isDefault: boolean;
  dadosExtras: PixManualData | InfinitePayData | null;
  conectadoEm: string | null;
}

export interface PaymentIntegrationData {
  defaultIntegration: PaymentIntegration | null;
  allActiveIntegrations: PaymentIntegration[];
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
          defaultIntegration: null,
          allActiveIntegrations: [],
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
        .select('id, provedor, status, dados_extras, conectado_em, is_default')
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
          isDefault: i.is_default || false,
          dadosExtras: extras as unknown as PixManualData | InfinitePayData | null,
          conectadoEm: i.conectado_em,
        };
      });

      const activeIntegrations = mappedIntegrations.filter((i) => i.status === 'ativo');
      const defaultIntegration = activeIntegrations.find((i) => i.isDefault) || activeIntegrations[0] || null;

      return {
        defaultIntegration,
        allActiveIntegrations: activeIntegrations,
        allIntegrations: mappedIntegrations,
        hasPayment: activeIntegrations.length > 0,
        isPixManual: activeIntegrations.some((i) => i.provedor === 'pix_manual'),
        isInfinitePay: activeIntegrations.some((i) => i.provedor === 'infinitepay'),
        isMercadoPago: activeIntegrations.some((i) => i.provedor === 'mercadopago'),
      };
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Mutation to save PIX Manual configuration
  const savePixManual = useMutation({
    mutationFn: async (data: PixManualData & { setAsDefault?: boolean }) => {
      if (!user) throw new Error('User not authenticated');

      const { setAsDefault = true, ...pixData } = data;

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
            dados_extras: toJsonData(pixData),
            is_default: setAsDefault,
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
            dados_extras: toJsonData(pixData),
            is_default: setAsDefault,
            conectado_em: new Date().toISOString(),
          }]);

        if (error) throw error;
      }

      // If setting as default, remove default from others
      if (setAsDefault) {
        await supabase
          .from('usuarios_integracoes')
          .update({ is_default: false })
          .eq('user_id', user.id)
          .neq('provedor', 'pix_manual')
          .in('provedor', ['infinitepay', 'mercadopago']);
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
    mutationFn: async (data: InfinitePayData & { setAsDefault?: boolean }) => {
      if (!user) throw new Error('User not authenticated');

      const { setAsDefault = true, ...ipData } = data;

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
            dados_extras: toJsonData(ipData),
            is_default: setAsDefault,
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
            dados_extras: toJsonData(ipData),
            is_default: setAsDefault,
            conectado_em: new Date().toISOString(),
          }]);

        if (error) throw error;
      }

      // If setting as default, remove default from others
      if (setAsDefault) {
        await supabase
          .from('usuarios_integracoes')
          .update({ is_default: false })
          .eq('user_id', user.id)
          .neq('provedor', 'infinitepay')
          .in('provedor', ['pix_manual', 'mercadopago']);
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

  // Mutation to set a specific integration as default
  const setAsDefault = useMutation({
    mutationFn: async (integrationId: string) => {
      if (!user) throw new Error('User not authenticated');

      // Remove default from all payment integrations
      await supabase
        .from('usuarios_integracoes')
        .update({ is_default: false })
        .eq('user_id', user.id)
        .in('provedor', ['pix_manual', 'infinitepay', 'mercadopago']);

      // Set the new default
      const { error } = await supabase
        .from('usuarios_integracoes')
        .update({ is_default: true, status: 'ativo' })
        .eq('id', integrationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-integration'] });
      toast.success('Método de pagamento padrão atualizado!');
    },
    onError: (error) => {
      console.error('Error setting default:', error);
      toast.error('Erro ao definir método padrão');
    },
  });

  // Mutation to deactivate a specific payment method
  const deactivate = useMutation({
    mutationFn: async (provedor: PaymentProvider) => {
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('usuarios_integracoes')
        .update({ status: 'inativo', is_default: false })
        .eq('user_id', user.id)
        .eq('provedor', provedor);

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
    setAsDefault,
    deactivate,
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
    cnpj: 'CNPJ',
    email: 'E-mail',
    telefone: 'Telefone',
    aleatoria: 'Chave Aleatória',
  };
  return labels[type] || type;
}
