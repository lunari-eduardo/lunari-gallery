import { useState } from 'react';
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
import { useClients } from '@/hooks/useClients';
import { toast } from 'sonner';

export default function GalleryDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [isCodesModalOpen, setIsCodesModalOpen] = useState(false);
  const { getGallery, isLoading, sendGallery, reopenSelection, exportGalleryPackage, importGalleryPackage } = useGalleries();
  const { getClientByEmail } = useClients();

  const gallery = getGallery(id || '');
  const client = gallery ? getClientByEmail(gallery.clientEmail) : undefined;

  // Show loading state while galleries are being loaded
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Carregando galeria...</p>
        </div>
      </div>
    );
  }

  if (!gallery) {
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

  const selectedPhotos = gallery.photos.filter(p => p.isSelected);
  const clientLink = `${window.location.origin}/client/${gallery.id}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(clientLink);
    toast.success('Link copiado!');
  };

  const handleSendGallery = () => {
    if (gallery) {
      sendGallery(gallery.id);
      toast.success('Link enviado para o cliente!', {
        description: `Email enviado para ${gallery.clientEmail}`,
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
      `Olá ${gallery.clientName.split(' ')[0]}! 🎉\n\n` +
      `Suas fotos da sessão "${gallery.sessionName}" estão prontas para seleção!\n\n` +
      `Acesse sua galeria através do link:\n${clientLink}\n\n` +
      `Qualquer dúvida, estou à disposição!`
    );
    
    window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
  };

  const handleReopenSelection = () => {
    if (gallery) {
      reopenSelection(gallery.id);
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
                {gallery.sessionName}
              </h1>
              <StatusBadge status={gallery.status} />
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <User className="h-4 w-4" />
                {gallery.clientName}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {format(gallery.settings.deadline, "dd 'de' MMM", { locale: ptBR })}
              </span>
              <span className="flex items-center gap-1">
                <Image className="h-4 w-4" />
                {gallery.photos.length} fotos
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
            <Link to={`/gallery/${gallery.id}/preview`}>
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
          {gallery.status === 'created' && (
            <Button variant="terracotta" size="sm" onClick={handleSendGallery}>
              <Send className="h-4 w-4 mr-2" />
              Enviar para Cliente
            </Button>
          )}
          {gallery.selectionStatus === 'confirmed' && (
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
            {gallery.photos.map((photo, index) => (
              <MasonryItem key={photo.id}>
                <PhotoCard
                  photo={photo}
                  watermark={gallery.settings.watermark}
                  isSelected={photo.isSelected}
                  allowComments={gallery.settings.allowComments}
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
                        watermark={gallery.settings.watermark}
                        isSelected={true}
                        allowComments={gallery.settings.allowComments}
                        disabled
                        onSelect={() => {}}
                        onViewFullscreen={() => setLightboxIndex(gallery.photos.findIndex(p => p.id === photo.id))}
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
              <SelectionSummary gallery={gallery} />

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
                galleryId={gallery.id}
                galleryName={gallery.sessionName}
                onExport={() => exportGalleryPackage(gallery.id)}
                onImport={importGalleryPackage}
              />
            </div>

            <div className="lunari-card p-5 space-y-4">
              <h3 className="font-medium">Informações do Cliente</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Nome</span>
                  <span className="font-medium">{gallery.clientName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email</span>
                  <span className="font-medium">{gallery.clientEmail}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sessão</span>
                  <span className="font-medium">{gallery.sessionName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pacote</span>
                  <span className="font-medium">{gallery.packageName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fotos incluídas</span>
                  <span className="font-medium">{gallery.includedPhotos}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valor foto extra</span>
                  <span className="font-medium">R$ {gallery.extraPhotoPrice.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="lunari-card p-5 space-y-4">
              <h3 className="font-medium">Configurações da Galeria</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Prazo</span>
                  <span className="font-medium">
                    {format(gallery.settings.deadline, "dd/MM/yyyy", { locale: ptBR })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Marca d'água</span>
                  <span className="font-medium capitalize">
                    {gallery.settings.watermark.type === 'none' ? 'Nenhuma' : gallery.settings.watermark.type}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tamanho</span>
                  <span className="font-medium">{gallery.settings.imageResizeOption || 800}px</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Comentários</span>
                  <span className="font-medium">{gallery.settings.allowComments ? 'Sim' : 'Não'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Download</span>
                  <span className="font-medium">{gallery.settings.allowDownload ? 'Ativado' : 'Desativado'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fotos extras</span>
                  <span className="font-medium">{gallery.settings.allowExtraPhotos ? 'Sim' : 'Não'}</span>
                </div>
              </div>
            </div>

            <div className="lunari-card p-5 space-y-4 md:col-span-2">
              <h3 className="font-medium">Mensagem de Boas-vindas</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-line">
                {gallery.settings.welcomeMessage}
              </p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="history">
          <div className="lunari-card p-5">
            <h3 className="font-medium mb-4">Histórico de Ações</h3>
            <ActionTimeline actions={gallery.actions} />
          </div>
        </TabsContent>
      </Tabs>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <Lightbox
          photos={gallery.photos}
          currentIndex={lightboxIndex}
          watermark={gallery.settings.watermark}
          allowComments={gallery.settings.allowComments}
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
        photos={gallery.photos}
        clientName={gallery.clientName}
      />
    </div>
  );
}
