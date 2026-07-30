import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient, UseMutationResult } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getPhotoUrl as getPhotoUrlFromLib, getOriginalPhotoUrl } from '@/lib/photoUrl';
import { WatermarkSettings, TitleCaseMode } from '@/types/gallery';
import { Json } from '@/integrations/supabase/types';
import { RegrasCongeladas, sanitizeExtraPrice } from '@/lib/pricingUtils';

// Types based on database schema
export interface GaleriaPhoto {
  id: string;
  galeriaId: string;
  userId: string;
  filename: string;
  originalFilename: string;
  fileSize: number;
  mimeType: string;
  width: number;
  height: number;
  storageKey: string;
  isSelected: boolean;
  isFavorite: boolean;
  comment: string | null;
  pesoVisual: number;
  orderIndex: number;
  pastaId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface GaleriaConfiguracoes {
  watermark?: WatermarkSettings;
  watermarkDisplay?: 'all' | 'fullscreen' | 'none';
  imageResizeOption?: 1024 | 1920 | 2560;
  allowComments?: boolean;
  allowDownload?: boolean;
  allowExtraPhotos?: boolean;
  saleSettings?: {
    mode: 'no_sale' | 'sale_with_payment' | 'sale_without_payment';
    pricingModel: 'fixed' | 'packages';
    chargeType: 'only_extras' | 'all_selected';
    fixedPrice: number;
    discountPackages: Array<{
      id: string;
      minPhotos: number;
      maxPhotos: number | null;
      pricePerPhoto: number;
    }>;
  };
  themeId?: string;
  clientMode?: 'light' | 'dark';
  sessionFont?: string;
  titleCaseMode?: TitleCaseMode;
  photoSpacing?: number;
  notasInternas?: string;
  coverPhotoId?: string;
}

export interface Galeria {
  id: string;
  userId: string;
  clienteId: string;
  status: string;
  statusPagamento: string | null;
  fotosIncluidas: number;
  valorFotoExtra: number;
  regrasSelecao: Json | null;
  prazoSelecaoDias: number | null;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
  finalizedAt: Date | null;
  sessionId: string | null;
  orcamentoId: string | null;
  permissao: string;
  nomeSessao: string | null;
  nomePacote: string | null;
  mensagemBoasVindas: string | null;
  configuracoes: GaleriaConfiguracoes;
  totalFotos: number;
  fotosSelecionadas: number;
  valorExtras: number;
  valorTotalVendido: number;
  totalFotosExtrasVendidas: number;
  statusSelecao: string;
  prazoSelecao: Date | null;
  enviadoEm: Date | null;
  clienteNome: string | null;
  clienteEmail: string | null;
  clienteTelefone: string | null;
  publicToken: string | null;
  galleryPassword: string | null;
  regrasCongeladas: RegrasCongeladas | null;
  regrasOverride: boolean;
  tipo: 'selecao' | 'entrega';
  firstPhotoKey: string | null;
  coverPhotoKey: string | null;
  themeId?: string | null;
  useCustomTheme?: boolean;
  themeOverrides?: any;
  coverId?: string | null;
  expiresAt?: Date | null;
  /** Colunas de venda (fonte da verdade; JSON `configuracoes.saleSettings` é fallback). */
  vendaModo: string | null;
  vendaPagamentoProvedor: string | null;
  vendaTipoCobranca: string | null;
}

export interface CreateGaleriaData {
  clienteId?: string | null;
  clienteNome?: string | null;
  clienteEmail?: string | null;
  clienteTelefone?: string;
  nomeSessao?: string;
  nomePacote?: string;
  fotosIncluidas?: number;
  valorFotoExtra?: number;
  mensagemBoasVindas?: string;
  configuracoes?: GaleriaConfiguracoes;
  prazoSelecaoDias?: number;
  prazoSelecao?: Date;
  permissao?: 'public' | 'private';
  galleryPassword?: string;
  sessionId?: string | null;
  origin?: 'manual' | 'gestao';
  regrasCongeladas?: RegrasCongeladas | null;
  regrasOverride?: boolean;
  tipo?: 'selecao' | 'entrega';
  themeId?: string | null;
  useCustomTheme?: boolean;
  themeOverrides?: any;
  coverId?: string | null;
  venda_modo?: string;
  venda_pagamento_provedor?: string;
  venda_tipo_cobranca?: string;
}

function transformGaleria(row: any): Galeria {
  const configuracoes = (row.configuracoes as GaleriaConfiguracoes) || {};

  // Chaves de foto vêm de colunas denormalizadas em `galerias`
  // (mantidas por trigger em galeria_fotos). Isso elimina o join pesado
  // que puxava toda `galeria_fotos` só para descobrir a capa/primeira foto.
  const coverPhotoKey: string | null = row.cover_storage_key || null;
  const firstPhotoKey: string | null = row.first_photo_storage_key || null;

  return {
    id: row.id,
    userId: row.user_id,
    clienteId: row.cliente_id,
    status: row.status,
    statusPagamento: row.status_pagamento,
    fotosIncluidas: row.fotos_incluidas,
    valorFotoExtra: row.valor_foto_extra,
    regrasSelecao: row.regras_selecao,
    prazoSelecaoDias: row.prazo_selecao_dias,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    publishedAt: row.published_at ? new Date(row.published_at) : null,
    finalizedAt: row.finalized_at ? new Date(row.finalized_at) : null,
    sessionId: row.session_id,
    orcamentoId: row.orcamento_id,
    permissao: row.permissao || 'private',
    nomeSessao: row.nome_sessao,
    nomePacote: row.nome_pacote,
    mensagemBoasVindas: row.mensagem_boas_vindas,
    configuracoes,
    totalFotos: row.total_fotos || 0,
    fotosSelecionadas: row.fotos_selecionadas || 0,
    valorExtras: row.valor_extras || 0,
    valorTotalVendido: row.valor_total_vendido || 0,
    totalFotosExtrasVendidas: row.total_fotos_extras_vendidas || 0,
    statusSelecao: row.status_selecao || 'em_andamento',
    prazoSelecao: row.prazo_selecao ? new Date(row.prazo_selecao) : null,
    enviadoEm: row.enviado_em ? new Date(row.enviado_em) : null,
    clienteNome: row.cliente_nome,
    clienteEmail: row.cliente_email,
    clienteTelefone: row.cliente_telefone || null,
    publicToken: row.public_token || null,
    galleryPassword: row.gallery_password || null,
    regrasCongeladas: row.regras_congeladas as RegrasCongeladas | null,
    regrasOverride: row.regras_override ?? false,
    tipo: row.tipo === 'entrega' ? 'entrega' : 'selecao',
    firstPhotoKey,
    coverPhotoKey,
    themeId: row.theme_id,
    useCustomTheme: row.use_custom_theme ?? false,
    themeOverrides: row.theme_overrides ?? {},
    coverId: row.cover_id ?? null,
    expiresAt: row.expires_at ? new Date(row.expires_at) : null,
    vendaModo: row.venda_modo ?? null,
    vendaPagamentoProvedor: row.venda_pagamento_provedor ?? null,
    vendaTipoCobranca: row.venda_tipo_cobranca ?? null,
  };
}

function generatePublicToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function transformPhoto(row: any): GaleriaPhoto {
  return {
    id: row.id,
    galeriaId: row.galeria_id,
    userId: row.user_id,
    filename: row.filename,
    originalFilename: row.original_filename,
    fileSize: row.file_size,
    mimeType: row.mime_type,
    width: row.width,
    height: row.height,
    storageKey: row.storage_key,
    isSelected: row.is_selected,
    isFavorite: row.is_favorite ?? false,
    comment: row.comment,
    pesoVisual: row.peso_visual ?? 0,
    orderIndex: row.order_index,
    pastaId: row.pasta_id || null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function useSupabaseGalleries() {
  const queryClient = useQueryClient();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (mounted) {
        const hasValidSession = !!(session?.access_token);
        setIsReady(hasValidSession);
      }
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted && session?.access_token) {
        setIsReady(true);
      }
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const {
    data: galleries = [],
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['galleries'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('galerias')
        .select('*')
        .order('created_at', { ascending: false });
      
      
      if (error) throw error;
      return (data || []).map(transformGaleria);
    },
    enabled: isReady,
    // Egress guard (Bloco B3): evita refetch a cada foco de aba.
    // Realtime + invalidação explícita cobrem os casos em que a lista precisa
    // ser atualizada; sem isso, cada foco de janela disparava um SELECT * em galerias.
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const getGallery = useCallback((id: string, galleriesList: Galeria[] = galleries) => {
    return galleriesList.find(g => g.id === id);
  }, [galleries]);

  const fetchGalleryPhotos = async (galleryId: string): Promise<GaleriaPhoto[]> => {
    const { data, error } = await supabase
      .from('galeria_fotos')
      .select('*')
      .eq('galeria_id', galleryId)
      .order('original_filename', { ascending: true })
      .order('id', { ascending: true });
    
    if (error) throw error;
    const rows = (data || []).map(transformPhoto);
    // Aplica ordenação natural ("a (2)" < "a (10)") como fonte única.
    const { sortPhotosByNaturalFilename } = await import('@/lib/photoOrdering');
    return sortPhotosByNaturalFilename(rows);
  };

  const createGallery = useMutation({
    mutationFn: async (data: CreateGaleriaData) => {
      const publicToken = generatePublicToken();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not found');

      const { data: result, error } = await supabase
        .from('galerias')
        .insert({
          user_id: user.id,
          cliente_id: data.clienteId,
          cliente_nome: data.clienteNome,
          cliente_email: data.clienteEmail,
          cliente_telefone: data.clienteTelefone,
          nome_sessao: data.nomeSessao,
          nome_pacote: data.nomePacote,
          fotos_incluidas: data.fotosIncluidas,
          valor_foto_extra: data.valorFotoExtra,
          mensagem_boas_vindas: data.mensagemBoasVindas,
          configuracoes: data.configuracoes as any,
          prazo_selecao: data.prazoSelecao,
          permissao: data.permissao || 'private',
          gallery_password: data.galleryPassword,
          public_token: publicToken,
          session_id: data.sessionId,
          tipo: data.tipo || 'selecao',
          theme_id: (data as any).themeId || null,
          use_custom_theme: (data as any).useCustomTheme || false,
          theme_overrides: (data as any).themeOverrides || {},
          cover_id: (data as any).coverId ?? null,
        } as any)
        .select()
        .single();
      
      if (error) throw error;
      return transformGaleria(result);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['galleries'] });
    },
  });

  const updateGallery = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateGaleriaData> }) => {
      const updateData: any = {};
      if (data.nomeSessao !== undefined) updateData.nome_sessao = data.nomeSessao;
      if (data.clienteNome !== undefined) updateData.cliente_nome = data.clienteNome;
      if (data.clienteEmail !== undefined) updateData.cliente_email = data.clienteEmail;
      if (data.clienteTelefone !== undefined) updateData.cliente_telefone = data.clienteTelefone;
      if (data.nomePacote !== undefined) updateData.nome_pacote = data.nomePacote;
      if (data.fotosIncluidas !== undefined) updateData.fotos_incluidas = data.fotosIncluidas;
      if (data.valorFotoExtra !== undefined) updateData.valor_foto_extra = data.valorFotoExtra;
      if (data.mensagemBoasVindas !== undefined) updateData.mensagem_boas_vindas = data.mensagemBoasVindas;
      if (data.permissao !== undefined) updateData.permissao = data.permissao;
      if (data.galleryPassword !== undefined) updateData.gallery_password = data.galleryPassword;
      if (data.configuracoes !== undefined) updateData.configuracoes = data.configuracoes;
      if (data.prazoSelecao !== undefined) updateData.prazo_selecao = data.prazoSelecao;
      if ((data as any).themeId !== undefined) updateData.theme_id = (data as any).themeId;
      if ((data as any).useCustomTheme !== undefined) updateData.use_custom_theme = (data as any).useCustomTheme;
      if ((data as any).themeOverrides !== undefined) updateData.theme_overrides = (data as any).themeOverrides;
      if ((data as any).coverId !== undefined) updateData.cover_id = (data as any).coverId;
      if ((data as any).venda_modo !== undefined) updateData.venda_modo = (data as any).venda_modo;
      if ((data as any).venda_pagamento_provedor !== undefined) updateData.venda_pagamento_provedor = (data as any).venda_pagamento_provedor;
      if ((data as any).venda_tipo_cobranca !== undefined) updateData.venda_tipo_cobranca = (data as any).venda_tipo_cobranca;
      if (data.regrasCongeladas !== undefined) updateData.regras_congeladas = data.regrasCongeladas as any;
      if ((data as any).regrasOverride !== undefined) updateData.regras_override = (data as any).regrasOverride;



      const { data: result, error } = await supabase
        .from('galerias')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return transformGaleria(result);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['galleries'] });
      queryClient.invalidateQueries({ queryKey: ['client-gallery', variables.id] });
    },

  });

  const deleteGallery = useMutation({
    mutationFn: async (id: string) => {
      // Exclusão definitiva via edge function: apaga fotos do R2/BD e remove a galeria.
      // Cobranças permanecem vinculadas à sessão (session_id) para preservar o extrato.
      const { data, error } = await supabase.functions.invoke('archive-gallery', {
        body: { galleryId: id },
      });

      if (error) {
        let msg = (data as any)?.error || error.message || 'Falha ao excluir galeria';
        try {
          const ctx: any = (error as any).context;
          if (ctx && typeof ctx.json === 'function') {
            const body = await ctx.json();
            if (body?.error) msg = body.error;
          }
        } catch { /* ignore parse */ }
        throw new Error(msg);
      }
      if (data && (data as any).success === false) {
        throw new Error((data as any).error || 'Falha ao excluir galeria');
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['galleries'] });
    },
  });

  const publishGallery = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc('prepare_gallery_share', { 
        p_gallery_id: id,
        p_mark_as_sent: false 
      });
      
      if (error) throw error;
      const result = data as any;
      if (result?.error) throw new Error(result.error);
      
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['galleries'] });
    },
  });

  const sendGallery = useMutation({
    mutationFn: async (id: string) => {
      // Usando prepare_gallery_share (Opção B do plano) para marcar como enviada
      // e obter o link público/token atualizado de forma atômica.
      const { error } = await supabase.rpc('prepare_gallery_share', { 
        p_gallery_id: id,
        p_mark_as_sent: true 
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['galleries'] });
    }
  });

  const reopenSelection = useMutation({
    mutationFn: async (params: { id: string; days?: number }) => {
      const { error } = await supabase.rpc('reopen_gallery_selection' as any, { 
        p_gallery_id: params.id,
        p_days: params.days ?? 7
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['galleries'] });
      queryClient.invalidateQueries({ queryKey: ['galeria-fotos'] });
      queryClient.invalidateQueries({ queryKey: ['gallery-credits'] });
      queryClient.invalidateQueries({ queryKey: ['photographer-account'] });
      queryClient.invalidateQueries({ queryKey: ['photo-credits'] });
    }
  });

  const deletePhoto = useMutation({
    mutationFn: async (params: { photoId: string; [key: string]: any }) => {
      const { error } = await supabase
        .from('galeria_fotos')
        .delete()
        .eq('id', params.photoId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['galleries'] });
    }
  });

  const deletePhotos = useMutation({
    mutationFn: async (params: { photoIds: string[]; [key: string]: any }) => {
      const { error } = await supabase
        .from('galeria_fotos')
        .delete()
        .in('id', params.photoIds);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['galleries'] });
    }
  });

  return {
    galleries,
    isLoading,
    error,
    refetch,
    getGallery,
    fetchGalleryPhotos,
    createGallery: createGallery.mutateAsync,
    updateGallery: updateGallery.mutateAsync,
    deleteGallery: deleteGallery.mutateAsync,
    publishGallery: publishGallery.mutateAsync,
    sendGallery: sendGallery.mutateAsync,
    reopenSelection: reopenSelection.mutateAsync,
    deletePhoto: deletePhoto.mutateAsync,
    deletePhotos: deletePhotos.mutateAsync,
    getPhotoUrl: (photo: any, type: any, ...args: any[]) => getPhotoUrlFromLib(photo, type),
    isUpdating: updateGallery.isPending,
    isDeleting: deleteGallery.isPending,
    isDeletingPhoto: deletePhoto.isPending,
    isDeletingPhotos: deletePhotos.isPending,
  };
}
