import { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  ArrowLeft, 
  Send, 
  RotateCcw, 
  Copy, 
  Eye,
  FileText,
  User,
  Calendar,
  Image,
  AlertCircle,
  Loader2,
  Lock,
  MessageSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MasonryGrid, MasonryItem } from '@/components/MasonryGrid';
import { PhotoCard } from '@/components/PhotoCard';
import { Lightbox } from '@/components/Lightbox';
import { StatusBadge } from '@/components/StatusBadge';
import { ActionTimeline } from '@/components/ActionTimeline';
import { SelectionSummary } from '@/components/SelectionSummary';
import { PhotoCodesModal } from '@/components/PhotoCodesModal';
import { useSupabaseGalleries, GaleriaPhoto } from '@/hooks/useSupabaseGalleries';
import { useB2Config } from '@/hooks/useB2Config';
import { GalleryPhoto, GalleryAction, WatermarkSettings, Gallery } from '@/types/gallery';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';

export default function GalleryDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [isCodesModalOpen, setIsCodesModalOpen] = useState(false);
  
  // Only use Supabase
  const { 
    getGallery: getSupabaseGallery, 
    fetchGalleryPhotos, 
    sendGallery: sendSupabaseGallery,
    reopenSelection: reopenSupabaseSelection,
    getPhotoUrl,
    isLoading: isSupabaseLoading 
  } = useSupabaseGalleries();

  // Fetch B2 config from backend (dynamic downloadUrl)
  const { data: b2Config, isLoading: isLoadingB2Config } = useB2Config();
  
  // Get Supabase gallery
  const supabaseGallery = getSupabaseGallery(id || '');
  
  // Fetch photos for Supabase gallery
  const { data: supabasePhotos = [], isLoading: isLoadingPhotos } = useQuery({
    queryKey: ['galeria-fotos', id],
    queryFn: () => fetchGalleryPhotos(id!),
    enabled: !!supabaseGallery && !!id,
  });

  // Transform Supabase photos to GalleryPhoto format (requires b2Config)
  const transformedPhotos: GalleryPhoto[] = useMemo(() => {
    const bucketUrl = b2Config?.fullBucketUrl || '';
    if (!bucketUrl) return [];
    
    return supabasePhotos.map((photo: GaleriaPhoto, index: number) => ({
      id: photo.id,
      filename: photo.filename,
      originalFilename: photo.originalFilename || photo.filename,
      thumbnailUrl: getPhotoUrl(photo, supabaseGallery, 'thumbnail', bucketUrl),
      previewUrl: getPhotoUrl(photo, supabaseGallery, 'preview', bucketUrl),
      originalUrl: getPhotoUrl(photo, supabaseGallery, 'full', bucketUrl),
      width: photo.width,
      height: photo.height,
      isSelected: photo.isSelected,
      comment: photo.comment || undefined,
      order: photo.orderIndex || index,
    }));
  }, [supabasePhotos, supabaseGallery, b2Config, getPhotoUrl]);

  // Combined loading state
  const isLoadingData = isSupabaseLoading || isLoadingPhotos || isLoadingB2Config;

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
    ? `${window.location.origin}/gallery/${supabaseGallery.publicToken}`
    : null;
  
  // Calculate deadline
  const deadline = supabaseGallery.prazoSelecao || 
    new Date(supabaseGallery.createdAt.getTime() + (supabaseGallery.prazoSelecaoDias || 7) * 24 * 60 * 60 * 1000);

  const handleCopyLink = () => {
    if (!clientLink) {
      toast.error('Envie a galeria primeiro para gerar o link');
      return;
    }
    navigator.clipboard.writeText(clientLink);
    toast.success('Link copiado!');
  };

  const handleCopyPassword = () => {
    if (supabaseGallery.galleryPassword) {
      navigator.clipboard.writeText(supabaseGallery.galleryPassword);
      toast.success('Senha copiada!');
    }
  };

  const handleCopyWhatsAppMessage = () => {
    if (!clientLink) {
      toast.error('Envie a galeria primeiro');
      return;
    }
    
    let message = `Olá! 🎉\n\nSua galeria de fotos está pronta!\n\n📸 ${supabaseGallery.nomeSessao || 'Sessão de Fotos'}\n\n🔗 Link: ${clientLink}`;
    
    if (supabaseGallery.permissao === 'private' && supabaseGallery.galleryPassword) {
      message += `\n\n🔐 Senha: ${supabaseGallery.galleryPassword}`;
    }
    
    message += `\n\nSelecione suas fotos favoritas com calma! ❤️`;
    
    navigator.clipboard.writeText(message);
    toast.success('Mensagem copiada para WhatsApp!');
  };

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

  const handleReopenSelection = async () => {
    try {
      await reopenSupabaseSelection(supabaseGallery.id);
      toast.success('Seleção reaberta!', {
        description: 'O cliente poderá fazer alterações novamente.',
      });
    } catch (error) {
      console.error('Error reopening selection:', error);
    }
  };

  // Default watermark settings
  const watermark: WatermarkSettings = (supabaseGallery.configuracoes?.watermark as WatermarkSettings) || {
    type: 'none',
    opacity: 30,
    position: 'bottom-right',
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

  // Build gallery object for SelectionSummary
  const galleryForSummary: Gallery = {
    id: supabaseGallery.id,
    clientName: supabaseGallery.clienteNome || 'Cliente',
    clientEmail: supabaseGallery.clienteEmail || '',
    sessionName: supabaseGallery.nomeSessao || 'Sessão',
    packageName: supabaseGallery.nomePacote || '',
    includedPhotos: supabaseGallery.fotosIncluidas,
    extraPhotoPrice: supabaseGallery.valorFotoExtra,
    saleSettings: {
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
    extraCount: Math.max(0, supabaseGallery.fotosSelecionadas - supabaseGallery.fotosIncluidas),
    extraTotal: supabaseGallery.valorExtras,
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
          {hasPublicToken && (
            <>
              <Button variant="outline" size="sm" onClick={handleCopyLink}>
                <Copy className="h-4 w-4 mr-2" />
                Copiar Link
              </Button>
              {supabaseGallery.permissao === 'private' && supabaseGallery.galleryPassword && (
                <Button variant="outline" size="sm" onClick={handleCopyPassword}>
                  <Lock className="h-4 w-4 mr-2" />
                  Copiar Senha
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleCopyWhatsAppMessage}>
                <MessageSquare className="h-4 w-4 mr-2" />
                Mensagem WhatsApp
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" asChild>
            <Link to={`/gallery/${supabaseGallery.id}/preview`}>
              <Eye className="h-4 w-4 mr-2" />
              Visualizar
            </Link>
          </Button>
          {supabaseGallery.status === 'rascunho' && (
            <Button variant="terracotta" size="sm" onClick={handleSendGallery}>
              <Send className="h-4 w-4 mr-2" />
              Enviar para Cliente
            </Button>
          )}
          {supabaseGallery.statusSelecao === 'confirmada' && (
            <Button variant="outline" size="sm" onClick={handleReopenSelection}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Reabrir Seleção
            </Button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="photos" className="space-y-6">
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
              <SelectionSummary gallery={galleryForSummary} />

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
    </div>
  );
}
