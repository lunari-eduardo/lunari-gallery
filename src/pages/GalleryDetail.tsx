import { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  ArrowLeft, 
  Send, 
  Eye,
  FileText,
  User,
  Calendar,
  Image,
  AlertCircle,
  Loader2,
  Pencil,
  Check,
  Clock
} from 'lucide-react';
import { calcularPrecoProgressivo, RegrasCongeladas } from '@/lib/pricingUtils';
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
import { useSupabaseGalleries, GaleriaPhoto } from '@/hooks/useSupabaseGalleries';
import { useSettings } from '@/hooks/useSettings';
import { GalleryPhoto, GalleryAction, WatermarkSettings, Gallery } from '@/types/gallery';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export default function GalleryDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [isCodesModalOpen, setIsCodesModalOpen] = useState(false);
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  
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

  // Transform Supabase photos to GalleryPhoto format (uses Cloudinary)
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
        <h2 className="font-display text-2xl font-semibold mb-2">
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
  
  // Use public_token for client link if available, otherwise show warning
  const hasPublicToken = !!supabaseGallery.publicToken;
  const clientLink = hasPublicToken
    ? `${window.location.origin}/g/${supabaseGallery.publicToken}`
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

  // Check if gallery can be reactivated (supports both 'confirmado' and 'confirmada')
  const canReactivate = supabaseGallery.statusSelecao === 'confirmado' || 
                        supabaseGallery.statusSelecao === 'confirmada' || 
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

  // Build actions timeline
  const actions: GalleryAction[] = [
    {
      id: '1',
      type: 'created',
      timestamp: supabaseGallery.createdAt,
      description: 'Galeria criada',
    },
  ];
  
  if (supabaseGallery.enviadoEm) {
    actions.push({
      id: '2',
      type: 'sent',
      timestamp: supabaseGallery.enviadoEm,
      description: 'Galeria enviada para o cliente',
    });
  }

  // Calculate progressive pricing for summary
  const regrasCongeladas = supabaseGallery.regrasCongeladas as RegrasCongeladas | null;
  const extraCount = Math.max(0, supabaseGallery.fotosSelecionadas - supabaseGallery.fotosIncluidas);
  const { valorUnitario, valorTotal: calculatedExtraTotal, economia } = calcularPrecoProgressivo(
    extraCount,
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
    selectionStatus: supabaseGallery.statusSelecao === 'confirmada' ? 'confirmed' : 'in_progress',
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
    extraCount,
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
              <h1 className="font-display text-2xl md:text-3xl font-semibold">
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
                  const { error } = await supabase
                    .from('galerias')
                    .update({ status_pagamento: 'pago' })
                    .eq('id', supabaseGallery.id);
                  
                  if (error) throw error;
                  
                  toast.success('Pagamento confirmado!', {
                    description: 'A galeria foi liberada para o cliente.',
                  });
                  
                  // Refetch gallery
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
                    watermark={watermark}
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
            <div className="lg:col-span-2">
              {selectedPhotos.length > 0 ? (
                <MasonryGrid>
                  {selectedPhotos.map((photo, index) => (
                    <MasonryItem key={photo.id}>
                      <PhotoCard
                        photo={photo}
                        watermark={watermark}
                        isSelected={true}
                        allowComments={supabaseGallery.configuracoes?.allowComments ?? true}
                        disabled
                        onSelect={() => {}}
                        onViewFullscreen={() => setLightboxIndex(transformedPhotos.findIndex(p => p.id === photo.id))}
                      />
                    </MasonryItem>
                  ))}
                </MasonryGrid>
              ) : (
                <div className="text-center py-16 lunari-card">
                  <Image className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    Nenhuma foto selecionada ainda
                  </p>
                </div>
              )}
            </div>

            <div>
              <SelectionSummary gallery={galleryForSummary} regrasCongeladas={regrasCongeladas} />

              {selectedPhotos.length > 0 && (
                <Button 
                  variant="terracotta" 
                  className="w-full mt-4"
                  onClick={() => setIsCodesModalOpen(true)}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Códigos para separação das fotos
                </Button>
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
                  <span className="font-medium">R$ {supabaseGallery.valorFotoExtra.toFixed(2)}</span>
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
          watermark={watermark}
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
