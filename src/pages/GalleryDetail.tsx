import { useState, useEffect } from 'react';
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
  MessageCircle
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
import { DemoModeCard } from '@/components/DemoModeCard';
import { useGalleries } from '@/hooks/useGalleries';
import { useGalleryClients } from '@/hooks/useGalleryClients';
import { useSupabaseGalleries, GaleriaPhoto } from '@/hooks/useSupabaseGalleries';
import { GalleryPhoto, GalleryAction, WatermarkSettings } from '@/types/gallery';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';

export default function GalleryDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [isCodesModalOpen, setIsCodesModalOpen] = useState(false);
  
  // Try Supabase first
  const { 
    getGallery: getSupabaseGallery, 
    fetchGalleryPhotos, 
    sendGallery: sendSupabaseGallery,
    reopenSelection: reopenSupabaseSelection,
    getPhotoUrl,
    isLoading: isSupabaseLoading 
  } = useSupabaseGalleries();
  
  // Fallback to localStorage
  const { getGallery, isLoading, sendGallery, reopenSelection, exportGalleryPackage, importGalleryPackage } = useGalleries();
  const { clients } = useGalleryClients();

  // Get Supabase gallery
  const supabaseGallery = getSupabaseGallery(id || '');
  
  // Fetch photos for Supabase gallery
  const { data: supabasePhotos = [], isLoading: isLoadingPhotos } = useQuery({
    queryKey: ['galeria-fotos', id],
    queryFn: () => fetchGalleryPhotos(id!),
    enabled: !!supabaseGallery && !!id,
  });

  // Fallback to localStorage gallery
  const localGallery = getGallery(id || '');
  
  // Determine which gallery to use (Supabase takes priority)
  const isUsingSupabase = !!supabaseGallery;
  const client = localGallery ? clients.find(c => c.email === localGallery.clientEmail) : undefined;

  // Transform Supabase photos to GalleryPhoto format
  const transformedPhotos: GalleryPhoto[] = supabasePhotos.map((photo: GaleriaPhoto, index: number) => ({
    id: photo.id,
    filename: photo.filename,
    originalFilename: photo.originalFilename || photo.filename,
    thumbnailUrl: getPhotoUrl(photo, supabaseGallery, 'thumbnail'),
    previewUrl: getPhotoUrl(photo, supabaseGallery, 'preview'),
    originalUrl: getPhotoUrl(photo, supabaseGallery, 'full'),
    width: photo.width,
    height: photo.height,
    isSelected: photo.isSelected,
    comment: photo.comment || undefined,
    order: photo.orderIndex || index,
  }));

  // Combined loading state
  const isLoadingData = isLoading || isSupabaseLoading || isLoadingPhotos;

  // Show loading state while galleries are being loaded
  if (isLoadingData) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Carregando galeria...</p>
        </div>
      </div>
    );
  }

  // If using Supabase gallery
  if (isUsingSupabase && supabaseGallery) {
    const selectedPhotos = transformedPhotos.filter(p => p.isSelected);
    const clientLink = `${window.location.origin}/client/${supabaseGallery.id}`;
    
    // Calculate deadline
    const deadline = supabaseGallery.prazoSelecao || 
      new Date(supabaseGallery.createdAt.getTime() + (supabaseGallery.prazoSelecaoDias || 7) * 24 * 60 * 60 * 1000);

    const handleCopyLink = () => {
      navigator.clipboard.writeText(clientLink);
      toast.success('Link copiado!');
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
    const getStatusDisplay = (status: string) => {
      const statusMap: Record<string, 'created' | 'sent' | 'selection_started' | 'selection_completed' | 'expired' | 'cancelled'> = {
        'rascunho': 'created',
        'publicada': 'sent',
        'em_selecao': 'selection_started',
        'confirmada': 'selection_completed',
        'expirada': 'expired',
        'cancelada': 'cancelled',
      };
      return statusMap[status] || 'created';
    };

    // Mock actions for timeline
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
            <Button variant="outline" size="sm" onClick={handleCopyLink}>
              <Copy className="h-4 w-4 mr-2" />
              Copiar Link
            </Button>
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

              <div className="lunari-card p-5 space-y-4 h-fit">
                <h3 className="font-medium">Resumo da Seleção</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Fotos incluídas</span>
                    <span className="font-medium">{supabaseGallery.fotosIncluidas}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Selecionadas</span>
                    <span className="font-medium">{supabaseGallery.fotosSelecionadas}</span>
                  </div>
                  {supabaseGallery.fotosSelecionadas > supabaseGallery.fotosIncluidas && (
                    <>
                      <div className="flex justify-between text-primary">
                        <span>Fotos extras</span>
                        <span className="font-medium">
                          {supabaseGallery.fotosSelecionadas - supabaseGallery.fotosIncluidas}
                        </span>
                      </div>
                      <div className="flex justify-between font-medium pt-2 border-t">
                        <span>Total extras</span>
                        <span>R$ {supabaseGallery.valorExtras?.toFixed(2) || '0.00'}</span>
                      </div>
                    </>
                  )}
                </div>
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
      </div>
    );
  }

  // Fallback to localStorage gallery
  if (!localGallery) {
    return (
      <div className="text-center py-16">
        <h2 className="font-display text-2xl font-semibold mb-2">
          Galeria não encontrada
        </h2>
        <Button variant="outline" onClick={() => navigate('/')}>
          Voltar ao Dashboard
        </Button>
      </div>
    );
  }

  const selectedPhotos = localGallery.photos.filter(p => p.isSelected);
  const clientLink = `${window.location.origin}/client/${localGallery.id}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(clientLink);
    toast.success('Link copiado!');
  };

  const handleSendGallery = () => {
    if (localGallery) {
      sendGallery(localGallery.id);
      toast.success('Link enviado para o cliente!', {
        description: `Email enviado para ${localGallery.clientEmail}`,
      });
    }
  };

  const handleWhatsAppSend = () => {
    if (!client?.phone) return;
    
    // Format phone number (remove non-digits and ensure country code)
    let phone = client.phone.replace(/\D/g, '');
    if (!phone.startsWith('55')) {
      phone = '55' + phone;
    }
    
    const message = encodeURIComponent(
      `Olá ${localGallery.clientName.split(' ')[0]}! 🎉\n\n` +
      `Suas fotos da sessão "${localGallery.sessionName}" estão prontas para seleção!\n\n` +
      `Acesse sua galeria através do link:\n${clientLink}\n\n` +
      `Qualquer dúvida, estou à disposição!`
    );
    
    window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
  };

  const handleReopenSelection = () => {
    if (localGallery) {
      reopenSelection(localGallery.id);
      toast.success('Seleção reaberta!', {
        description: 'O cliente poderá fazer alterações novamente.',
      });
    }
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
                {localGallery.sessionName}
              </h1>
              <StatusBadge status={localGallery.status} />
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <User className="h-4 w-4" />
                {localGallery.clientName}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {format(localGallery.settings.deadline, "dd 'de' MMM", { locale: ptBR })}
              </span>
              <span className="flex items-center gap-1">
                <Image className="h-4 w-4" />
                {localGallery.photos.length} fotos
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleCopyLink}>
            <Copy className="h-4 w-4 mr-2" />
            Copiar Link
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to={`/gallery/${localGallery.id}/preview`}>
              <Eye className="h-4 w-4 mr-2" />
              Visualizar
            </Link>
          </Button>
          {client?.phone && (
            <Button variant="outline" size="sm" onClick={handleWhatsAppSend}>
              <MessageCircle className="h-4 w-4 mr-2" />
              Enviar no WhatsApp
            </Button>
          )}
          {localGallery.status === 'created' && (
            <Button variant="terracotta" size="sm" onClick={handleSendGallery}>
              <Send className="h-4 w-4 mr-2" />
              Enviar para Cliente
            </Button>
          )}
          {localGallery.selectionStatus === 'confirmed' && (
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
          <TabsTrigger value="photos">Fotos</TabsTrigger>
          <TabsTrigger value="selection">Seleção ({selectedPhotos.length})</TabsTrigger>
          <TabsTrigger value="details">Detalhes</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="photos" className="space-y-4">
          <MasonryGrid>
            {localGallery.photos.map((photo, index) => (
              <MasonryItem key={photo.id}>
                <PhotoCard
                  photo={photo}
                  watermark={localGallery.settings.watermark}
                  isSelected={photo.isSelected}
                  allowComments={localGallery.settings.allowComments}
                  disabled
                  onSelect={() => {}}
                  onViewFullscreen={() => setLightboxIndex(index)}
                />
              </MasonryItem>
            ))}
          </MasonryGrid>
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
                        watermark={localGallery.settings.watermark}
                        isSelected={true}
                        allowComments={localGallery.settings.allowComments}
                        disabled
                        onSelect={() => {}}
                        onViewFullscreen={() => setLightboxIndex(localGallery.photos.findIndex(p => p.id === photo.id))}
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
              <SelectionSummary gallery={localGallery} />

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
            {/* Demo Mode Card - Full Width */}
            <div className="md:col-span-2">
              <DemoModeCard
                galleryId={localGallery.id}
                galleryName={localGallery.sessionName}
                onExport={() => exportGalleryPackage(localGallery.id)}
                onImport={importGalleryPackage}
              />
            </div>

            <div className="lunari-card p-5 space-y-4">
              <h3 className="font-medium">Informações do Cliente</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Nome</span>
                  <span className="font-medium">{localGallery.clientName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email</span>
                  <span className="font-medium">{localGallery.clientEmail}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sessão</span>
                  <span className="font-medium">{localGallery.sessionName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pacote</span>
                  <span className="font-medium">{localGallery.packageName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fotos incluídas</span>
                  <span className="font-medium">{localGallery.includedPhotos}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valor foto extra</span>
                  <span className="font-medium">R$ {localGallery.extraPhotoPrice.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="lunari-card p-5 space-y-4">
              <h3 className="font-medium">Configurações da Galeria</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Prazo</span>
                  <span className="font-medium">
                    {format(localGallery.settings.deadline, "dd/MM/yyyy", { locale: ptBR })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Marca d'água</span>
                  <span className="font-medium capitalize">
                    {localGallery.settings.watermark.type === 'none' ? 'Nenhuma' : localGallery.settings.watermark.type}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tamanho</span>
                  <span className="font-medium">{localGallery.settings.imageResizeOption || 800}px</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Comentários</span>
                  <span className="font-medium">{localGallery.settings.allowComments ? 'Sim' : 'Não'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Download</span>
                  <span className="font-medium">{localGallery.settings.allowDownload ? 'Ativado' : 'Desativado'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fotos extras</span>
                  <span className="font-medium">{localGallery.settings.allowExtraPhotos ? 'Sim' : 'Não'}</span>
                </div>
              </div>
            </div>

            <div className="lunari-card p-5 space-y-4 md:col-span-2">
              <h3 className="font-medium">Mensagem de Boas-vindas</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-line">
                {localGallery.settings.welcomeMessage}
              </p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="history">
          <div className="lunari-card p-5">
            <h3 className="font-medium mb-4">Histórico de Ações</h3>
            <ActionTimeline actions={localGallery.actions} />
          </div>
        </TabsContent>
      </Tabs>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <Lightbox
          photos={localGallery.photos}
          currentIndex={lightboxIndex}
          watermark={localGallery.settings.watermark}
          allowComments={localGallery.settings.allowComments}
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
        photos={localGallery.photos}
        clientName={localGallery.clientName}
      />
    </div>
  );
}