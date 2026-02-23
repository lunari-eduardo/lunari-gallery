import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getPhotoUrl as getPhotoUrlFromLib, getOriginalPhotoUrl } from '@/lib/photoUrl';
import { WatermarkSettings, TitleCaseMode } from '@/types/gallery';
import { Json } from '@/integrations/supabase/types';
import { RegrasCongeladas } from '@/lib/pricingUtils';

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
  orderIndex: number;
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
  // Theme settings for client gallery
  themeId?: string;
  clientMode?: 'light' | 'dark';
  // Session title font and casing
  sessionFont?: string;
  titleCaseMode?: TitleCaseMode;
  // Internal notes (Deliver)
  notasInternas?: string;
  // Cover photo for Deliver galleries
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
  // New fields
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
  // Token and password for client access
  publicToken: string | null;
  galleryPassword: string | null;
  // Frozen pricing rules from Gestão
  regrasCongeladas: RegrasCongeladas | null;
  // Gallery type
  tipo: 'selecao' | 'entrega';
  // First photo key for thumbnail
  firstPhotoKey: string | null;
  // Relations
  photos?: GaleriaPhoto[];
}

export interface GaleriaAcao {
  id: string;
  galeriaId: string;
  userId: string;
  tipo: string;
  descricao: string | null;
  createdAt: Date;
}

export interface CreateGaleriaData {
  clienteId?: string | null;  // Optional for public galleries
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
  prazoSelecao?: Date;  // Direct deadline date (for edit page)
  permissao?: 'public' | 'private';
  galleryPassword?: string;  // Password for private galleries
  sessionId?: string | null; // Session ID from Gestão system
  origin?: 'manual' | 'gestao'; // Track how gallery was created
  regrasCongeladas?: RegrasCongeladas | null; // Frozen pricing rules from Gestão
  tipo?: 'selecao' | 'entrega'; // Gallery type
}

// Transform database row to Galeria
function transformGaleria(row: any): Galeria {
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
    configuracoes: (row.configuracoes as GaleriaConfiguracoes) || {},
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
    tipo: row.tipo === 'entrega' ? 'entrega' : 'selecao',
    firstPhotoKey: row.galeria_fotos?.[0]?.storage_key || null,
  };
}

