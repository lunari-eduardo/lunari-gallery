import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, User, Image, MessageSquare, Check, Upload, Globe, Lock, Calendar, Sun, Moon, Plus, HardDrive, ArrowUpCircle, Trash2, Palette } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import { ClientSelect } from '@/components/ClientSelect';
import { ClientModal, ClientFormData } from '@/components/ClientModal';
import { useGalleryClients } from '@/hooks/useGalleryClients';
import { useSettings } from '@/hooks/useSettings';
import { useGallerySettings } from '@/hooks/useGallerySettings';
import { PhotoUploader, UploadedPhoto } from '@/components/PhotoUploader';
import { useSupabaseGalleries } from '@/hooks/useSupabaseGalleries';
import { Client, GalleryPermission, TitleCaseMode } from '@/types/gallery';
import { FontSelect } from '@/components/FontSelect';
import { DeliverPhotoManager } from '@/components/deliver/DeliverPhotoManager';
import { FolderManager } from '@/components/FolderManager';
import { useTransferStorage } from '@/hooks/useTransferStorage';
import { formatStorageSize } from '@/lib/transferPlans';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { ThemeCatalog } from '@/components/dashboard/themes/ThemeCatalog';
import { DEFAULT_THEME_ID } from '@/components/gallery/themes/registry';

const steps = [
  { id: 1, name: 'Dados', icon: User },
  { id: 2, name: 'Fotos', icon: Image },
  { id: 3, name: 'Mensagem', icon: MessageSquare },
];

