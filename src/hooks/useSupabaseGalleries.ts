import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getPreviewUrl, getThumbnailUrl, WatermarkSettings } from '@/lib/cloudinaryUrl';
import { Json } from '@/integrations/supabase/types';

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
  comment: string | null;
  orderIndex: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface GaleriaConfiguracoes {
  watermark?: WatermarkSettings;
  watermarkDisplay?: 'all' | 'fullscreen' | 'none';
  imageResizeOption?: 800 | 1024 | 1920;
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
  statusSelecao: string;
  prazoSelecao: Date | null;
  enviadoEm: Date | null;
  clienteNome: string | null;
  clienteEmail: string | null;
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
  clienteId: string;
  clienteNome?: string;
  clienteEmail?: string;
  nomeSessao?: string;
  nomePacote?: string;
  fotosIncluidas?: number;
  valorFotoExtra?: number;
  mensagemBoasVindas?: string;
  configuracoes?: GaleriaConfiguracoes;
  prazoSelecaoDias?: number;
  permissao?: 'public' | 'private';
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
    statusSelecao: row.status_selecao || 'em_andamento',
    prazoSelecao: row.prazo_selecao ? new Date(row.prazo_selecao) : null,
    enviadoEm: row.enviado_em ? new Date(row.enviado_em) : null,
    clienteNome: row.cliente_nome,
    clienteEmail: row.cliente_email,
  };
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
    comment: row.comment,
    orderIndex: row.order_index,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function useSupabaseGalleries() {
  const queryClient = useQueryClient();

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
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data.map(transformGaleria);
    },
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
      .order('order_index', { ascending: true });

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
          cliente_id: data.clienteId,
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
          status: 'rascunho',
        }])
        .select()
        .single();

      if (error) throw error;
      
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
      toast.success('Galeria criada com sucesso!');
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
      if (data.nomeSessao !== undefined) updateData.nome_sessao = data.nomeSessao;
      if (data.nomePacote !== undefined) updateData.nome_pacote = data.nomePacote;
      if (data.fotosIncluidas !== undefined) updateData.fotos_incluidas = data.fotosIncluidas;
      if (data.valorFotoExtra !== undefined) updateData.valor_foto_extra = data.valorFotoExtra;
      if (data.mensagemBoasVindas !== undefined) updateData.mensagem_boas_vindas = data.mensagemBoasVindas;
      if (data.configuracoes !== undefined) updateData.configuracoes = data.configuracoes;
      if (data.prazoSelecaoDias !== undefined) updateData.prazo_selecao_dias = data.prazoSelecaoDias;
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

  // Delete gallery mutation
  const deleteGalleryMutation = useMutation({
    mutationFn: async (id: string) => {
      // First delete photos from B2
      const { data: photos } = await supabase
        .from('galeria_fotos')
        .select('id')
        .eq('galeria_id', id);

      if (photos && photos.length > 0) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
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
                photoIds: photos.map((p) => p.id),
              }),
            }
          );
        }
      }

      // Then delete the gallery (cascade will handle photos in DB)
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

  // Send gallery to client
  const sendGalleryMutation = useMutation({
    mutationFn: async (id: string) => {
      const prazoSelecao = new Date();
      prazoSelecao.setDate(prazoSelecao.getDate() + 7); // Default 7 days

      const { error } = await supabase
        .from('galerias')
        .update({
          status: 'enviado',
          enviado_em: new Date().toISOString(),
          prazo_selecao: prazoSelecao.toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      // Add action
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('galeria_acoes').insert({
          galeria_id: id,
          user_id: user.id,
          tipo: 'enviada',
          descricao: 'Galeria enviada para o cliente',
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['galerias'] });
      toast.success('Galeria enviada!');
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
          status_selecao: 'confirmado',
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
    mutationFn: async (id: string) => {
      const prazoSelecao = new Date();
      prazoSelecao.setDate(prazoSelecao.getDate() + 7);

      const { error } = await supabase
        .from('galerias')
        .update({
          status: 'selecao_iniciada',
          status_selecao: 'em_andamento',
          prazo_selecao: prazoSelecao.toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      // Add action
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('galeria_acoes').insert({
          galeria_id: id,
          user_id: user.id,
          tipo: 'selecao_reaberta',
          descricao: 'Seleção reaberta pelo fotógrafo',
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['galerias'] });
      toast.success('Seleção reaberta!');
    },
  });

  // Get photo URL helper
  const getPhotoUrl = useCallback(
    (photo: GaleriaPhoto, gallery?: Galeria, size: 'thumbnail' | 'preview' | 'full' = 'preview'): string => {
      const watermark = gallery?.configuracoes?.watermark || null;
      
      if (size === 'thumbnail') {
        return getThumbnailUrl(photo.storageKey, 300);
      }
      
      return getPreviewUrl(photo.storageKey, watermark, size === 'full' ? 1920 : 1200);
    },
    []
  );

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
    sendGallery: sendGalleryMutation.mutateAsync,
    confirmSelection: confirmSelectionMutation.mutateAsync,
    reopenSelection: reopenSelectionMutation.mutateAsync,

    // Helpers
    getPhotoUrl,

    // Loading states
    isCreating: createGalleryMutation.isPending,
    isUpdating: updateGalleryMutation.isPending,
    isDeleting: deleteGalleryMutation.isPending,
  };
}