// Generate random token (12 alphanumeric characters)
function generatePublicToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Transform database row to GaleriaPhoto
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
    orderIndex: row.order_index,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function useSupabaseGalleries() {
  const queryClient = useQueryClient();
  const [isReady, setIsReady] = useState(false);

  // Wait for auth to be ready before querying
  useEffect(() => {
    let mounted = true;
    
    // Use onAuthStateChange as single source of truth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (mounted) {
        // Only set ready when we have a valid session WITH access_token
        const hasValidSession = !!(session?.access_token);
        console.log('🔐 Auth state for galleries:', event, hasValidSession);
        setIsReady(hasValidSession);
      }
    });

    // Also check current session immediately
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted && session?.access_token) {
        console.log('📋 Initial session ready for galleries');
        setIsReady(true);
      }
    });
    
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Fetch all galleries for current user
  const {
    data: galleries = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['galerias'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('galerias')
        .select('*, galeria_fotos(storage_key)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data.map(transformGaleria);
    },
    enabled: isReady, // Only run query when auth is ready
  });

  // Get a single gallery by ID
  const getGallery = useCallback(
    (id: string): Galeria | undefined => {
      return galleries.find((g) => g.id === id);
    },
    [galleries]
  );

  // Fetch gallery photos
  const fetchGalleryPhotos = async (galleryId: string): Promise<GaleriaPhoto[]> => {
    const { data, error } = await supabase
      .from('galeria_fotos')
      .select('*')
      .eq('galeria_id', galleryId)
      .order('original_filename', { ascending: true });

    if (error) throw error;
    return data.map(transformPhoto);
  };

  const createGalleryMutation = useMutation({
    mutationFn: async (data: CreateGaleriaData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const { data: result, error } = await supabase
        .from('galerias')
        .insert([{
          user_id: user.id,
          cliente_id: data.clienteId || null,  // Allow null for public galleries
          cliente_nome: data.clienteNome || null,
          cliente_email: data.clienteEmail || null,
          nome_sessao: data.nomeSessao || null,
          nome_pacote: data.nomePacote || null,
          fotos_incluidas: data.fotosIncluidas || 0,
          valor_foto_extra: data.valorFotoExtra || 0,
          mensagem_boas_vindas: data.mensagemBoasVindas || null,
          configuracoes: (data.configuracoes || {}) as Json,
          prazo_selecao_dias: data.prazoSelecaoDias || 7,
          permissao: data.permissao || 'private',
          tipo: data.tipo || 'selecao',
          gallery_password: data.galleryPassword || null,
          session_id: data.sessionId || null, // Session ID from Gestão
          origin: data.origin || 'manual', // Track creation origin
          regras_congeladas: data.regrasCongeladas ? (data.regrasCongeladas as unknown as Json) : null, // Frozen pricing rules
          status: 'rascunho',
        }])
        .select()
        .single();

      if (error) throw error;
      
      // If gallery was created from Gestão session, link it to clientes_sessoes
      // Note: sessionId from URL is the workflow string 'session_id' column
      if (data.sessionId && result.id) {
        const { error: sessionLinkError } = await supabase
          .from('clientes_sessoes')
          .update({
            galeria_id: result.id,
            status_galeria: 'enviada',
            updated_at: new Date().toISOString(),
          })
          .eq('session_id', data.sessionId);
        
        if (sessionLinkError) {
          console.error('Error linking gallery to session:', sessionLinkError);
        } else {
          console.log('✅ Gallery linked to session:', data.sessionId);
        }
      }
      
      // Add creation action
      await supabase.from('galeria_acoes').insert({
        galeria_id: result.id,
        user_id: result.user_id,
        tipo: 'criada',
        descricao: 'Galeria criada',
      });

      return transformGaleria(result);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['galerias'] });
      // Toast removido - será mostrado apenas no final do fluxo de criação
    },
    onError: (error) => {
      console.error('Error creating gallery:', error);
      toast.error('Erro ao criar galeria');
    },
  });

  // Update gallery mutation
  const updateGalleryMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateGaleriaData> }) => {
      const updateData: Record<string, any> = {};
      
      if (data.clienteNome !== undefined) updateData.cliente_nome = data.clienteNome;
      if (data.clienteEmail !== undefined) updateData.cliente_email = data.clienteEmail;
      if (data.clienteTelefone !== undefined) updateData.cliente_telefone = data.clienteTelefone;
      if (data.nomeSessao !== undefined) updateData.nome_sessao = data.nomeSessao;
      if (data.nomePacote !== undefined) updateData.nome_pacote = data.nomePacote;
      if (data.fotosIncluidas !== undefined) updateData.fotos_incluidas = data.fotosIncluidas;
      if (data.valorFotoExtra !== undefined) updateData.valor_foto_extra = data.valorFotoExtra;
      if (data.mensagemBoasVindas !== undefined) updateData.mensagem_boas_vindas = data.mensagemBoasVindas;
      if (data.configuracoes !== undefined) updateData.configuracoes = data.configuracoes;
      if (data.prazoSelecaoDias !== undefined) updateData.prazo_selecao_dias = data.prazoSelecaoDias;
      if (data.prazoSelecao !== undefined) updateData.prazo_selecao = data.prazoSelecao.toISOString();
      if (data.permissao !== undefined) updateData.permissao = data.permissao;

      const { error } = await supabase
        .from('galerias')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['galerias'] });
    },
    onError: (error) => {
      console.error('Error updating gallery:', error);
      toast.error('Erro ao atualizar galeria');
    },
  });

  // Delete gallery mutation - with paginated photo fetch and complete R2 cleanup
  const deleteGalleryMutation = useMutation({
    mutationFn: async (id: string) => {
      // First, fetch gallery to get session_id before deletion
      const { data: gallery } = await supabase
        .from('galerias')
        .select('session_id')
        .eq('id', id)
        .maybeSingle();

      // Fetch ALL photo IDs with pagination (Supabase caps at 1000 per query)
      const allPhotoIds: string[] = [];
      const PAGE_SIZE = 1000;
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const { data: page } = await supabase
          .from('galeria_fotos')
          .select('id')
          .eq('galeria_id', id)
          .range(offset, offset + PAGE_SIZE - 1);

        if (page && page.length > 0) {
          allPhotoIds.push(...page.map((p) => p.id));
          offset += PAGE_SIZE;
          hasMore = page.length === PAGE_SIZE;
        } else {
          hasMore = false;
        }
      }

      // Delete photos from R2 in batches of 500
      if (allPhotoIds.length > 0) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const BATCH_SIZE = 500;
          for (let i = 0; i < allPhotoIds.length; i += BATCH_SIZE) {
            const batch = allPhotoIds.slice(i, i + BATCH_SIZE);
            await fetch(
              `https://tlnjspsywycbudhewsfv.supabase.co/functions/v1/delete-photos`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                  galleryId: id,
                  photoIds: batch,
                }),
              }
            );
          }
        }
      }

      // Update clientes_sessoes: mark as deleted but preserve payment history
      if (gallery?.session_id) {
        const { error: sessionError } = await supabase
          .from('clientes_sessoes')
          .update({
            status_galeria: 'excluida',
            galeria_id: null,
            updated_at: new Date().toISOString(),
          })
          .eq('session_id', gallery.session_id);

        if (sessionError) {
          console.error('Error updating session after gallery delete:', sessionError);
        } else {
          console.log('✅ Session updated: status_galeria = excluida, galeria_id = null');
        }
      }

      // Unlink credit_ledger entries to avoid FK constraint violation
      await supabase
        .from('credit_ledger')
        .update({ gallery_id: null })
        .eq('gallery_id', id);

      // Then delete the gallery (cascade will handle photos in DB, acoes, cobrancas)
      const { error } = await supabase.from('galerias').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['galerias'] });
      toast.success('Galeria excluída');
    },
    onError: (error) => {
      console.error('Error deleting gallery:', error);
      toast.error('Erro ao excluir galeria');
    },
  });

  // Update photo selection
  const updatePhotoSelectionMutation = useMutation({
    mutationFn: async ({
      photoId,
      isSelected,
    }: {
      photoId: string;
      isSelected: boolean;
    }) => {
      const { error } = await supabase
        .from('galeria_fotos')
        .update({ is_selected: isSelected })
        .eq('id', photoId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['galerias'] });
    },
  });

  // Update photo comment
  const updatePhotoCommentMutation = useMutation({
    mutationFn: async ({
      photoId,
      comment,
    }: {
      photoId: string;
      comment: string;
    }) => {
      const { error } = await supabase
        .from('galeria_fotos')
        .update({ comment })
        .eq('id', photoId);

      if (error) throw error;
    },
  });

  // Publish gallery - generates token and deadline WITHOUT marking as sent
  const publishGalleryMutation = useMutation({
    mutationFn: async (id: string) => {
      const gallery = getGallery(id);
      if (!gallery) throw new Error('Galeria não encontrada');

      const publicToken = gallery.publicToken || generatePublicToken();
      
      const prazoSelecao = new Date();
      prazoSelecao.setDate(prazoSelecao.getDate() + (gallery.prazoSelecaoDias || 7));

      const isDeliver = gallery.tipo === 'entrega';

      const { error } = await supabase
        .from('galerias')
        .update({
          // Keep status as 'rascunho' - not sent yet
          prazo_selecao: prazoSelecao.toISOString(),
          public_token: publicToken,
          published_at: new Date().toISOString(),
          ...(isDeliver && {
            finalized_at: new Date().toISOString(),
            configuracoes: {
              ...((gallery.configuracoes || {}) as Record<string, any>),
              allowDownload: true,
            },
          }),
        })
        .eq('id', id);

      if (error) throw error;

      return { publicToken };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['galerias'] });
    },
    onError: (error) => {
      console.error('Error publishing gallery:', error);
      toast.error('Erro ao publicar galeria');
    },
  });

  // Send gallery to client - marks as sent and logs action
  const sendGalleryMutation = useMutation({
    mutationFn: async (id: string) => {
      const gallery = getGallery(id);
      if (!gallery) throw new Error('Galeria não encontrada');

      // If already sent, don't re-send
      if (gallery.status === 'enviado') {
        return { publicToken: gallery.publicToken };
      }

      // Generate token if somehow missing
      const publicToken = gallery.publicToken || generatePublicToken();
      
      const prazoSelecao = gallery.prazoSelecao || new Date(Date.now() + (gallery.prazoSelecaoDias || 7) * 86400000);

      const { error } = await supabase
        .from('galerias')
        .update({
          status: 'enviado',
          enviado_em: new Date().toISOString(),
          prazo_selecao: prazoSelecao instanceof Date ? prazoSelecao.toISOString() : prazoSelecao,
          public_token: publicToken,
        })
        .eq('id', id);

      if (error) throw error;

      // Update session status
      if (gallery.sessionId) {
        await supabase
          .from('clientes_sessoes')
          .update({
            status_galeria: 'enviada',
            updated_at: new Date().toISOString(),
          })
          .eq('session_id', gallery.sessionId);
      }

      // Log action
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('galeria_acoes').insert({
          galeria_id: id,
          user_id: user.id,
          tipo: 'enviada',
          descricao: 'Galeria enviada para o cliente',
        });
      }

      return { publicToken };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['galerias'] });
    },
    onError: (error) => {
      console.error('Error sending gallery:', error);
      toast.error('Erro ao enviar galeria');
    },
  });

  // Confirm selection
  const confirmSelectionMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('galerias')
        .update({
          status: 'selecao_completa',
          status_selecao: 'selecao_completa',
          finalized_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      // Add action
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('galeria_acoes').insert({
          galeria_id: id,
          user_id: user.id,
          tipo: 'cliente_confirmou',
          descricao: 'Cliente confirmou a seleção',
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['galerias'] });
      toast.success('Seleção confirmada!');
    },
  });

  // Reopen selection
  const reopenSelectionMutation = useMutation({
    mutationFn: async ({ id, days }: { id: string; days: number }) => {
      const prazoSelecao = new Date();
      prazoSelecao.setDate(prazoSelecao.getDate() + days);

      const { error } = await supabase
        .from('galerias')
        .update({
          status: 'selecao_iniciada',
          status_selecao: 'em_andamento',
          prazo_selecao: prazoSelecao.toISOString(),
          prazo_selecao_dias: days,
          finalized_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      // Sync clientes_sessoes so Gestão sees the reactivation
      const { data: gallery } = await supabase
        .from('galerias')
        .select('session_id')
        .eq('id', id)
        .single();

      if (gallery?.session_id) {
        await supabase
          .from('clientes_sessoes')
          .update({ status_galeria: 'em_selecao', updated_at: new Date().toISOString() })
          .eq('session_id', gallery.session_id);
      }

      // Add action
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('galeria_acoes').insert({
          galeria_id: id,
          user_id: user.id,
          tipo: 'selecao_reaberta',
          descricao: `Seleção reaberta pelo fotógrafo (${days} dias de prazo)`,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['galerias'] });
      toast.success('Seleção reaberta!');
    },
  });

  // Get photo URL helper - returns direct static URLs from R2
  const getPhotoUrl = useCallback(
    (
      photo: GaleriaPhoto & { processingStatus?: string; thumbPath?: string; previewPath?: string }, 
      _gallery: Galeria | undefined, 
      size: 'thumbnail' | 'preview' | 'full'
    ): string => {
      const photoPath = photo.storageKey;
      
      if (!photoPath) return '/placeholder.svg';
      
      // Return direct static URL from R2
      return getPhotoUrlFromLib(
        {
          storageKey: photoPath,
          thumbPath: photo.thumbPath,
          previewPath: photo.previewPath,
          width: photo.width,
          height: photo.height,
        },
        size === 'full' ? 'original' : size
      );
    },
    []
  );

  // Delete single photo mutation
  const deletePhotoMutation = useMutation({
    mutationFn: async ({ galleryId, photoId }: { galleryId: string; photoId: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      const response = await fetch(
        `https://tlnjspsywycbudhewsfv.supabase.co/functions/v1/delete-photos`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            galleryId,
            photoIds: [photoId],
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Falha ao excluir foto');
      }

      return response.json();
    },
    onSuccess: (_, { galleryId }) => {
      queryClient.invalidateQueries({ queryKey: ['galeria-fotos', galleryId] });
      queryClient.invalidateQueries({ queryKey: ['galerias'] });
      toast.success('Foto excluída');
    },
    onError: (error) => {
      console.error('Error deleting photo:', error);
      toast.error('Erro ao excluir foto');
    },
  });

  return {
    // Data
    galleries,
    isLoading,
    error,
    refetch,

    // Queries
    getGallery,
    fetchGalleryPhotos,

    // Mutations
    createGallery: createGalleryMutation.mutateAsync,
    updateGallery: updateGalleryMutation.mutateAsync,
    deleteGallery: deleteGalleryMutation.mutateAsync,
    updatePhotoSelection: updatePhotoSelectionMutation.mutateAsync,
    updatePhotoComment: updatePhotoCommentMutation.mutateAsync,
    publishGallery: publishGalleryMutation.mutateAsync,
    sendGallery: sendGalleryMutation.mutateAsync,
    confirmSelection: confirmSelectionMutation.mutateAsync,
    reopenSelection: reopenSelectionMutation.mutateAsync,
    deletePhoto: deletePhotoMutation.mutateAsync,

    // Helpers
    getPhotoUrl,

    // Loading states
    isCreating: createGalleryMutation.isPending,
    isUpdating: updateGalleryMutation.isPending,
    isDeleting: deleteGalleryMutation.isPending,
    isDeletingPhoto: deletePhotoMutation.isPending,
  };
}
