import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthContext } from '@/contexts/AuthContext';

export interface ClientGallery {
  id: string;
  nome_sessao: string | null;
  nome_pacote: string | null;
  status: string;
  status_selecao: string | null;
  fotos_selecionadas: number | null;
  total_fotos: number | null;
  valor_total_vendido: number | null;
  total_fotos_extras_vendidas: number | null;
  created_at: string;
  enviado_em: string | null;
  finalized_at: string | null;
}

export interface ClientPayment {
  id: string;
  valor: number;
  provedor: string | null;
  status: string | null;
  qtd_fotos: number | null;
  data_pagamento: string | null;
  ip_receipt_url: string | null;
  galeria_id: string | null;
  galeria_nome: string | null;
  created_at: string;
}

export interface ClientProfileData {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  whatsapp: string | null;
  gallery_status: string | null;
  total_galerias: number | null;
  created_at: string | null;
}

export interface ClientStats {
  totalGalleries: number;
  totalPhotosSelected: number;
  totalPaid: number;
  totalExtrasPhotos: number;
  totalPayments: number;
}

export function useClientProfile(clientId: string | undefined) {
  const { user } = useAuthContext();

  const clientQuery = useQuery({
    queryKey: ['client-profile', clientId],
    queryFn: async (): Promise<ClientProfileData | null> => {
      if (!clientId || !user) return null;
      
      const { data, error } = await supabase
        .from('clientes')
        .select('id, nome, email, telefone, whatsapp, gallery_status, total_galerias, created_at')
        .eq('id', clientId)
        .eq('user_id', user.id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!clientId && !!user,
  });

  const galleriesQuery = useQuery({
    queryKey: ['client-galleries', clientId],
    queryFn: async (): Promise<ClientGallery[]> => {
      if (!clientId || !user) return [];
      
      const { data, error } = await supabase
        .from('galerias')
        .select(`
          id, nome_sessao, nome_pacote, status, status_selecao,
          fotos_selecionadas, total_fotos, valor_total_vendido, 
          total_fotos_extras_vendidas, created_at, enviado_em, finalized_at
        `)
        .eq('cliente_id', clientId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!clientId && !!user,
  });

  const paymentsQuery = useQuery({
    queryKey: ['client-payments', clientId],
    queryFn: async (): Promise<ClientPayment[]> => {
      if (!clientId || !user) return [];
      
      const { data, error } = await supabase
        .from('cobrancas')
        .select(`
          id, valor, provedor, status, qtd_fotos, 
          data_pagamento, ip_receipt_url, galeria_id, created_at
        `)
        .eq('cliente_id', clientId)
        .eq('user_id', user.id)
        .eq('status', 'pago')
        .order('data_pagamento', { ascending: false });
      
      if (error) throw error;
      
      // Buscar nomes das galerias para os pagamentos
      const galeriaIds = [...new Set(data?.filter(p => p.galeria_id).map(p => p.galeria_id) || [])];
      
      let galeriasMap: Record<string, string> = {};
      if (galeriaIds.length > 0) {
        const { data: galerias } = await supabase
          .from('galerias')
          .select('id, nome_sessao')
          .in('id', galeriaIds);
        
        galeriasMap = (galerias || []).reduce((acc, g) => {
          acc[g.id] = g.nome_sessao || 'Galeria sem nome';
          return acc;
        }, {} as Record<string, string>);
      }
      
      return (data || []).map(p => ({
        ...p,
        galeria_nome: p.galeria_id ? galeriasMap[p.galeria_id] || null : null,
      }));
    },
    enabled: !!clientId && !!user,
  });

  // Calcular estatísticas
  const stats: ClientStats = {
    totalGalleries: galleriesQuery.data?.length || 0,
    totalPhotosSelected: galleriesQuery.data?.reduce((sum, g) => sum + (g.fotos_selecionadas || 0), 0) || 0,
    totalPaid: paymentsQuery.data?.reduce((sum, p) => sum + (p.valor || 0), 0) || 0,
    totalExtrasPhotos: paymentsQuery.data?.reduce((sum, p) => sum + (p.qtd_fotos || 0), 0) || 0,
    totalPayments: paymentsQuery.data?.length || 0,
  };

  return {
    client: clientQuery.data,
    galleries: galleriesQuery.data || [],
    payments: paymentsQuery.data || [],
    stats,
    isLoading: clientQuery.isLoading || galleriesQuery.isLoading || paymentsQuery.isLoading,
    isError: clientQuery.isError || galleriesQuery.isError || paymentsQuery.isError,
    refetch: () => {
      clientQuery.refetch();
      galleriesQuery.refetch();
      paymentsQuery.refetch();
    },
  };
}
