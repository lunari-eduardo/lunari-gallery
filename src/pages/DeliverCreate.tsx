import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, User, Image, MessageSquare, Check, Upload, Globe, Lock, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { ClientSelect } from '@/components/ClientSelect';
import { ClientModal, ClientFormData } from '@/components/ClientModal';
import { useGalleryClients } from '@/hooks/useGalleryClients';
import { useSettings } from '@/hooks/useSettings';
import { PhotoUploader, UploadedPhoto } from '@/components/PhotoUploader';
import { useSupabaseGalleries } from '@/hooks/useSupabaseGalleries';
import { Client, GalleryPermission } from '@/types/gallery';

const steps = [
  { id: 1, name: 'Dados', icon: User },
  { id: 2, name: 'Fotos', icon: Image },
  { id: 3, name: 'Mensagem', icon: MessageSquare },
];

export default function DeliverCreate() {
  const navigate = useNavigate();
  const { clients, isLoading: isLoadingClients, createClient } = useGalleryClients();
  const { settings } = useSettings();
  const { createGallery, updateGallery, sendGallery } = useSupabaseGalleries();

  const [currentStep, setCurrentStep] = useState(1);

  // Step 1: Data
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [sessionName, setSessionName] = useState('');
  const [galleryPermission, setGalleryPermission] = useState<GalleryPermission>('public');
  const [galleryPassword, setGalleryPassword] = useState('');
  const [expirationDays, setExpirationDays] = useState(30);

  // Step 2: Photos
  const [supabaseGalleryId, setSupabaseGalleryId] = useState<string | null>(null);
  const [isCreatingGallery, setIsCreatingGallery] = useState(false);
  const [uploadedPhotos, setUploadedPhotos] = useState<UploadedPhoto[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Step 3: Message
  const [welcomeMessage, setWelcomeMessage] = useState('');

  // Initialize defaults from settings
  useEffect(() => {
    if (settings) {
      setExpirationDays(settings.defaultExpirationDays || 30);
    }
  }, [settings]);

  const handleClientCreate = async (data: ClientFormData) => {
    const newClient = await createClient(data);
    if (newClient) {
      setSelectedClient(newClient);
      setIsClientModalOpen(false);
    }
  };

  // Create gallery in Supabase when entering step 2
  const ensureGalleryCreated = async () => {
    if (supabaseGalleryId) return supabaseGalleryId;

    setIsCreatingGallery(true);
    try {
      const result = await createGallery({
        clienteId: selectedClient?.id || null,
        clienteNome: selectedClient?.name || null,
        clienteEmail: selectedClient?.email || null,
        nomeSessao: sessionName,
        fotosIncluidas: 0,
        valorFotoExtra: 0,
        permissao: galleryPermission,
        galleryPassword: galleryPermission === 'private' ? galleryPassword : undefined,
        prazoSelecaoDias: expirationDays,
        tipo: 'entrega',
        configuracoes: {
          imageResizeOption: 2560,
          allowDownload: true,
          allowComments: false,
          allowExtraPhotos: false,
          watermark: { type: 'none', opacity: 0, position: 'center' },
          watermarkDisplay: 'none',
        },
      });
      setSupabaseGalleryId(result.id);
      return result.id;
    } catch (error) {
      console.error('Error creating deliver gallery:', error);
      toast.error('Erro ao criar galeria de entrega');
      return null;
    } finally {
      setIsCreatingGallery(false);
    }
  };

  const handleNext = async () => {
    if (currentStep === 1) {
      if (!sessionName.trim()) {
        toast.error('Informe o nome da sessão');
        return;
      }
      if (galleryPermission === 'private' && !galleryPassword.trim()) {
        toast.error('Informe a senha para galeria privada');
        return;
      }
      // Create gallery before going to photos step
      const id = await ensureGalleryCreated();
      if (!id) return;
    }
    if (currentStep === 2 && uploadedPhotos.length === 0) {
      toast.error('Envie pelo menos uma foto');
      return;
    }
    setCurrentStep((prev) => Math.min(prev + 1, steps.length));
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handlePublish = async () => {
    if (!supabaseGalleryId) return;

    try {
      // Update welcome message
      if (welcomeMessage.trim()) {
        await updateGallery({ id: supabaseGalleryId, data: { mensagemBoasVindas: welcomeMessage } });
      }

      // Send/publish gallery
      await sendGallery(supabaseGalleryId);
      toast.success('Galeria de entrega publicada!');
      navigate(`/gallery/${supabaseGalleryId}`);
    } catch (error) {
      console.error('Error publishing deliver gallery:', error);
      toast.error('Erro ao publicar galeria');
    }
  };

  const handleUploadComplete = (photos: UploadedPhoto[]) => {
    setUploadedPhotos((prev) => [...prev, ...photos]);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-semibold">Nova Entrega</h1>
          <p className="text-muted-foreground text-sm">Envie fotos em alta resolução para download</p>
        </div>
      </div>

      {/* Steps */}
      <div className="flex items-center justify-center gap-2 md:gap-4">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isActive = currentStep === step.id;
          const isCompleted = currentStep > step.id;
          return (
            <div key={step.id} className="flex items-center gap-2">
              {index > 0 && (
                <div className={cn('h-px w-6 md:w-12', isCompleted ? 'bg-primary' : 'bg-border')} />
              )}
              <div
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  isActive && 'bg-primary/10 text-primary',
                  isCompleted && 'text-primary',
                  !isActive && !isCompleted && 'text-muted-foreground'
                )}
              >
                {isCompleted ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
                <span className="hidden md:inline">{step.name}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Step Content */}
      <div className="max-w-2xl mx-auto">
        {/* Step 1: Data */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div className="lunari-card p-6 space-y-5">
              <h2 className="font-display text-lg font-semibold">Dados da Entrega</h2>

              {/* Session Name */}
              <div className="space-y-2">
                <Label htmlFor="sessionName">Nome da sessão *</Label>
                <Input
                  id="sessionName"
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  placeholder="Ex: Ensaio Maria - Família"
                />
              </div>

              {/* Client (optional) */}
              <div className="space-y-2">
                <Label>Cliente <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                <ClientSelect
                  clients={clients}
                  selectedClient={selectedClient}
                  onSelect={setSelectedClient}
                  onCreateNew={() => setIsClientModalOpen(true)}
                />
              </div>

              {/* Permission */}
              <div className="space-y-3">
                <Label>Tipo de acesso</Label>
                <RadioGroup
                  value={galleryPermission}
                  onValueChange={(v) => setGalleryPermission(v as GalleryPermission)}
                  className="grid grid-cols-2 gap-3"
                >
                  <Label
                    htmlFor="perm-public"
                    className={cn(
                      'flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors',
                      galleryPermission === 'public' ? 'border-primary bg-primary/5' : 'border-border'
                    )}
                  >
                    <RadioGroupItem value="public" id="perm-public" />
                    <div>
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        <span className="font-medium">Pública</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Acesso pelo link</p>
                    </div>
                  </Label>
                  <Label
                    htmlFor="perm-private"
                    className={cn(
                      'flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors',
                      galleryPermission === 'private' ? 'border-primary bg-primary/5' : 'border-border'
                    )}
                  >
                    <RadioGroupItem value="private" id="perm-private" />
                    <div>
                      <div className="flex items-center gap-2">
                        <Lock className="h-4 w-4" />
                        <span className="font-medium">Privada</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Requer senha</p>
                    </div>
                  </Label>
                </RadioGroup>

                {galleryPermission === 'private' && (
                  <div className="space-y-2 pl-1">
                    <Label htmlFor="password">Senha de acesso</Label>
                    <Input
                      id="password"
                      type="text"
                      value={galleryPassword}
                      onChange={(e) => setGalleryPassword(e.target.value)}
                      placeholder="Defina uma senha"
                    />
                  </div>
                )}
              </div>

              {/* Expiration */}
              <div className="space-y-2">
                <Label htmlFor="expiration" className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Prazo de expiração (dias)
                </Label>
                <Input
                  id="expiration"
                  type="number"
                  min={1}
                  max={365}
                  value={expirationDays}
                  onChange={(e) => setExpirationDays(Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">
                  A galeria ficará disponível por {expirationDays} dias após o envio
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Photos */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div className="lunari-card p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold">Fotos da Entrega</h2>
                {uploadedPhotos.length > 0 && (
                  <span className="text-sm text-muted-foreground">
                    {uploadedPhotos.length} foto(s) enviada(s)
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                As fotos serão armazenadas em alta resolução para download direto pelo cliente.
              </p>
              {supabaseGalleryId && (
                <PhotoUploader
                  galleryId={supabaseGalleryId}
                  maxLongEdge={2560}
                  allowDownload={true}
                  skipCredits={true}
                  onUploadComplete={handleUploadComplete}
                  onUploadingChange={setIsUploading}
                />
              )}
            </div>
          </div>
        )}

        {/* Step 3: Message */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div className="lunari-card p-6 space-y-4">
              <h2 className="font-display text-lg font-semibold">Mensagem de Boas-Vindas</h2>
              <p className="text-sm text-muted-foreground">
                Esta mensagem será exibida quando o cliente acessar a galeria.
              </p>
              <Textarea
                value={welcomeMessage}
                onChange={(e) => setWelcomeMessage(e.target.value)}
                placeholder="Olá! Suas fotos estão prontas para download. Aproveite!"
                rows={5}
              />
            </div>

            {/* Summary */}
            <div className="lunari-card p-6 space-y-3">
              <h3 className="font-display text-base font-semibold">Resumo</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Sessão:</span>
                  <p className="font-medium">{sessionName}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Cliente:</span>
                  <p className="font-medium">{selectedClient?.name || 'Não definido'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Acesso:</span>
                  <p className="font-medium">{galleryPermission === 'public' ? 'Público' : 'Privado'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Fotos:</span>
                  <p className="font-medium">{uploadedPhotos.length}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Expira em:</span>
                  <p className="font-medium">{expirationDays} dias</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between pt-6">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 1}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>

          {currentStep < steps.length ? (
            <Button
              onClick={handleNext}
              disabled={isCreatingGallery || isUploading}
              className="gap-2"
              variant="terracotta"
            >
              Próximo
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={handlePublish}
              disabled={uploadedPhotos.length === 0}
              className="gap-2"
              variant="terracotta"
            >
              <Upload className="h-4 w-4" />
              Publicar Entrega
            </Button>
          )}
        </div>
      </div>

      {/* Client Modal */}
      <ClientModal
        open={isClientModalOpen}
        onOpenChange={setIsClientModalOpen}
        onSave={handleClientCreate}
      />
    </div>
  );
}
