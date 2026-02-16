import { useState, useMemo, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  ArrowLeft, 
  Send, 
  Eye,
  EyeOff,
  FileText,
  User,
  Calendar,
  Image,
  AlertCircle,
  Loader2,
  Pencil,
  Check,
  Clock,
  RefreshCw,
  MessageSquare,
  Heart
} from 'lucide-react';
import { calcularPrecoProgressivoComCredito, RegrasCongeladas } from '@/lib/pricingUtils';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MasonryGrid, MasonryItem } from '@/components/MasonryGrid';
import { PhotoCard } from '@/components/PhotoCard';
import { Lightbox } from '@/components/Lightbox';
import { StatusBadge } from '@/components/StatusBadge';
import { ActionTimeline } from '@/components/ActionTimeline';
import { SelectionSummary } from '@/components/SelectionSummary';
import { PhotoCodesModal } from '@/components/PhotoCodesModal';
import { DeleteGalleryDialog } from '@/components/DeleteGalleryDialog';
import { SendGalleryModal } from '@/components/SendGalleryModal';
import { ReactivateGalleryDialog } from '@/components/ReactivateGalleryDialog';
import { PaymentStatusCard } from '@/components/PaymentStatusCard';
import { PaymentHistoryCard } from '@/components/PaymentHistoryCard';
import { useSupabaseGalleries, GaleriaPhoto } from '@/hooks/useSupabaseGalleries';
import { useSettings } from '@/hooks/useSettings';
import { GalleryPhoto, GalleryAction, WatermarkSettings, Gallery } from '@/types/gallery';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getGalleryUrl } from '@/lib/galleryUrl';

// Polling interval for pending payments (30 seconds)
const PAYMENT_POLL_INTERVAL = 30000;