export default function DeliverCreate() {
  const navigate = useNavigate();
  const { clients, isLoading: isLoadingClients, createClient } = useGalleryClients();
  const { settings, updateSettings } = useSettings();
  const { settings: gallerySettings } = useGallerySettings();
  const { createGallery, updateGallery, publishGallery } = useSupabaseGalleries();
  const { canCreateTransfer, isAdmin, isLoading: isLoadingStorage, storageUsedBytes, storageLimitBytes, storageUsedPercent, hasTransferPlan, planName } = useTransferStorage();

  const [currentStep, setCurrentStep] = useState(1);

  // Step 1: Data
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [sessionName, setSessionName] = useState('');
  const [galleryPermission, setGalleryPermission] = useState<GalleryPermission>('public');
  const [galleryPassword, setGalleryPassword] = useState('');
  const [expirationDays, setExpirationDays] = useState(30);

  // Font & case
  const [sessionFont, setSessionFont] = useState('playfair');
  const [titleCaseMode, setTitleCaseMode] = useState<TitleCaseMode>('normal');

  // Theme
  const [clientMode, setClientMode] = useState<'light' | 'dark'>('dark');

  // Step 2: Photos
  const [supabaseGalleryId, setSupabaseGalleryId] = useState<string | null>(null);
  const [isCreatingGallery, setIsCreatingGallery] = useState(false);
  const [uploadedPhotos, setUploadedPhotos] = useState<UploadedPhoto[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [photoRefreshKey, setPhotoRefreshKey] = useState(0);
  const [coverPhotoId, setCoverPhotoId] = useState<string | null>(null);
  const [photoCount, setPhotoCount] = useState(0);

  // Folder management
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);

  // Step 3: Message
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [welcomeMessageEnabled, setWelcomeMessageEnabled] = useState(true);
  const [photoSpacing, setPhotoSpacing] = useState(6);
  const [useCustomTheme, setUseCustomTheme] = useState(false);
  const [activeThemeId, setActiveThemeId] = useState<string>(DEFAULT_THEME_ID);
  const [themeOverrides, setThemeOverrides] = useState<any>({});

  // Initialize defaults from settings
  useEffect(() => {
    if (settings) {
      setExpirationDays(settings.defaultExpirationDays || 30);
      if (settings.lastSessionFont) {
        setSessionFont(settings.lastSessionFont);
      }
      if (settings.clientTheme === 'light') {
        setClientMode('light');
      } else {
        setClientMode('dark');
      }
      if (settings.defaultPhotoSpacing !== undefined) {
        setPhotoSpacing(settings.defaultPhotoSpacing);
      }
    }
  }, [settings]);

  // Initialize welcome toggle from global settings (but don't pre-fill text)
  useEffect(() => {
    if (gallerySettings) {
      const globalEnabled = gallerySettings.welcomeMessageEnabled ?? true;
      setWelcomeMessageEnabled(globalEnabled);
    }
  }, [gallerySettings]);

  // If storage check is loading, show skeleton
  if (isLoadingStorage) {
    return (
      <div className="max-w-5xl mx-auto py-16 flex items-center justify-center">
        <Skeleton className="h-32 w-full max-w-md" />
      </div>
    );
  }

  // Block creation if over limit
  if (!canCreateTransfer) {
    return (
      <div className="max-w-lg mx-auto py-16 space-y-6 text-center animate-fade-in">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto">
          <HardDrive className="h-8 w-8 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">
            {hasTransferPlan ? 'Armazenamento esgotado' : 'Sem plano Transfer ativo'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {hasTransferPlan
              ? 'Você atingiu o limite do seu plano. Faça upgrade ou exclua galerias para liberar espaço.'
              : 'Você precisa de um plano Transfer para criar galerias de entrega.'}
          </p>
        </div>

        {hasTransferPlan && (
          <div className="space-y-2 max-w-xs mx-auto">
            <Progress value={storageUsedPercent} className="h-2.5" />
            <p className="text-xs text-muted-foreground">
              {formatStorageSize(storageUsedBytes)} de {formatStorageSize(storageLimitBytes)} usados
              {planName && <span className="ml-1">· {planName}</span>}
            </p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Button onClick={() => navigate('/credits/checkout')} className="gap-2">
            <ArrowUpCircle className="h-4 w-4" />
            {hasTransferPlan ? 'Fazer Upgrade' : 'Ver Planos'}
          </Button>
          {hasTransferPlan && (
            <Button variant="outline" onClick={() => navigate('/galleries/deliver')} className="gap-2">
              <Trash2 className="h-4 w-4" />
              Gerenciar Galerias
            </Button>
          )}
        </div>
      </div>
    );
  }

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
            sessionFont,
            titleCaseMode,
            clientMode,
            photoSpacing,
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
      const id = await ensureGalleryCreated();
      if (!id) return;
    }
    if (currentStep === 2 && photoCount === 0 && uploadedPhotos.length === 0) {
      toast.error('Envie pelo menos uma foto');
      return;
    }
    setCurrentStep((prev) => Math.min(prev + 1, steps.length));
  };

  const handleBack = () => {
    if (currentStep === 1) {
      navigate('/');
    } else {
      setCurrentStep((prev) => Math.max(prev - 1, 1));
    }
  };

  const handlePublish = async () => {
    if (!supabaseGalleryId) return;

    try {
      // Update gallery with final settings
      await updateGallery({
        id: supabaseGalleryId,
        data: {
          mensagemBoasVindas: welcomeMessageEnabled ? (welcomeMessage.trim() || undefined) : undefined,
          configuracoes: {
            imageResizeOption: 2560,
            allowDownload: true,
            allowComments: false,
            allowExtraPhotos: false,
            watermark: { type: 'none', opacity: 0, position: 'center' },
            watermarkDisplay: 'none',
            sessionFont,
            titleCaseMode,
            coverPhotoId: coverPhotoId || undefined,
            clientMode,
            photoSpacing,
          },
        },
      });

      // Persist last used font
      updateSettings({ lastSessionFont: sessionFont });

      // Publish gallery (generate token) without marking as "sent"
      await publishGallery(supabaseGalleryId);
      navigate(`/deliver/${supabaseGalleryId}`);
    } catch (error) {
      console.error('Error publishing deliver gallery:', error);
      toast.error('Erro ao publicar galeria');
    }
  };

  const handleUploadComplete = (photos: UploadedPhoto[]) => {
    setUploadedPhotos((prev) => [...prev, ...photos]);
    setPhotoRefreshKey((k) => k + 1);
  };

  const handleCoverChange = async (photoId: string | null) => {
    setCoverPhotoId(photoId);
    // Persist immediately if gallery exists
    if (supabaseGalleryId) {
      try {
        const { data: gallery } = await (await import('@/integrations/supabase/client')).supabase
          .from('galerias')
          .select('configuracoes')
          .eq('id', supabaseGalleryId)
          .single();

        const existingConfig = (gallery?.configuracoes as Record<string, unknown>) || {};
        await updateGallery({
          id: supabaseGalleryId,
          data: {
            configuracoes: {
              ...existingConfig,
              coverPhotoId: photoId,
            },
          },
        });
      } catch (e) {
        console.error('Error saving cover photo:', e);
      }
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6 animate-fade-in">
            <p className="text-muted-foreground text-lg">
              Dados da entrega e detalhes da sessão
            </p>

            {/* Gallery Permission */}
            <div className="space-y-4">
              <Label className="text-base font-medium">Permissão da Galeria</Label>
              <RadioGroup
                value={galleryPermission}
                onValueChange={(v) => {
                  setGalleryPermission(v as GalleryPermission);
                  if (v === 'public') {
                    setSelectedClient(null);
                  }
                }}
                className="grid grid-cols-2 gap-4"
              >
                <div>
                  <RadioGroupItem value="public" id="gallery-public" className="peer sr-only" />
                  <Label
                    htmlFor="gallery-public"
                    className={cn(
                      'flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all',
                      'hover:border-primary/50 hover:bg-muted/50',
                      galleryPermission === 'public' ? 'border-primary bg-primary/5' : 'border-border'
                    )}
                  >
                    <Globe className={cn('h-5 w-5', galleryPermission === 'public' ? 'text-primary' : 'text-muted-foreground')} />
                    <div>
                      <p className="font-medium">Pública</p>
                      <p className="text-xs text-muted-foreground">Sem senha</p>
                    </div>
                  </Label>
                </div>
                <div>
                  <RadioGroupItem value="private" id="gallery-private" className="peer sr-only" />
                  <Label
                    htmlFor="gallery-private"
                    className={cn(
                      'flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all',
                      'hover:border-primary/50 hover:bg-muted/50',
                      galleryPermission === 'private' ? 'border-primary bg-primary/5' : 'border-border'
                    )}
                  >
                    <Lock className={cn('h-5 w-5', galleryPermission === 'private' ? 'text-primary' : 'text-muted-foreground')} />
                    <div>
                      <p className="font-medium">Privada</p>
                      <p className="text-xs text-muted-foreground">Requer senha</p>
                    </div>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Client Section - Only show for private galleries */}
            {galleryPermission === 'private' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="flex-1 space-y-2">
                    <Label>Cliente <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                    {isLoadingClients ? (
                      <div className="h-10 rounded-md border border-input bg-muted animate-pulse" />
                    ) : (
                      <ClientSelect
                        clients={clients}
                        selectedClient={selectedClient}
                        onSelect={setSelectedClient}
                        onCreateNew={() => setIsClientModalOpen(true)}
                      />
                    )}
                  </div>
                  <div className="pt-6">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setIsClientModalOpen(true)}
                      disabled={isLoadingClients}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-2">
                  <Label htmlFor="password">Senha de acesso</Label>
                  <Input
                    id="password"
                    type="text"
                    value={galleryPassword}
                    onChange={(e) => setGalleryPassword(e.target.value)}
                    placeholder="Defina uma senha"
                  />
                </div>
              </div>
            )}

            {/* Session Name + Expiration - 2 columns */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="sessionName">Nome da sessão *</Label>
                <Input
                  id="sessionName"
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  placeholder="Ex: Ensaio Maria - Família"
                />
              </div>
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
                  Disponível por {expirationDays} dias após o envio
                </p>
              </div>
            </div>

            {/* Font Select */}
            <div className="space-y-2">
              <Label>Fonte do Título</Label>
              <FontSelect
                value={sessionFont}
                onChange={setSessionFont}
                previewText={sessionName || 'Ensaio Gestante'}
                titleCaseMode={titleCaseMode}
                onTitleCaseModeChange={setTitleCaseMode}
              />
            </div>

            {/* Photo Spacing */}
            <div className="space-y-6 pt-4 border-t">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Palette className="h-4 w-4 text-primary" />
                  <Label className="text-base font-medium">Tema da Galeria</Label>
                </div>
                
                <div className="grid grid-cols-2 gap-3 max-w-md">
                  <div 
                    className={cn(
                      "p-3 border rounded-xl cursor-pointer transition-all text-center",
                      !useCustomTheme ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-muted"
                    )}
                    onClick={() => setUseCustomTheme(false)}
                  >
                    <p className="font-medium text-sm">Herdar Padrão</p>
                    <p className="text-[10px] text-muted-foreground">Configurações da conta</p>
                  </div>
                  <div 
                    className={cn(
                      "p-3 border rounded-xl cursor-pointer transition-all text-center",
                      useCustomTheme ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-muted"
                    )}
                    onClick={() => setUseCustomTheme(true)}
                  >
                    <p className="font-medium text-sm">Personalizar</p>
                    <p className="text-[10px] text-muted-foreground">Estilo exclusivo</p>
                  </div>
                </div>

                {useCustomTheme && (
                  <div className="pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
                    <ThemeCatalog 
                      selectedThemeId={activeThemeId} 
                      onSelect={setActiveThemeId} 
                      onThemeOverridesChange={setThemeOverrides}
                      initialOverrides={themeOverrides}
                    />
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-medium">Espaçamento (Grid)</Label>
                  <span className="text-sm font-mono">{useCustomTheme ? (themeOverrides?.layout?.gap ?? 8) : photoSpacing}px</span>
                </div>
                <div className="max-w-sm">
                  <Slider
                    value={[useCustomTheme ? (themeOverrides?.layout?.gap ?? 8) : photoSpacing]}
                    onValueChange={(vals) => {
                      if (useCustomTheme) {
                        setThemeOverrides({
                          ...themeOverrides,
                          layout: { ...(themeOverrides.layout || {}), gap: vals[0] }
                        });
                      } else {
                        setPhotoSpacing(vals[0]);
                      }
                    }}
                    min={0}
                    max={40}
                    step={1}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  {clientMode === 'dark' ? <Moon className="h-4 w-4 text-primary" /> : <Sun className="h-4 w-4 text-primary" />}
                  <Label className="text-base font-medium">Modo de Cor</Label>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={clientMode === 'light' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setClientMode('light')}
                    className="gap-1 rounded-full"
                  >
                    <Sun className="h-3.5 w-3.5" />
                    Claro
                  </Button>
                  <Button
                    type="button"
                    variant={clientMode === 'dark' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setClientMode('dark')}
                    className="gap-1 rounded-full"
                  >
                    <Moon className="h-3.5 w-3.5" />
                    Escuro
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground text-lg">
                Fotos da Entrega
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              As fotos serão armazenadas em alta resolução para download direto pelo cliente.
            </p>

            {/* Folder Manager */}
            {supabaseGalleryId && (
              <FolderManager
                galleryId={supabaseGalleryId}
                activeFolderId={activeFolderId}
                onActiveFolderChange={setActiveFolderId}
              />
            )}

            {supabaseGalleryId && (
              <>
                <PhotoUploader
                  galleryId={supabaseGalleryId}
                  folderId={activeFolderId}
                  maxLongEdge={2560}
                  allowDownload={true}
                  skipCredits={true}
                  storageLimit={storageLimitBytes}
                  storageUsed={storageUsedBytes}
                  onUploadComplete={handleUploadComplete}
                  onUploadingChange={setIsUploading}
                />
                <DeliverPhotoManager
                  galleryId={supabaseGalleryId}
                  refreshKey={photoRefreshKey}
                  coverPhotoId={coverPhotoId}
                  onCoverChange={handleCoverChange}
                  onPhotosChange={setPhotoCount}
                />
              </>
            )}
          </div>
        );

      case 3:
        return (
          <div className="space-y-6 animate-fade-in">
            <div>
              <p className="text-muted-foreground text-lg mb-1">Mensagem de Boas-Vindas</p>
              <p className="text-sm text-muted-foreground">
                Esta mensagem será exibida quando o cliente acessar a galeria.
              </p>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="welcome-toggle" className="text-sm font-medium">Ativar mensagem de boas-vindas</Label>
              <Switch
                id="welcome-toggle"
                checked={welcomeMessageEnabled}
                onCheckedChange={(checked) => {
                  setWelcomeMessageEnabled(checked);
                  if (!checked) setWelcomeMessage('');
                }}
              />
            </div>

            {welcomeMessageEnabled && (
              <Textarea
                value={welcomeMessage}
                onChange={(e) => setWelcomeMessage(e.target.value)}
                placeholder="Olá! Suas fotos estão prontas para download. Aproveite!"
                rows={8}
                className="min-h-[200px]"
              />
            )}

            {/* Summary */}
            <div className="p-4 rounded-lg bg-muted/50 space-y-3">
              <h3 className="text-base font-semibold">Resumo</h3>
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
                  <p className="font-medium">{photoCount || uploadedPhotos.length}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Expira em:</span>
                  <p className="font-medium">{expirationDays} dias</p>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-5xl mx-auto animate-fade-in pb-24">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Nova Entrega</h1>
          <p className="text-muted-foreground text-sm">
            Passo {currentStep} de {steps.length}
          </p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-between mb-8 overflow-x-auto pb-2">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isActive = currentStep === step.id;
          const isCompleted = currentStep > step.id;
          return (
            <div key={step.id} className="flex items-center">
              <div
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-full transition-colors whitespace-nowrap',
                  isActive && 'bg-primary text-primary-foreground',
                  isCompleted && 'bg-primary/20 text-primary',
                  !isActive && !isCompleted && 'text-muted-foreground'
                )}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                <span className="text-sm font-medium hidden sm:block">{step.name}</span>
              </div>
              {index < steps.length - 1 && (
                <div className={cn('h-px w-4 md:w-12 mx-1 md:mx-2', isCompleted ? 'bg-primary' : 'bg-border')} />
              )}
            </div>
          );
        })}
      </div>

      {/* Step Content */}
      <div className="lunari-card p-6 md:p-8">
        {renderStep()}
      </div>

      {/* Fixed Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t border-border z-40">
        <div className="max-w-5xl mx-auto px-4 py-4 flex justify-between items-center gap-2">
          <Button variant="outline" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {currentStep === 1 ? 'Cancelar' : 'Voltar'}
          </Button>

          {currentStep < steps.length ? (
            <Button
              onClick={handleNext}
              disabled={isCreatingGallery || isUploading}
              variant="terracotta"
            >
              Próximo
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handlePublish}
              disabled={(photoCount === 0 && uploadedPhotos.length === 0)}
              variant="terracotta"
              className="gap-2"
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
