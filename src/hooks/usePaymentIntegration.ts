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

export interface MercadoPagoData {
  habilitarPix: boolean;
  habilitarCartao: boolean;
  maxParcelas: number;
  absorverTaxa: boolean;
  live_mode?: boolean;
}

export interface PaymentIntegration {
  id: string;
  provedor: PaymentProvider;
  status: 'ativo' | 'inativo' | 'erro_autenticacao';
  isDefault: boolean;
  dadosExtras: PixManualData | InfinitePayData | MercadoPagoData | null;
  conectadoEm: string | null;
  mpUserId?: string | null;
  expiraEm?: string | null;
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

  // Get MP App ID from env for OAuth URL
  const mpAppId = import.meta.env.VITE_MERCADOPAGO_APP_ID || '';

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
        .select('id, provedor, status, dados_extras, conectado_em, is_default, mp_user_id, expira_em')
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
          status: i.status as 'ativo' | 'inativo' | 'erro_autenticacao',
          isDefault: i.is_default || false,
          dadosExtras: extras as unknown as PixManualData | InfinitePayData | MercadoPagoData | null,
          conectadoEm: i.conectado_em,
          mpUserId: i.mp_user_id,
          expiraEm: i.expira_em,
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

  // Mutation to connect Mercado Pago via OAuth callback
  const connectMercadoPago = useMutation({
    mutationFn: async ({ code, redirect_uri }: { code: string; redirect_uri: string }) => {
      if (!user) throw new Error('User not authenticated');

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) throw new Error('No session');

      const response = await fetch(
        `https://tlnjspsywycbudhewsfv.supabase.co/functions/v1/mercadopago-oauth`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionData.session.access_token}`,
          },
          body: JSON.stringify({ code, redirect_uri }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao conectar Mercado Pago');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-integration'] });
      queryClient.invalidateQueries({ queryKey: ['photographer-account'] });
      toast.success('Mercado Pago conectado com sucesso!');
    },
    onError: (error) => {
      console.error('Error connecting Mercado Pago:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao conectar Mercado Pago');
    },
  });

  // Mutation to update Mercado Pago settings
  const updateMercadoPagoSettings = useMutation({
    mutationFn: async (settings: Partial<MercadoPagoData>) => {
      if (!user) throw new Error('User not authenticated');

      const { data: existing } = await supabase
        .from('usuarios_integracoes')
        .select('id, dados_extras')
        .eq('user_id', user.id)
        .eq('provedor', 'mercadopago')
        .single();

      if (!existing) throw new Error('Mercado Pago não configurado');

      const currentSettings = (existing.dados_extras as unknown as MercadoPagoData) || {
        habilitarPix: true,
        habilitarCartao: true,
        maxParcelas: 12,
        absorverTaxa: false,
      };
      const newSettings = { ...currentSettings, ...settings };

      const { error } = await supabase
        .from('usuarios_integracoes')
        .update({ dados_extras: newSettings as unknown as Json })
        .eq('id', existing.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-integration'] });
      toast.success('Configurações atualizadas!');
    },
    onError: (error) => {
      console.error('Error updating MP settings:', error);
      toast.error('Erro ao salvar configurações');
    },
  });

  // Helper to generate OAuth URL
  const getMercadoPagoOAuthUrl = () => {
    if (!mpAppId) return null;
    const redirectUri = `${window.location.origin}/settings?mp_callback=true`;
    return `https://auth.mercadopago.com.br/authorization?client_id=${mpAppId}&response_type=code&platform_id=mp&redirect_uri=${encodeURIComponent(redirectUri)}`;
  };

  return {
    ...query,
    mpAppId,
    savePixManual,
    saveInfinitePay,
    setAsDefault,
    deactivate,
    connectMercadoPago,
    updateMercadoPagoSettings,
    getMercadoPagoOAuthUrl,
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