export default function GalleryDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [isCodesModalOpen, setIsCodesModalOpen] = useState(false);
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [showSelectedPhotos, setShowSelectedPhotos] = useState(false);
  const [codesFilter, setCodesFilter] = useState<'all' | 'favorites'>('all');
  
  // Get settings for email templates
  const { settings } = useSettings();
  
  // Only use Supabase
  const { 
    getGallery: getSupabaseGallery, 
    fetchGalleryPhotos, 
    sendGallery: sendSupabaseGallery,
    reopenSelection: reopenSupabaseSelection,
    deleteGallery: deleteSupabaseGallery,
    getPhotoUrl,
    isLoading: isSupabaseLoading 
  } = useSupabaseGalleries();

  // Get Supabase gallery
  const supabaseGallery = getSupabaseGallery(id || '');
  
  // Fetch photos for Supabase gallery
  const { data: supabasePhotos = [], isLoading: isLoadingPhotos } = useQuery({
    queryKey: ['galeria-fotos', id],
    queryFn: () => fetchGalleryPhotos(id!),
    enabled: !!supabaseGallery && !!id,
  });

  // Fetch gallery actions from database for timeline
  const { data: galleryActions = [] } = useQuery({
    queryKey: ['galeria-acoes', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('galeria_acoes')
        .select('id, tipo, descricao, created_at')
        .eq('galeria_id', id!)
        .order('created_at', { ascending: true });
      
      if (error) {
        console.error('Error fetching gallery actions:', error);
        return [];
      }
      return data || [];
    },
    enabled: !!id,
  });

  // Fetch ALL paid cobrancas for payment history
  const { data: cobrancasPagas = [], refetch: refetchCobrancas } = useQuery({
    queryKey: ['galeria-cobrancas-pagas', id],
    queryFn: async () => {
      const results: any[] = [];
      
      // Fetch by galeria_id
      if (id) {
        const { data: byGaleria } = await supabase
          .from('cobrancas')
          .select('id, valor, qtd_fotos, provedor, data_pagamento, ip_receipt_url, ip_checkout_url, status, created_at')
          .eq('galeria_id', id)
          .eq('status', 'pago')
          .order('created_at', { ascending: false });
        if (byGaleria) results.push(...byGaleria);
      }
      
      // Also fetch by session_id if available
      const sessionId = supabaseGallery?.sessionId;
      if (sessionId) {
        const { data: bySession } = await supabase
          .from('cobrancas')
          .select('id, valor, qtd_fotos, provedor, data_pagamento, ip_receipt_url, ip_checkout_url, status, created_at')
          .eq('session_id', sessionId)
          .eq('status', 'pago')
          .order('created_at', { ascending: false });
        if (bySession) results.push(...bySession);
      }
      
      // Deduplicate by id
      const uniqueMap = new Map();
      results.forEach(r => uniqueMap.set(r.id, r));
      return Array.from(uniqueMap.values()).sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    },
    enabled: !!supabaseGallery,
  });

  // Fetch latest pending cobranca for payment status actions
  const { data: cobrancaData, refetch: refetchCobranca } = useQuery({
    queryKey: ['galeria-cobranca-pendente', id],
    queryFn: async () => {
      const sessionId = supabaseGallery?.sessionId;
      
      // First try by galeria_id
      if (id) {
        const { data } = await supabase
          .from('cobrancas')
          .select('*')
          .eq('galeria_id', id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data) return data;
      }
      
      // Fallback to session_id
      if (sessionId) {
        const { data } = await supabase
          .from('cobrancas')
          .select('*')
          .eq('session_id', sessionId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        return data;
      }
      
      return null;
    },
    enabled: !!supabaseGallery,
  });

  // Check payment status via edge function
  const checkPaymentStatus = useCallback(async () => {
    if (!cobrancaData?.id) return;
    
    try {
      console.log('[Polling] Checking payment status for cobranca:', cobrancaData.id);
      
      const { data, error } = await supabase.functions.invoke('check-payment-status', {
        body: { 
          cobrancaId: cobrancaData.id,
          forceUpdate: false 
        }
      });
      
      if (error) {
        console.error('[Polling] Error checking payment:', error);
        return;
      }
      
      if (data?.status === 'pago' && cobrancaData.status !== 'pago') {
        console.log('[Polling] Payment confirmed! Refreshing data...');
        toast.success('Pagamento confirmado!', {
          description: 'O status foi atualizado automaticamente.',
        });
        
        // Refresh all relevant queries
        queryClient.invalidateQueries({ queryKey: ['galerias'] });
        queryClient.invalidateQueries({ queryKey: ['galeria-cobranca'] });
        refetchCobranca();
      }
    } catch (err) {
      console.error('[Polling] Exception:', err);
    }
  }, [cobrancaData?.id, cobrancaData?.status, queryClient, refetchCobranca]);

  // Automatic polling for pending InfinitePay/MercadoPago payments
  useEffect(() => {
    const isPendingExternalPayment = 
      cobrancaData?.status === 'pendente' && 
      (cobrancaData?.provedor === 'infinitepay' || cobrancaData?.provedor === 'mercadopago');
    
    if (!isPendingExternalPayment) {
      return;
    }
    
    console.log('[Polling] Starting automatic payment status polling every 30s');
    
    // Check immediately once
    checkPaymentStatus();
    
    // Then set up interval
    const interval = setInterval(checkPaymentStatus, PAYMENT_POLL_INTERVAL);
    
    return () => {
      console.log('[Polling] Stopping automatic payment status polling');
      clearInterval(interval);
    };
  }, [cobrancaData?.status, cobrancaData?.provedor, checkPaymentStatus]);

  // Transform Supabase photos to GalleryPhoto format (uses R2 for previews, B2 for originals)
  const transformedPhotos: GalleryPhoto[] = useMemo(() => {
    return supabasePhotos.map((photo: GaleriaPhoto, index: number) => ({
      id: photo.id,
      filename: photo.filename,
      originalFilename: photo.originalFilename || photo.filename,
      thumbnailUrl: getPhotoUrl(photo, supabaseGallery, 'thumbnail'),
      previewUrl: getPhotoUrl(photo, supabaseGallery, 'preview'),
      originalUrl: getPhotoUrl(photo, supabaseGallery, 'full'),
      width: photo.width,
      height: photo.height,
      isSelected: photo.isSelected,
      isFavorite: photo.isFavorite ?? false,
      comment: photo.comment || undefined,
      order: photo.orderIndex || index,
    }));
  }, [supabasePhotos, supabaseGallery, getPhotoUrl]);

  // Build actions timeline from database
  const actions: GalleryAction[] = useMemo(() => {
    // Map database action types to component types
    const typeMap: Record<string, GalleryAction['type']> = {
      'criada': 'created',
      'enviada': 'sent',
      'cliente_acessou': 'client_started',
      'cliente_confirmou': 'client_confirmed',
      'selecao_reaberta': 'selection_reopened',
      'pagamento_confirmado': 'client_confirmed',
    };
    
    // Filter relevant action types for main timeline
    const relevantTypes = ['criada', 'enviada', 'cliente_acessou', 'cliente_confirmou', 'selecao_reaberta', 'pagamento_confirmado'];
    
    return galleryActions
      .filter((action: { tipo: string }) => relevantTypes.includes(action.tipo))
      .map((action: { id: string; tipo: string; descricao: string | null; created_at: string }) => ({
        id: action.id,
        type: typeMap[action.tipo] || 'created',
        timestamp: new Date(action.created_at),
        description: action.descricao || action.tipo,
      }));
  }, [galleryActions]);
  // Combined loading state
  const isLoadingData = isSupabaseLoading || isLoadingPhotos;

  // Show loading state while galleries are being loaded
  if (isLoadingData) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">Carregando galeria...</p>
        </div>
      </div>
    );
  }

  // Gallery not found
  if (!supabaseGallery) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-2xl font-bold mb-2">
          Galeria não encontrada
        </h2>
        <p className="text-muted-foreground mb-4">
          A galeria solicitada não existe ou foi removida.
        </p>
        <Button variant="outline" onClick={() => navigate('/')}>
          Voltar ao Dashboard
        </Button>
      </div>
    );
  }

  const selectedPhotos = transformedPhotos.filter(p => p.isSelected);
  const favoritePhotos = selectedPhotos.filter(p => p.isFavorite);
  const photosWithComments = selectedPhotos.filter(p => p.comment);
  
  // Use public_token for client link if available, otherwise show warning
  const hasPublicToken = !!supabaseGallery.publicToken;
  const clientLink = hasPublicToken
    ? getGalleryUrl(supabaseGallery.publicToken)
    : null;
  
  // Calculate deadline
  const deadline = supabaseGallery.prazoSelecao || 
    new Date(supabaseGallery.createdAt.getTime() + (supabaseGallery.prazoSelecaoDias || 7) * 24 * 60 * 60 * 1000);

  const handleSendGallery = async () => {
    try {
      await sendSupabaseGallery(supabaseGallery.id);
      toast.success('Galeria enviada!', {
        description: `Galeria publicada e pronta para o cliente`,
      });
    } catch (error) {
      console.error('Error sending gallery:', error);
    }
  };

  const handleReopenSelection = async (days: number) => {
    await reopenSupabaseSelection({ id: supabaseGallery.id, days });
  };

  const handleDeleteGallery = async () => {
    await deleteSupabaseGallery(supabaseGallery.id);
    navigate('/');
  };

  // Check if gallery can be reactivated
  const canReactivate = supabaseGallery.statusSelecao === 'selecao_completa' || 
                        supabaseGallery.status === 'selecao_completa' ||
                        supabaseGallery.status === 'expirado' ||
                        supabaseGallery.status === 'expirada' ||
                        supabaseGallery.finalizedAt !== null;

  // Default watermark settings
  const watermark: WatermarkSettings = (supabaseGallery.configuracoes?.watermark as WatermarkSettings) || {
    type: 'standard',
    opacity: 40,
    position: 'center',
  };

  // Map status
  const getStatusDisplay = (status: string): 'created' | 'sent' | 'selection_started' | 'selection_completed' | 'expired' | 'cancelled' => {
    const statusMap: Record<string, 'created' | 'sent' | 'selection_started' | 'selection_completed' | 'expired' | 'cancelled'> = {
      'rascunho': 'created',
      'publicada': 'sent',
      'enviado': 'sent',
      'em_selecao': 'selection_started',
      'selecao_iniciada': 'selection_started',
      'confirmada': 'selection_completed',
      'selecao_completa': 'selection_completed',
      'expirada': 'expired',
      'expirado': 'expired',
      'cancelada': 'cancelled',
    };
    return statusMap[status] || 'created';
  };

  // Calculate progressive pricing for summary using credit system
  const regrasCongeladas = supabaseGallery.regrasCongeladas as RegrasCongeladas | null;
  const extrasNecessarias = Math.max(0, supabaseGallery.fotosSelecionadas - supabaseGallery.fotosIncluidas);
  const extrasPagasTotal = supabaseGallery.totalFotosExtrasVendidas || 0;
  const valorJaPago = supabaseGallery.valorTotalVendido || 0;
  const extrasACobrar = Math.max(0, extrasNecessarias - extrasPagasTotal);
  
  const { valorUnitario, valorACobrar: calculatedExtraTotal, economia } = calcularPrecoProgressivoComCredito(
    extrasACobrar,
    extrasPagasTotal,
    valorJaPago,
    regrasCongeladas,
    supabaseGallery.valorFotoExtra
  );

  // Build gallery object for SelectionSummary
  const galleryForSummary: Gallery = {
    id: supabaseGallery.id,
    clientName: supabaseGallery.clienteNome || 'Cliente',
    clientEmail: supabaseGallery.clienteEmail || '',
    sessionName: supabaseGallery.nomeSessao || 'Sessão',
    packageName: supabaseGallery.nomePacote || '',
    includedPhotos: supabaseGallery.fotosIncluidas,
    extraPhotoPrice: valorUnitario, // Use calculated progressive price
    saleSettings: (supabaseGallery.configuracoes?.saleSettings as Gallery['saleSettings']) || {
      mode: 'sale_without_payment',
      pricingModel: 'fixed',
      chargeType: 'only_extras',
      fixedPrice: supabaseGallery.valorFotoExtra,
      discountPackages: [],
    },
    status: getStatusDisplay(supabaseGallery.status),
    selectionStatus: supabaseGallery.statusSelecao === 'selecao_completa' ? 'confirmed' : 'in_progress',
    settings: {
      welcomeMessage: supabaseGallery.mensagemBoasVindas || '',
      deadline,
      deadlinePreset: 'custom',
      watermark,
      watermarkDisplay: 'all',
      imageResizeOption: 1920,
      allowComments: supabaseGallery.configuracoes?.allowComments ?? true,
      allowDownload: supabaseGallery.configuracoes?.allowDownload ?? false,
      allowExtraPhotos: true,
    },
    photos: transformedPhotos,
    actions,
    createdAt: supabaseGallery.createdAt,
    updatedAt: supabaseGallery.updatedAt,
    selectedCount: supabaseGallery.fotosSelecionadas,
    extraCount: extrasNecessarias,
    extraTotal: calculatedExtraTotal, // Use calculated total
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl md:text-3xl font-bold">
                {supabaseGallery.nomeSessao || 'Galeria'}
              </h1>
              <StatusBadge status={getStatusDisplay(supabaseGallery.status)} />
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <User className="h-4 w-4" />
                {supabaseGallery.clienteNome || 'Cliente'}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {format(deadline, "dd 'de' MMM", { locale: ptBR })}
              </span>
              <span className="flex items-center gap-1">
                <Image className="h-4 w-4" />
                {supabaseGallery.totalFotos} fotos
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {/* Primary Actions */}
          <Button variant="outline" size="sm" asChild>
            <Link to={`/gallery/${supabaseGallery.id}/edit`}>
              <Pencil className="h-4 w-4 mr-2" />
              Editar
            </Link>
          </Button>
          
          <Button variant="outline" size="sm" asChild>
            <Link to={`/gallery/${supabaseGallery.id}/preview`}>
              <Eye className="h-4 w-4 mr-2" />
              Visualizar
            </Link>
          </Button>
          
          {/* Send/Share Button */}
          <Button 
            variant="terracotta" 
            size="sm" 
            onClick={() => setIsSendModalOpen(true)}
          >
            <Send className="h-4 w-4 mr-2" />
            {hasPublicToken ? 'Compartilhar' : 'Enviar para Cliente'}
          </Button>
          
          {canReactivate && (
            <ReactivateGalleryDialog
              galleryName={supabaseGallery.nomeSessao || 'Esta galeria'}
              clientLink={clientLink}
              onReactivate={handleReopenSelection}
            />
          )}
          
          <DeleteGalleryDialog 
            galleryName={supabaseGallery.nomeSessao || 'Esta galeria'}
            onDelete={handleDeleteGallery}
          />
        </div>
      </div>

      {/* PIX Manual Payment Confirmation Banner */}
      {supabaseGallery.statusPagamento === 'aguardando_confirmacao' && (
        <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-200">
                  Aguardando confirmação de pagamento PIX
                </p>
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  Valor: R$ {(supabaseGallery.valorExtras || calculatedExtraTotal).toFixed(2)}
                </p>
              </div>
            </div>
            
            <Button 
              variant="default"
              size="sm"
              onClick={async () => {
                try {
                  const valorExtras = supabaseGallery.valorExtras || calculatedExtraTotal;
                  
                  // Calculate extras to credit (same logic as webhooks)
                  const fotosIncluidas = supabaseGallery.fotosIncluidas || 0;
                  const fotosSelecionadas = supabaseGallery.fotosSelecionadas || 0;
                  const extrasNovas = Math.max(0, fotosSelecionadas - fotosIncluidas);
                  
                  // Get current credit values
                  const extrasAtuais = supabaseGallery.totalFotosExtrasVendidas || 0;
                  const valorAtual = supabaseGallery.valorTotalVendido || 0;
                  
                  // Update gallery with CREDIT SYSTEM increments (replicates webhook logic)
                  const { error } = await supabase
                    .from('galerias')
                    .update({ 
                      status_pagamento: 'pago',
                      total_fotos_extras_vendidas: extrasAtuais + extrasNovas,
                      valor_total_vendido: valorAtual + valorExtras,
                    })
                    .eq('id', supabaseGallery.id);
                  
                  if (error) throw error;
                  
                  // Update clientes_sessoes.valor_pago if session_id exists
                  if (supabaseGallery.sessionId) {
                    const { data: sessao } = await supabase
                      .from('clientes_sessoes')
                      .select('valor_pago')
                      .eq('session_id', supabaseGallery.sessionId)
                      .maybeSingle();
                    
                    if (sessao) {
                      const novoValorPago = (Number(sessao.valor_pago) || 0) + valorExtras;
                      await supabase
                        .from('clientes_sessoes')
                        .update({ valor_pago: novoValorPago })
                        .eq('session_id', supabaseGallery.sessionId);
                    }
                  }
                  
                  toast.success('Pagamento confirmado!', {
                    description: 'A galeria foi liberada para o cliente.',
                  });
                  
                  // Invalidate queries and reload
                  queryClient.invalidateQueries({ queryKey: ['galerias'] });
                  queryClient.invalidateQueries({ queryKey: ['galeria-cobranca'] });
                  window.location.reload();
                } catch (error) {
                  console.error('Error confirming payment:', error);
                  toast.error('Erro ao confirmar pagamento');
                }
              }}
              className="shrink-0"
            >
              <Check className="h-4 w-4 mr-2" />
              Confirmar Recebimento
            </Button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <Tabs defaultValue="selection" className="space-y-6">
        <TabsList>
          <TabsTrigger value="photos">Fotos ({transformedPhotos.length})</TabsTrigger>
          <TabsTrigger value="selection">Seleção ({selectedPhotos.length})</TabsTrigger>
          <TabsTrigger value="details">Detalhes</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="photos" className="space-y-4">
          {transformedPhotos.length > 0 ? (
            <MasonryGrid>
              {transformedPhotos.map((photo, index) => (
                <MasonryItem key={photo.id}>
                  <PhotoCard
                    photo={photo}
                    isSelected={photo.isSelected}
                    allowComments={supabaseGallery.configuracoes?.allowComments ?? true}
                    disabled
                    onSelect={() => {}}
                    onViewFullscreen={() => setLightboxIndex(index)}
                  />
                </MasonryItem>
              ))}
            </MasonryGrid>
          ) : (
            <div className="text-center py-16 lunari-card">
              <Image className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                Nenhuma foto adicionada ainda
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="selection" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-4">
              {/* Resumo com badges */}
              <div className="lunari-card p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-lg font-medium">
                      {selectedPhotos.length} foto{selectedPhotos.length !== 1 ? 's' : ''} selecionada{selectedPhotos.length !== 1 ? 's' : ''}
                    </span>
                    
                    {/* Badges */}
                    <div className="flex items-center gap-2">
                      {favoritePhotos.length > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-medium">
                          <Heart className="h-3 w-3 fill-current" />
                          {favoritePhotos.length} favorita{favoritePhotos.length !== 1 ? 's' : ''}
                        </span>
                      )}
                      
                      {photosWithComments.length > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                          <MessageSquare className="h-3 w-3" />
                          {photosWithComments.length} comentário{photosWithComments.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {selectedPhotos.length > 0 && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setShowSelectedPhotos(!showSelectedPhotos)}
                    >
                      {showSelectedPhotos ? (
                        <>
                          <EyeOff className="h-4 w-4 mr-2" />
                          Ocultar fotos
                        </>
                      ) : (
                        <>
                          <Eye className="h-4 w-4 mr-2" />
                          Ver fotos selecionadas
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
              
              {/* Lista vertical de fotos (expansível) */}
              {showSelectedPhotos && selectedPhotos.length > 0 && (
                <div className="lunari-card divide-y divide-border">
                  {selectedPhotos.map((photo) => (
                    <div 
                      key={photo.id} 
                      className="flex items-start gap-4 p-3 hover:bg-muted/50 transition-colors"
                    >
                      {/* Thumbnail 1:1 */}
                      <div 
                        className="w-16 h-16 rounded overflow-hidden flex-shrink-0 cursor-pointer"
                        onClick={() => setLightboxIndex(transformedPhotos.findIndex(p => p.id === photo.id))}
                      >
                        <img 
                          src={photo.thumbnailUrl} 
                          alt={photo.filename}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm truncate">
                            {photo.originalFilename || photo.filename}
                          </span>
                          {photo.isFavorite && (
                            <Heart className="h-4 w-4 text-red-500 fill-current flex-shrink-0" />
                          )}
                        </div>
                        
                        {photo.comment && (
                          <div className="mt-1 text-sm text-muted-foreground flex items-start gap-2">
                            <MessageSquare className="h-4 w-4 mt-0.5 flex-shrink-0" />
                            <span className="line-clamp-2">{photo.comment}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Empty state */}
              {selectedPhotos.length === 0 && (
                <div className="text-center py-16 lunari-card">
                  <Image className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    Nenhuma foto selecionada ainda
                  </p>
                </div>
              )}
            </div>

            <div>
              {/* Botão de códigos com filtro de favoritas */}
              {selectedPhotos.length > 0 && (
                <div className="mb-4 space-y-2">
                  <Button 
                    variant="terracotta" 
                    className="w-full"
                    onClick={() => {
                      setCodesFilter('all');
                      setIsCodesModalOpen(true);
                    }}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Códigos para separação das fotos
                  </Button>
                  
                  {favoritePhotos.length > 0 && (
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => {
                        setCodesFilter('favorites');
                        setIsCodesModalOpen(true);
                      }}
                    >
                      <Heart className="h-4 w-4 mr-2" />
                      Códigos só das favoritas ({favoritePhotos.length})
                    </Button>
                  )}
                </div>
              )}

              <SelectionSummary 
                gallery={galleryForSummary} 
                regrasCongeladas={regrasCongeladas}
                extrasPagasTotal={extrasPagasTotal}
                extrasACobrar={extrasACobrar}
                valorJaPago={valorJaPago}
              />

              {/* Payment Status Card in Selection tab */}
              {supabaseGallery.statusPagamento && supabaseGallery.statusPagamento !== 'sem_vendas' && (
                <div className="mt-4">
                  <PaymentStatusCard
                    status={supabaseGallery.statusPagamento}
                    provedor={cobrancasPagas[0]?.provedor || cobrancaData?.provedor || (supabaseGallery.statusPagamento === 'aguardando_confirmacao' ? 'pix_manual' : undefined)}
                    valor={supabaseGallery.valorTotalVendido || supabaseGallery.valorExtras || calculatedExtraTotal}
                    dataPagamento={cobrancasPagas[0]?.data_pagamento || cobrancaData?.data_pagamento}
                    receiptUrl={cobrancasPagas[0]?.ip_receipt_url || cobrancaData?.ip_receipt_url}
                    checkoutUrl={cobrancaData?.ip_checkout_url}
                    sessionId={supabaseGallery.sessionId || undefined}
                    cobrancaId={cobrancaData?.id}
                    variant="compact"
                    onStatusUpdated={() => {
                      queryClient.invalidateQueries({ queryKey: ['galerias'] });
                      queryClient.invalidateQueries({ queryKey: ['galeria-cobrancas-pagas'] });
                      queryClient.invalidateQueries({ queryKey: ['galeria-cobranca-pendente'] });
                      refetchCobrancas();
                      refetchCobranca();
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="details">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="lunari-card p-5 space-y-4">
              <h3 className="font-medium">Informações do Cliente</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Nome</span>
                  <span className="font-medium">{supabaseGallery.clienteNome || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email</span>
                  <span className="font-medium">{supabaseGallery.clienteEmail || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sessão</span>
                  <span className="font-medium">{supabaseGallery.nomeSessao || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pacote</span>
                  <span className="font-medium">{supabaseGallery.nomePacote || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fotos incluídas</span>
                  <span className="font-medium">{supabaseGallery.fotosIncluidas}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valor foto extra</span>
                  <span className="font-medium">R$ {valorUnitario.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="lunari-card p-5 space-y-4">
              <h3 className="font-medium">Configurações da Galeria</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Prazo</span>
                  <span className="font-medium">
                    {format(deadline, "dd/MM/yyyy", { locale: ptBR })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Permissão</span>
                  <span className="font-medium capitalize">
                    {supabaseGallery.permissao === 'public' ? 'Pública' : 'Privada'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Modo de cobrança</span>
                  <span className="font-medium">
                    {(supabaseGallery.configuracoes?.saleSettings as { mode?: string } | undefined)?.mode === 'no_sale' && 'Sem cobrança'}
                    {(supabaseGallery.configuracoes?.saleSettings as { mode?: string } | undefined)?.mode === 'sale_with_payment' && 'Pagamento online'}
                    {(supabaseGallery.configuracoes?.saleSettings as { mode?: string } | undefined)?.mode === 'sale_without_payment' && 'Cobrança posterior'}
                    {!(supabaseGallery.configuracoes?.saleSettings as { mode?: string } | undefined)?.mode && 'Cobrança posterior'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Comentários</span>
                  <span className="font-medium">
                    {supabaseGallery.configuracoes?.allowComments ? 'Sim' : 'Não'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Download</span>
                  <span className="font-medium">
                    {supabaseGallery.configuracoes?.allowDownload ? 'Ativado' : 'Desativado'}
                  </span>
                </div>
              </div>
            </div>

            {/* Payment History Card - shows all transactions */}
            {cobrancasPagas.length > 0 && (
              <PaymentHistoryCard
                cobrancas={cobrancasPagas}
                valorTotalPago={supabaseGallery.valorTotalVendido || 0}
                totalFotosExtrasVendidas={supabaseGallery.totalFotosExtrasVendidas || 0}
              />
            )}

            {/* Current Payment Status - for pending payments and actions */}
            {calculatedExtraTotal > 0 && cobrancaData && cobrancaData.status !== 'pago' && (
              <PaymentStatusCard
                status={cobrancaData.status}
                provedor={cobrancaData?.provedor || (supabaseGallery.statusPagamento === 'aguardando_confirmacao' ? 'pix_manual' : undefined)}
                valor={Number(cobrancaData.valor) || 0}
                dataPagamento={cobrancaData?.data_pagamento}
                receiptUrl={cobrancaData?.ip_receipt_url}
                checkoutUrl={cobrancaData?.ip_checkout_url}
                sessionId={supabaseGallery.sessionId || undefined}
                cobrancaId={cobrancaData?.id}
                variant="full"
                showPendingAmount={true}
                onStatusUpdated={() => {
                  queryClient.invalidateQueries({ queryKey: ['galerias'] });
                  queryClient.invalidateQueries({ queryKey: ['galeria-cobrancas-pagas'] });
                  queryClient.invalidateQueries({ queryKey: ['galeria-cobranca-pendente'] });
                  refetchCobrancas();
                  refetchCobranca();
                }}
              />
            )}

            {supabaseGallery.mensagemBoasVindas && (
              <div className="lunari-card p-5 space-y-4 md:col-span-2">
                <h3 className="font-medium">Mensagem de Boas-vindas</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-line">
                  {supabaseGallery.mensagemBoasVindas}
                </p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="history">
          <div className="lunari-card p-5">
            <h3 className="font-medium mb-4">Histórico de Ações</h3>
            <ActionTimeline actions={actions} />
          </div>
        </TabsContent>
      </Tabs>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <Lightbox
          photos={transformedPhotos}
          currentIndex={lightboxIndex}
          allowComments={supabaseGallery.configuracoes?.allowComments ?? true}
          disabled
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
          onSelect={() => {}}
        />
      )}

      {/* Photo Codes Modal */}
      <PhotoCodesModal
        open={isCodesModalOpen}
        onOpenChange={setIsCodesModalOpen}
        photos={transformedPhotos}
        clientName={supabaseGallery.clienteNome || 'Cliente'}
        filter={codesFilter}
      />

      {/* Send Gallery Modal */}
      <SendGalleryModal
        isOpen={isSendModalOpen}
        onOpenChange={setIsSendModalOpen}
        gallery={supabaseGallery}
        settings={settings}
        onSendGallery={handleSendGallery}
      />
    </div>
  );
}
