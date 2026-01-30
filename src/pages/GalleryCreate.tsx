import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, User, Image, Settings, Check, Upload, Calendar, MessageSquare, Download, Droplet, Plus, Ban, CreditCard, Receipt, Tag, Package, Trash2, Save, Globe, Lock, Link2, Pencil, TrendingDown, Palette, Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { defaultWelcomeMessage } from '@/data/mockData';
import { DeadlinePreset, WatermarkType, ImageResizeOption, WatermarkDisplay, Client, SaleMode, PricingModel, ChargeType, DiscountPackage, SaleSettings, DiscountPreset, GalleryPermission, PaymentMethod } from '@/types/gallery';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { ClientSelect } from '@/components/ClientSelect';
import { ClientModal, ClientFormData } from '@/components/ClientModal';
import { PackageSelect } from '@/components/PackageSelect';
import { PaymentMethodSelector } from '@/components/PaymentMethodSelector';
import { useGalleryClients } from '@/hooks/useGalleryClients';
import { useSettings } from '@/hooks/useSettings';
import { useAuth } from '@/hooks/useAuth';
import { useGalleryAccess } from '@/hooks/useGalleryAccess';
import { useGestaoParams } from '@/hooks/useGestaoParams';
import { useGestaoPackages, GestaoPackage } from '@/hooks/useGestaoPackages';
import { usePaymentIntegration } from '@/hooks/usePaymentIntegration';
import { generateId } from '@/lib/storage';
import { PhotoUploader, UploadedPhoto } from '@/components/PhotoUploader';
import { useSupabaseGalleries } from '@/hooks/useSupabaseGalleries';
import { RegrasCongeladas, getModeloDisplayName, getFaixasFromRegras, formatFaixaDisplay } from '@/lib/pricingUtils';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { ThemePreviewCard } from '@/components/ThemePreviewCard';
const steps = [{
  id: 1,
  name: 'Cliente',
  icon: User
}, {
  id: 2,
  name: 'Venda',
  icon: Tag
}, {
  id: 3,
  name: 'Configurações',
  icon: Settings
}, {
  id: 4,
  name: 'Fotos',
  icon: Image
}, {
  id: 5,
  name: 'Revisão',
  icon: Check
}];
export default function GalleryCreate() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { hasGestaoIntegration, accessLevel } = useGalleryAccess(user);
  const { gestaoParams, hasGestaoParams, isAssistedMode: hasGestaoSession, paramsProcessed, markAsProcessed, clearParams } = useGestaoParams();
  const { packages: gestaoPackages, isLoading: isLoadingPackages } = useGestaoPackages();
  
  // Assisted mode: has Gestão params AND user has integration
  const isAssistedMode = hasGestaoSession && hasGestaoIntegration;
  
  const {
    clients,
    isLoading: isLoadingClients,
    createClient,
    updateClient
  } = useGalleryClients();
  const {
    settings,
    updateSettings
  } = useSettings();
  const [currentStep, setCurrentStep] = useState(1);

  // Preset dialog state
  const [showSavePresetDialog, setShowSavePresetDialog] = useState(false);
  const [presetName, setPresetName] = useState('');

  // Step 1: Client Info
  const [galleryPermission, setGalleryPermission] = useState<GalleryPermission>('private');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [useExistingPassword, setUseExistingPassword] = useState(true);
  const [newPassword, setNewPassword] = useState('');
  const [passwordDisabled, setPasswordDisabled] = useState(false);
  const [savePasswordToClient, setSavePasswordToClient] = useState(true);
  const [sessionName, setSessionName] = useState('');
  const [packageName, setPackageName] = useState('');
  const [includedPhotos, setIncludedPhotos] = useState(30);

  // Step 2: Sale Settings
  const [saleMode, setSaleMode] = useState<SaleMode>('sale_without_payment');
  const [pricingModel, setPricingModel] = useState<PricingModel>('fixed');
  const [chargeType, setChargeType] = useState<ChargeType>('only_extras');
  const [fixedPrice, setFixedPrice] = useState(25);
  const [discountPackages, setDiscountPackages] = useState<DiscountPackage[]>([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null);
  
  // Payment integration hook
  const { data: paymentData } = usePaymentIntegration();

  // Step 3: Photos
  const [uploadedCount, setUploadedCount] = useState(0);
  const [supabaseGalleryId, setSupabaseGalleryId] = useState<string | null>(null);
  const [isCreatingGallery, setIsCreatingGallery] = useState(false);
  const [uploadedPhotos, setUploadedPhotos] = useState<UploadedPhoto[]>([]);
  
  // Frozen pricing rules from Gestão session (for PRO+Gallery users)
  const [regrasCongeladas, setRegrasCongeladas] = useState<RegrasCongeladas | null>(null);
  const [isLoadingRegras, setIsLoadingRegras] = useState(false);
  const [regrasLoaded, setRegrasLoaded] = useState(false);
  
  // Override pricing: when true, user wants to customize prices instead of using regrasCongeladas
  const [overridePricing, setOverridePricing] = useState(false);
  
  // Supabase galleries hook
  const { createGallery: createSupabaseGallery, updateGallery, sendGallery: sendSupabaseGallery } = useSupabaseGalleries();

  // Step 4: Settings
  const [welcomeMessage, setWelcomeMessage] = useState(defaultWelcomeMessage);
  const [customDays, setCustomDays] = useState(10);
  const [imageResizeOption, setImageResizeOption] = useState<ImageResizeOption>(1920);
  const [watermarkType, setWatermarkType] = useState<WatermarkType>('standard');
  const [watermarkOpacity, setWatermarkOpacity] = useState(40);
  const [watermarkDisplay, setWatermarkDisplay] = useState<WatermarkDisplay>('all');
  const [allowComments, setAllowComments] = useState(true);
  const [allowDownload, setAllowDownload] = useState(false);
  const [allowExtraPhotos, setAllowExtraPhotos] = useState(true);
  
  // Theme selection for client gallery
  const [selectedThemeId, setSelectedThemeId] = useState<string | undefined>();
  const [clientMode, setClientMode] = useState<'light' | 'dark'>('light');

  // Initialize from settings
  useEffect(() => {
    if (settings) {
      setCustomDays(settings.defaultExpirationDays || 10);
      setGalleryPermission(settings.defaultGalleryPermission || 'private');
      if (settings.defaultWatermark) {
        setWatermarkType(settings.defaultWatermark.type);
        setWatermarkOpacity(settings.defaultWatermark.opacity || 40);
      }
      // Initialize theme selection from settings
      if (settings.activeThemeId) {
        setSelectedThemeId(settings.activeThemeId);
      }
      // Initialize client mode from settings
      if (settings.clientTheme === 'dark') {
        setClientMode('dark');
      } else {
        setClientMode('light');
      }
    }
  }, [settings]);

  // Fetch frozen pricing rules from Gestão session
  // Now fetches ALWAYS when session_id is present, regardless of hasGestaoIntegration
  useEffect(() => {
    const sessionId = gestaoParams?.session_id;
    
    // No session_id = no rules to fetch
    if (!sessionId) {
      setRegrasLoaded(true);
      return;
    }

    const fetchSessionData = async () => {
      setIsLoadingRegras(true);
      try {
        console.log('🔗 Fetching session data for:', sessionId);
        // Query by 'session_id' (workflow string) - the session_id param from URL is the workflow string
        const { data, error } = await supabase
          .from('clientes_sessoes')
          .select('id, session_id, regras_congeladas, valor_foto_extra')
          .eq('session_id', sessionId)
          .single();

        if (error) {
          console.warn('Session not found or error:', error.message);
        } else {
          console.log('🔗 Session data found:', data);
          
          if (data?.regras_congeladas) {
            setRegrasCongeladas(data.regras_congeladas as unknown as RegrasCongeladas);
          }
          
          // Use session's valor_foto_extra as fallback (normalized)
          if (data?.valor_foto_extra && data.valor_foto_extra > 0) {
            const valorNormalizado = data.valor_foto_extra > 1000 
              ? data.valor_foto_extra / 100 
              : data.valor_foto_extra;
            setFixedPrice(valorNormalizado);
          }
        }
      } catch (error) {
        console.error('Error fetching session data:', error);
      } finally {
        setIsLoadingRegras(false);
        setRegrasLoaded(true);
      }
    };

    fetchSessionData();
  }, [gestaoParams?.session_id]);

  // Assisted mode: Pre-fill fields from Gestão params (only for PRO + Gallery users)
  // Only runs once, then clears URL params to prevent re-application
  useEffect(() => {
    // Only pre-fill if:
    // 1. In assisted mode (has session_id AND user has Gestão integration)
    // 2. Params haven't been processed yet
    if (!isAssistedMode || !gestaoParams || paramsProcessed) return;

    // Wait for clients to load if we have a cliente_id
    // Must wait for BOTH isLoading to be false AND clients array to be populated
    if (gestaoParams.cliente_id) {
      if (isLoadingClients) {
        console.log('🔗 Waiting for clients to load...');
        return;
      }
      // Also wait if clients array is empty (data still fetching after accessLoading finished)
      if (clients.length === 0) {
        console.log('🔗 Clients loaded but array is empty, waiting for data...');
        return;
      }
    }
    
    // Wait for packages to load if we have a pacote_nome (to lookup fotos_incluidas)
    if (gestaoParams.pacote_nome && isLoadingPackages) {
      console.log('🔗 Waiting for packages to load...');
      return;
    }

    console.log('🔗 Assisted Mode - Processing params:', gestaoParams);
    console.log('🔗 Clients available:', clients.length);
    console.log('🔗 Packages available:', gestaoPackages.length);

    // Step 1: Session name from category
    if (gestaoParams.pacote_categoria) {
      setSessionName(gestaoParams.pacote_categoria);
    }
    
    // Step 2: Package name and lookup package data
    if (gestaoParams.pacote_nome) {
      setPackageName(gestaoParams.pacote_nome);
      
      // Lookup package to get fotos_incluidas and valor_foto_extra
      const packageFromGestao = gestaoPackages.find(
        pkg => pkg.nome.toLowerCase() === gestaoParams.pacote_nome?.toLowerCase()
      );
      
      if (packageFromGestao) {
        console.log('🔗 Found package:', packageFromGestao);
        
        // Use package fotos_incluidas if not explicitly provided in URL
        if (!gestaoParams.fotos_incluidas_no_pacote && packageFromGestao.fotosIncluidas) {
          setIncludedPhotos(packageFromGestao.fotosIncluidas);
        }
        
        // Only use package valor_foto_extra if:
        // 1. Not explicitly provided in URL
        // 2. No frozen rules exist (regrasCongeladas will be the source of truth if present)
        // When regrasCongeladas exist, pricing comes from there, not package
        if (!gestaoParams.preco_da_foto_extra && packageFromGestao.valorFotoExtra && !regrasCongeladas) {
          setFixedPrice(packageFromGestao.valorFotoExtra);
        }
      }
    }
    
    // Explicit URL values take priority
    if (gestaoParams.fotos_incluidas_no_pacote) {
      setIncludedPhotos(gestaoParams.fotos_incluidas_no_pacote);
    }
    if (gestaoParams.preco_da_foto_extra) {
      setFixedPrice(gestaoParams.preco_da_foto_extra);
    }

    // Step 3: Sale Settings
    if (gestaoParams.modelo_de_cobranca) {
      setSaleMode(gestaoParams.modelo_de_cobranca);
    }
    if (gestaoParams.modelo_de_preco) {
      setPricingModel(gestaoParams.modelo_de_preco);
    }

    // Step 4: Find and select client by ID
    if (gestaoParams.cliente_id) {
      const clientFromGestao = clients.find(c => c.id === gestaoParams.cliente_id);
      if (clientFromGestao) {
        console.log('🔗 Found client:', clientFromGestao.name);
        setSelectedClient(clientFromGestao);
        setUseExistingPassword(!!clientFromGestao.galleryPassword);
      } else {
        // Client ID not found - user will need to select manually from dropdown
        console.log('🔗 Client ID not found in database:', gestaoParams.cliente_id);
      }
    }

    // Mark as processed and clear URL params to prevent re-application
    console.log('🔗 Marking params as processed and clearing URL');
    markAsProcessed();
    clearParams();
    
  }, [isAssistedMode, gestaoParams, clients, gestaoPackages, isLoadingClients, isLoadingPackages, paramsProcessed, markAsProcessed, clearParams]);
  // Initialize payment method with default when data loads
  useEffect(() => {
    if (paymentData?.defaultIntegration && !selectedPaymentMethod) {
      setSelectedPaymentMethod(paymentData.defaultIntegration.provedor as PaymentMethod);
    }
  }, [paymentData?.defaultIntegration, selectedPaymentMethod]);

  const getSaleSettings = (): SaleSettings => ({
    mode: saleMode,
    pricingModel,
    chargeType,
    fixedPrice,
    discountPackages,
    paymentMethod: saleMode === 'sale_with_payment' ? selectedPaymentMethod || undefined : undefined,
  });
  // Create Supabase gallery when entering step 3 (for uploads)
  const createSupabaseGalleryForUploads = async () => {
    // For private galleries, client selection is required (for ALL plans)
    if (galleryPermission === 'private' && !selectedClient) {
      toast.error('Selecione um cliente para galeria privada');
      return;
    }
    if (supabaseGalleryId) return;
    
    setIsCreatingGallery(true);
    try {
      // Determine password for private gallery
      let passwordToUse: string | undefined = undefined;
      if (galleryPermission === 'private' && !passwordDisabled) {
        if (useExistingPassword && selectedClient?.galleryPassword) {
          passwordToUse = selectedClient.galleryPassword;
        } else if (newPassword) {
          passwordToUse = newPassword;
          
          // Save new password to client if option is checked
          if (savePasswordToClient && selectedClient) {
            try {
              await updateClient(selectedClient.id, { galleryPassword: newPassword });
            } catch (error) {
              console.error('Error saving password to client:', error);
            }
          }
        }
      }
      // If passwordDisabled = true, passwordToUse stays undefined (no password protection)

      // Client name from selected client (or 'Galeria Pública' if public gallery)
      const clientName = selectedClient?.name || 'Galeria Pública';
      const clientEmail = selectedClient?.email || '';

      // Determine the final extra photo price based on pricing source
      // When we have frozen rules and no override, use normalized rules value
      const hasRegras = regrasCongeladas && !overridePricing;
      const hasSessionId = !!gestaoParams?.session_id;
      
      let valorFotoExtraFinal = fixedPrice;
      if (hasRegras) {
        const valorRaw = regrasCongeladas.pacote?.valorFotoExtra || 0;
        // Normalize if in cents
        valorFotoExtraFinal = valorRaw > 1000 ? valorRaw / 100 : valorRaw;
      }

      const result = await createSupabaseGallery({
        clienteId: selectedClient?.id || null,
        clienteNome: clientName,
        clienteEmail: clientEmail,
        nomeSessao: sessionName || 'Nova Sessão',
        nomePacote: packageName,
        fotosIncluidas: includedPhotos,
        valorFotoExtra: saleMode !== 'no_sale' ? valorFotoExtraFinal : 0,
        prazoSelecaoDias: customDays,
        permissao: galleryPermission,
        mensagemBoasVindas: welcomeMessage,
        galleryPassword: passwordToUse,
        // Use session_id if present in URL, regardless of integration status
        sessionId: hasSessionId ? gestaoParams.session_id : null,
        origin: hasSessionId ? 'gestao' : 'manual',
        // Pass frozen rules if not overriding
        regrasCongeladas: hasRegras ? regrasCongeladas : null,
      });
      
      if (result?.id) {
        setSupabaseGalleryId(result.id);
      }
    } catch (error) {
      console.error('Error creating gallery:', error);
      toast.error('Erro ao criar galeria para upload');
    } finally {
      setIsCreatingGallery(false);
    }
  };
  
  const handleNext = async () => {
    if (currentStep < 5) {
      // When going to step 4 (Fotos), create Supabase gallery first with configurations
      if (currentStep === 3 && !supabaseGalleryId) {
        // Validate client requirement for private galleries (ALL plans)
        if (galleryPermission === 'private' && !selectedClient) {
          toast.error('Selecione um cliente primeiro');
          setCurrentStep(1);
          return;
        }
        
        // For assisted mode, wait for pricing rules to load
        if (isAssistedMode && !regrasLoaded) {
          toast.loading('Carregando configurações de preços...', { duration: 2000 });
          return;
        }
        
        await createSupabaseGalleryForUploads();
      }
      setCurrentStep(currentStep + 1);
    } else {
      // Final step - save all configurations, publish automatically, and navigate to the gallery
      if (supabaseGalleryId) {
        try {
          // Update gallery with all settings from Step 4
          await updateGallery({
            id: supabaseGalleryId,
            data: {
              configuracoes: {
                watermark: {
                  type: watermarkType,
                  opacity: watermarkOpacity,
                  position: 'center',
                },
                watermarkDisplay: watermarkDisplay,
                imageResizeOption: imageResizeOption,
                allowComments: allowComments,
                allowDownload: allowDownload,
                allowExtraPhotos: allowExtraPhotos,
                // Save sale settings for payment flow
                saleSettings: getSaleSettings(),
                // Theme settings for client gallery
                themeId: selectedThemeId,
                clientMode: clientMode,
              },
              mensagemBoasVindas: welcomeMessage,
              prazoSelecaoDias: customDays,
              // Use same pricing logic as creation
              valorFotoExtra: saleMode !== 'no_sale' 
                ? (isAssistedMode && regrasCongeladas && !overridePricing 
                    ? regrasCongeladas.pacote?.valorFotoExtra || 0
                    : fixedPrice)
                : 0,
            }
          });
          
          // Auto-publish gallery so it's ready to be shared
          await sendSupabaseGallery(supabaseGalleryId);
          
          toast.success('Galeria criada e publicada!', {
            description: 'Agora você pode compartilhar o link com o cliente.'
          });
          navigate(`/gallery/${supabaseGalleryId}`);
        } catch (error) {
          console.error('Error finalizing gallery:', error);
          toast.error('Erro ao finalizar galeria');
        }
        return;
      }
      
      // No gallery created yet - shouldn't happen if flow is correct
      toast.error('Erro ao criar galeria. Tente novamente.');
    }
  };
  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else {
      navigate('/');
    }
  };
  
  // Save draft function - can be called at any step
  const handleSaveDraft = async () => {
    try {
      // Determine password for private gallery
      let passwordToUse: string | undefined = undefined;
      if (galleryPermission === 'private' && !passwordDisabled && selectedClient) {
        if (useExistingPassword && selectedClient?.galleryPassword) {
          passwordToUse = selectedClient.galleryPassword;
        } else if (newPassword) {
          passwordToUse = newPassword;
        }
      }

      if (supabaseGalleryId) {
        // Update existing gallery
        await updateGallery({
          id: supabaseGalleryId,
          data: {
            nomeSessao: sessionName || 'Rascunho',
            nomePacote: packageName || undefined,
            clienteNome: selectedClient?.name,
            clienteEmail: selectedClient?.email,
            fotosIncluidas: includedPhotos,
            valorFotoExtra: saleMode !== 'no_sale' ? fixedPrice : 0,
            prazoSelecaoDias: customDays,
            permissao: galleryPermission,
            mensagemBoasVindas: welcomeMessage,
            configuracoes: {
              watermark: {
                type: watermarkType,
                opacity: watermarkOpacity,
                position: 'center',
              },
              watermarkDisplay: watermarkDisplay,
              imageResizeOption: imageResizeOption,
              allowComments: allowComments,
              allowDownload: allowDownload,
              allowExtraPhotos: allowExtraPhotos,
              saleSettings: getSaleSettings(),
              themeId: selectedThemeId,
              clientMode: clientMode,
            },
          }
        });
        toast.success('Rascunho salvo!');
        navigate('/');
      } else {
        // Create new gallery as draft
        const result = await createSupabaseGallery({
          clienteId: selectedClient?.id || null,
          clienteNome: selectedClient?.name || undefined,
          clienteEmail: selectedClient?.email || undefined,
          nomeSessao: sessionName || 'Rascunho',
          nomePacote: packageName || undefined,
          fotosIncluidas: includedPhotos,
          valorFotoExtra: saleMode !== 'no_sale' ? fixedPrice : 0,
          prazoSelecaoDias: customDays,
          permissao: galleryPermission,
          mensagemBoasVindas: welcomeMessage,
          galleryPassword: passwordToUse,
          sessionId: gestaoParams?.session_id || null,
          origin: gestaoParams?.session_id ? 'gestao' : 'manual',
          configuracoes: {
            watermark: {
              type: watermarkType,
              opacity: watermarkOpacity,
              position: 'center',
            },
            watermarkDisplay: watermarkDisplay,
            imageResizeOption: imageResizeOption,
            allowComments: allowComments,
            allowDownload: allowDownload,
            allowExtraPhotos: allowExtraPhotos,
            saleSettings: getSaleSettings(),
            themeId: selectedThemeId,
            clientMode: clientMode,
          },
        });
        
        if (result?.id) {
          toast.success('Rascunho salvo!');
          navigate('/');
        }
      }
    } catch (error) {
      console.error('Error saving draft:', error);
      toast.error('Erro ao salvar rascunho');
    }
  };
  
  const handlePhotoUploadComplete = (photos: UploadedPhoto[]) => {
    setUploadedPhotos(prev => [...prev, ...photos]);
    setUploadedCount(prev => prev + photos.length);
  };
  const handleSaveClient = async (clientData: ClientFormData) => {
    try {
      const newClient = await createClient(clientData);
      setSelectedClient(newClient);
      setUseExistingPassword(true);
      setIsClientModalOpen(false);
      toast.success('Cliente cadastrado com sucesso!');
    } catch (error) {
      console.error('Error creating client:', error);
      toast.error('Erro ao cadastrar cliente');
    }
  };
  const handleClientSelect = (client: Client | null) => {
    setSelectedClient(client);
    if (client) {
      // Only use existing password if client actually has one
      const hasPassword = !!client.galleryPassword;
      setUseExistingPassword(hasPassword);
      setNewPassword('');
    }
  };
  const addDiscountPackage = () => {
    const updatedPackages = [...discountPackages];

    // Se já existe última faixa com infinito, converter para número
    if (updatedPackages.length > 0) {
      const lastIndex = updatedPackages.length - 1;
      const lastPkg = updatedPackages[lastIndex];
      if (lastPkg.maxPhotos === null) {
        // Definir valor padrão: minPhotos + 9
        updatedPackages[lastIndex] = {
          ...lastPkg,
          maxPhotos: lastPkg.minPhotos + 9
        };
      }
    }
    const lastPackage = updatedPackages[updatedPackages.length - 1];
    const minPhotos = lastPackage ? (lastPackage.maxPhotos as number) + 1 : 1;
    setDiscountPackages([...updatedPackages, {
      id: generateId(),
      minPhotos,
      maxPhotos: null,
      // Infinito por padrão
      pricePerPhoto: Math.max(1, fixedPrice - (discountPackages.length + 1) * 5)
    }]);
  };
  const updateDiscountPackage = (id: string, field: keyof DiscountPackage, value: number | null) => {
    setDiscountPackages(discountPackages.map(pkg => pkg.id === id ? {
      ...pkg,
      [field]: value
    } : pkg));
  };
  const savePreset = () => {
    if (!presetName.trim()) {
      toast.error('Digite um nome para a predefinição');
      return;
    }
    const newPreset: DiscountPreset = {
      id: generateId(),
      name: presetName.trim(),
      packages: discountPackages,
      createdAt: new Date()
    };
    updateSettings({
      discountPresets: [...(settings.discountPresets || []), newPreset]
    });
    setPresetName('');
    setShowSavePresetDialog(false);
    toast.success('Predefinição salva com sucesso!');
  };
  const loadPreset = (presetId: string) => {
    const preset = settings.discountPresets?.find(p => p.id === presetId);
    if (preset) {
      // Clonar os pacotes com novos IDs
      const clonedPackages = preset.packages.map(pkg => ({
        ...pkg,
        id: generateId()
      }));
      setDiscountPackages(clonedPackages);
      toast.success(`Predefinição "${preset.name}" carregada`);
    }
  };
  const removeDiscountPackage = (id: string) => {
    setDiscountPackages(discountPackages.filter(pkg => pkg.id !== id));
  };
  const getSaleModeLabel = () => {
    switch (saleMode) {
      case 'no_sale':
        return 'Sem venda';
      case 'sale_with_payment':
        return 'Venda COM pagamento';
      case 'sale_without_payment':
        return 'Venda SEM pagamento';
    }
  };
  const getPricingModelLabel = () => {
    switch (pricingModel) {
      case 'fixed':
        return 'Preço único';
      case 'packages':
        return 'Pacotes com desconto';
    }
  };
  const getChargeTypeLabel = () => {
    switch (chargeType) {
      case 'only_extras':
        return 'Apenas extras';
      case 'all_selected':
        return 'Todas selecionadas';
    }
  };
  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground text-lg font-serif">
                Dados do cliente e detalhes da sessão
              </p>
              {/* Assisted Mode Badge */}
              {isAssistedMode && (
                <Badge variant="secondary" className="gap-1.5">
                  <Link2 className="h-3 w-3" />
                  Vinculada à sessão do Gestão
                </Badge>
              )}
            </div>

            {/* Gallery Permission */}
            <div className="space-y-4">
              <Label className="text-base font-medium">Permissão da Galeria</Label>
              <RadioGroup value={galleryPermission} onValueChange={(v) => {
                setGalleryPermission(v as GalleryPermission);
                if (v === 'public') {
                  setSelectedClient(null);
                }
              }} className="grid grid-cols-2 gap-4">
                <div>
                  <RadioGroupItem value="public" id="gallery-public" className="peer sr-only" />
                  <Label htmlFor="gallery-public" className={cn("flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all", "hover:border-primary/50 hover:bg-muted/50", galleryPermission === 'public' ? "border-primary bg-primary/5" : "border-border")}>
                    <Globe className={cn("h-5 w-5", galleryPermission === 'public' ? "text-primary" : "text-muted-foreground")} />
                    <div>
                      <p className="font-medium">Pública</p>
                      <p className="text-xs text-muted-foreground">Sem senha</p>
                    </div>
                  </Label>
                </div>
                <div>
                  <RadioGroupItem value="private" id="gallery-private" className="peer sr-only" />
                  <Label htmlFor="gallery-private" className={cn("flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all", "hover:border-primary/50 hover:bg-muted/50", galleryPermission === 'private' ? "border-primary bg-primary/5" : "border-border")}>
                    <Lock className={cn("h-5 w-5", galleryPermission === 'private' ? "text-primary" : "text-muted-foreground")} />
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
                {/* Client dropdown - Same for ALL plans (table accessed depends on plan via useGalleryClients) */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 space-y-2">
                    <Label>Cliente *</Label>
                    {isLoadingClients ? (
                      <div className="h-10 rounded-md border border-input bg-muted animate-pulse" />
                    ) : (
                      <ClientSelect 
                        clients={clients} 
                        selectedClient={selectedClient} 
                        onSelect={handleClientSelect} 
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

                {/* Password Section - Show for ANY selected client (all plans) */}
                {selectedClient && (
                  <div className="p-4 rounded-lg bg-muted/50 space-y-2 animate-fade-in">
                    <div className="grid gap-2 md:grid-cols-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Email: </span>
                        <span className="font-medium">{selectedClient.email}</span>
                      </div>
                      {selectedClient.phone && (
                        <div>
                          <span className="text-muted-foreground">Telefone: </span>
                          <span className="font-medium">{selectedClient.phone}</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="pt-2 space-y-3">
                      <Label className="text-sm">Senha de acesso à galeria</Label>
                      
                      {/* Option: Disable password protection */}
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="passwordDisabled" 
                          checked={passwordDisabled} 
                          onCheckedChange={checked => {
                            setPasswordDisabled(checked as boolean);
                            if (checked) {
                              setUseExistingPassword(false);
                              setNewPassword('');
                            }
                          }} 
                        />
                        <label htmlFor="passwordDisabled" className="text-sm font-medium leading-none">
                          Sem proteção por senha
                        </label>
                      </div>
                      <p className="text-xs text-muted-foreground ml-6">
                        Qualquer pessoa com o link poderá acessar a galeria
                      </p>
                      
                      {/* Password options - only show if password is NOT disabled */}
                      {!passwordDisabled && (
                        <>
                          {/* Client HAS password registered */}
                          {selectedClient.galleryPassword ? (
                            <>
                              <div className="flex items-center space-x-2">
                                <Checkbox 
                                  id="useExisting" 
                                  checked={useExistingPassword} 
                                  onCheckedChange={checked => setUseExistingPassword(checked as boolean)} 
                                />
                                <label htmlFor="useExisting" className="text-sm font-medium leading-none">
                                  Usar senha cadastrada
                                </label>
                              </div>
                              
                              {/* Show password visually when using existing */}
                              {useExistingPassword && (
                                <div className="flex items-center gap-2 p-2 bg-muted rounded-md ml-6">
                                  <Lock className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-mono text-sm">{selectedClient.galleryPassword}</span>
                                </div>
                              )}
                              
                              {/* Input for new password when unchecked */}
                              {!useExistingPassword && (
                                <div className="space-y-2 ml-6">
                                  <Input 
                                    placeholder="Nova senha para esta galeria" 
                                    value={newPassword} 
                                    onChange={e => setNewPassword(e.target.value)} 
                                  />
                                  <div className="flex items-center space-x-2">
                                    <Checkbox 
                                      id="saveToClient" 
                                      checked={savePasswordToClient} 
                                      onCheckedChange={checked => setSavePasswordToClient(checked as boolean)} 
                                    />
                                    <label htmlFor="saveToClient" className="text-xs text-muted-foreground">
                                      Salvar esta senha no cadastro do cliente
                                    </label>
                                  </div>
                                </div>
                              )}
                            </>
                          ) : (
                            /* Client has NO password registered */
                            <div className="space-y-2">
                              <p className="text-xs text-muted-foreground">
                                Este cliente não possui senha cadastrada
                              </p>
                              <Input 
                                placeholder="Definir senha para a galeria" 
                                value={newPassword} 
                                onChange={e => setNewPassword(e.target.value)} 
                              />
                              <div className="flex items-center space-x-2">
                                <Checkbox 
                                  id="saveToClient" 
                                  checked={savePasswordToClient} 
                                  onCheckedChange={checked => setSavePasswordToClient(checked as boolean)} 
                                />
                                <label htmlFor="saveToClient" className="text-xs text-muted-foreground">
                                  Salvar esta senha no cadastro do cliente
                                </label>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}

              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="sessionName">Nome da Sessão *</Label>
                <Input id="sessionName" placeholder="Ex: Ensaio Gestante" value={sessionName} onChange={e => setSessionName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="packageName">Pacote</Label>
                {/* PRO + Gallery: Searchable dropdown for packages */}
                {hasGestaoIntegration && gestaoPackages.length > 0 ? (
                  <PackageSelect 
                    packages={gestaoPackages} 
                    selectedPackage={packageName} 
                    onSelect={(name, pkg) => {
                      setPackageName(name);
                      // Auto-fill included photos and price if available
                      if (pkg?.fotosIncluidas) {
                        setIncludedPhotos(pkg.fotosIncluidas);
                      }
                      if (pkg?.valorFotoExtra) {
                        setFixedPrice(pkg.valorFotoExtra);
                      }
                    }}
                    disabled={isLoadingPackages}
                  />
                ) : (
                  /* Other plans or no packages: Simple text input */
                  <Input id="packageName" placeholder="Ex: Pacote Premium" value={packageName} onChange={e => setPackageName(e.target.value)} />
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="includedPhotos">Fotos Incluídas no Pacote *</Label>
              <Input id="includedPhotos" type="number" min={1} value={includedPhotos} onChange={e => setIncludedPhotos(parseInt(e.target.value) || 0)} className="max-w-[200px]" />
            </div>

            <ClientModal open={isClientModalOpen} onOpenChange={setIsClientModalOpen} onSave={handleSaveClient} />
          </div>;
      case 2:
        return <div className="space-y-8 animate-fade-in">
            <div>
              
              <p className="text-muted-foreground text-lg font-serif">
                Defina como será a cobrança por fotos extras
              </p>
            </div>

            {/* Two column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left Block - Sale Mode */}
              <div className="space-y-4">
                <Label className="text-base font-medium">Configurar venda de fotos?</Label>
                <RadioGroup value={saleMode} onValueChange={v => setSaleMode(v as SaleMode)} className="flex flex-col gap-4">
                  {/* No Sale */}
                  <div>
                    <RadioGroupItem value="no_sale" id="sale-no" className="peer sr-only" />
                    <Label htmlFor="sale-no" className={cn("flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all", "hover:border-primary/50 hover:bg-muted/50", saleMode === 'no_sale' ? "border-primary bg-primary/5" : "border-border")}>
                      <div className={cn("w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0", saleMode === 'no_sale' ? "bg-primary/20" : "bg-muted")}>
                        <Ban className={cn("h-5 w-5", saleMode === 'no_sale' ? "text-primary" : "text-muted-foreground")} />
                      </div>
                      <div>
                        <p className="font-medium">Não, sem venda</p>
                        <p className="text-xs text-muted-foreground">
                          O cliente não será informado sobre os preços das fotos
                        </p>
                      </div>
                    </Label>
                  </div>

                  {/* Sale with Payment */}
                  <div>
                    <RadioGroupItem value="sale_with_payment" id="sale-payment" className="peer sr-only" />
                    <Label htmlFor="sale-payment" className={cn("flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all", "hover:border-primary/50 hover:bg-muted/50", saleMode === 'sale_with_payment' ? "border-primary bg-primary/5" : "border-border")}>
                      <div className={cn("w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0", saleMode === 'sale_with_payment' ? "bg-primary/20" : "bg-muted")}>
                        <CreditCard className={cn("h-5 w-5", saleMode === 'sale_with_payment' ? "text-primary" : "text-muted-foreground")} />
                      </div>
                      <div>
                        <p className="font-medium">Sim, COM pagamento</p>
                        <p className="text-xs text-muted-foreground">
                          O cliente será cobrado ao finalizar a seleção
                        </p>
                      </div>
                    </Label>
                  </div>

                  {/* Sale without Payment */}
                  <div>
                    <RadioGroupItem value="sale_without_payment" id="sale-no-payment" className="peer sr-only" />
                    <Label htmlFor="sale-no-payment" className={cn("flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all", "hover:border-primary/50 hover:bg-muted/50", saleMode === 'sale_without_payment' ? "border-primary bg-primary/5" : "border-border")}>
                      <div className={cn("w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0", saleMode === 'sale_without_payment' ? "bg-primary/20" : "bg-muted")}>
                        <Receipt className={cn("h-5 w-5", saleMode === 'sale_without_payment' ? "text-primary" : "text-muted-foreground")} />
                      </div>
                      <div>
                        <p className="font-medium">Sim, SEM pagamento</p>
                        <p className="text-xs text-muted-foreground">
                          O cliente será apenas informado sobre os preços
                        </p>
                      </div>
                    </Label>
                  </div>
                </RadioGroup>
                
                {/* Payment Method Selection - Only when sale_with_payment */}
                {saleMode === 'sale_with_payment' && (
                  <div className="mt-4 pt-4 border-t border-border/50">
                    <PaymentMethodSelector
                      integrations={paymentData?.allActiveIntegrations || []}
                      selectedMethod={selectedPaymentMethod}
                      onSelect={(method) => setSelectedPaymentMethod(method as PaymentMethod)}
                    />
                  </div>
                )}
              </div>

              {/* Right Block - Pricing Configuration (conditional) */}
              {saleMode !== 'no_sale' && <div className="space-y-6">
                  {/* Show frozen rules from Gestão when available and not overriding */}
                  {regrasCongeladas && !overridePricing ? (
                    <div className="space-y-4">
                      {/* Loading state */}
                      {isLoadingRegras ? (
                        <div className="space-y-3">
                          <Skeleton className="h-16 w-full" />
                          <Skeleton className="h-24 w-full" />
                        </div>
                      ) : (
                        <>
                          {/* Synced pricing banner */}
                          <div className="p-4 rounded-lg bg-accent/20 border border-accent/50">
                            <div className="flex items-center gap-2 text-accent-foreground">
                              <Link2 className="h-5 w-5" />
                              <span className="font-medium">Preços sincronizados do Gestão</span>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              Os preços de fotos extras estão configurados na sessão original.
                            </p>
                          </div>

                          {/* Rules summary */}
                          <div className="p-4 rounded-lg border bg-muted/30 space-y-3">
                            <h4 className="font-medium">Configuração de Preços</h4>
                            
                            {/* Pricing model */}
                            <div className="flex items-center gap-2 text-sm">
                              <Tag className="h-4 w-4 text-muted-foreground" />
                              <span>Modelo: {getModeloDisplayName(regrasCongeladas.precificacaoFotoExtra?.modelo || 'fixo')}</span>
                            </div>
                            
                            {/* Price tiers (if progressive) */}
                            {regrasCongeladas.precificacaoFotoExtra?.modelo !== 'fixo' && getFaixasFromRegras(regrasCongeladas).length > 0 && (
                              <div className="space-y-2 pt-2 border-t border-border/50">
                                <Label className="text-xs text-muted-foreground">Faixas de desconto:</Label>
                                <div className="grid gap-1">
                                  {getFaixasFromRegras(regrasCongeladas).map((faixa, idx) => (
                                    <div key={idx} className="flex justify-between text-sm py-1 px-2 rounded bg-background/50">
                                      <span className="text-muted-foreground">{formatFaixaDisplay(faixa)}</span>
                                      <span className="font-medium">R$ {faixa.valor.toFixed(2)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {/* Fixed base price (if fixed model or as fallback) */}
                            {(regrasCongeladas.precificacaoFotoExtra?.modelo === 'fixo' || getFaixasFromRegras(regrasCongeladas).length === 0) && (
                              <div className="flex justify-between text-sm pt-2 border-t border-border/50">
                                <span className="text-muted-foreground">Preço por foto extra:</span>
                                <span className="font-medium">R$ {(regrasCongeladas.pacote?.valorFotoExtra || 0).toFixed(2)}</span>
                              </div>
                            )}
                          </div>

                          {/* Customize button */}
                          <Button 
                            type="button"
                            variant="ghost" 
                            size="sm"
                            onClick={() => {
                              setOverridePricing(true);
                              // Initialize fixedPrice with the frozen value for editing
                              setFixedPrice(regrasCongeladas.pacote?.valorFotoExtra || 25);
                            }}
                            className="text-muted-foreground"
                          >
                            <Pencil className="h-4 w-4 mr-2" />
                            Personalizar preços para esta galeria
                          </Button>
                        </>
                      )}
                    </div>
                  ) : (
                    <>
                      {/* Override mode banner (when user chose to customize) */}
                      {regrasCongeladas && overridePricing && (
                        <div className="flex items-center justify-between p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                          <div className="flex items-center gap-2">
                            <Pencil className="h-4 w-4 text-destructive" />
                            <span className="text-sm font-medium text-destructive">Modo personalizado ativo</span>
                          </div>
                          <Button 
                            type="button"
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setOverridePricing(false)}
                            className="text-muted-foreground h-7"
                          >
                            Reverter para Gestão
                          </Button>
                        </div>
                      )}

                      {/* Manual Pricing Model selection (default or override mode) */}
                      <div className="space-y-4">
                        <Label className="text-base font-medium">Qual formato de preço?</Label>
                        <RadioGroup value={pricingModel} onValueChange={v => setPricingModel(v as PricingModel)} className="flex flex-col gap-3">
                          {/* Fixed Price */}
                          <div>
                            <RadioGroupItem value="fixed" id="pricing-fixed" className="peer sr-only" />
                            <Label htmlFor="pricing-fixed" className={cn("flex flex-col gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all", "hover:border-primary/50 hover:bg-muted/50", pricingModel === 'fixed' ? "border-primary bg-primary/5" : "border-border")}>
                              <div className="flex items-center gap-3">
                                <div className={cn("w-8 h-8 rounded-full flex items-center justify-center", pricingModel === 'fixed' ? "bg-primary/20" : "bg-muted")}>
                                  <Tag className={cn("h-4 w-4", pricingModel === 'fixed' ? "text-primary" : "text-muted-foreground")} />
                                </div>
                                <div>
                                  <p className="font-medium">Preço único por foto</p>
                                  <p className="text-xs text-muted-foreground">
                                    Defina um valor fixo para cada foto
                                  </p>
                                </div>
                              </div>
                              
                              {pricingModel === 'fixed' && <div className="pt-3 border-t border-border/50">
                                  <Label htmlFor="fixedPrice" className="text-sm">Valor por foto (R$)</Label>
                                  <Input id="fixedPrice" type="number" min={0} step={0.01} value={fixedPrice} onChange={e => setFixedPrice(parseFloat(e.target.value) || 0)} className="mt-2" onClick={e => e.stopPropagation()} />
                                </div>}
                            </Label>
                          </div>

                          {/* Packages with Discount */}
                          <div>
                            <RadioGroupItem value="packages" id="pricing-packages" className="peer sr-only" />
                            <Label htmlFor="pricing-packages" className={cn("flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all relative", "hover:border-primary/50 hover:bg-muted/50", pricingModel === 'packages' ? "border-primary bg-primary/5" : "border-border")}>
                              <Badge className="absolute -top-2 right-2 text-xs bg-primary text-primary-foreground">
                                Novo
                              </Badge>
                              <div className={cn("w-8 h-8 rounded-full flex items-center justify-center", pricingModel === 'packages' ? "bg-primary/20" : "bg-muted")}>
                                <Package className={cn("h-4 w-4", pricingModel === 'packages' ? "text-primary" : "text-muted-foreground")} />
                              </div>
                              <div>
                                <p className="font-medium">Pacotes com descontos</p>
                                <p className="text-xs text-muted-foreground">
                                  Descontos progressivos por quantidade
                                </p>
                              </div>
                            </Label>
                          </div>
                        </RadioGroup>
                      </div>
                    </>
                  )}

                  {/* Discount Packages Configuration - only show in manual mode or override */}
                  {pricingModel === 'packages' && (!isAssistedMode || !regrasCongeladas || overridePricing) && <div className="space-y-4 p-4 rounded-lg bg-muted/30 border border-border/50">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <Label className="text-sm font-medium">Configurar faixas</Label>
                        <div className="flex gap-2 flex-wrap">
                          {/* Select para carregar predefinição */}
                          {settings.discountPresets && settings.discountPresets.length > 0 && <Select onValueChange={loadPreset}>
                              <SelectTrigger className="h-8 w-[140px]">
                                <SelectValue placeholder="Carregar" />
                              </SelectTrigger>
                              <SelectContent>
                                {settings.discountPresets.map(preset => <SelectItem key={preset.id} value={preset.id}>
                                    {preset.name}
                                  </SelectItem>)}
                              </SelectContent>
                            </Select>}
                          
                          {/* Botão salvar predefinição */}
                          {discountPackages.length > 0 && <Button type="button" variant="outline" size="sm" onClick={() => setShowSavePresetDialog(true)} className="gap-1">
                              <Save className="h-4 w-4" />
                              Salvar
                            </Button>}
                          
                          {/* Botão adicionar faixa */}
                          <Button type="button" variant="outline" size="sm" onClick={addDiscountPackage} className="gap-1">
                            <Plus className="h-4 w-4" />
                            Adicionar
                          </Button>
                        </div>
                      </div>

                      {discountPackages.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">
                          Adicione faixas para definir preços por quantidade
                        </p> : <div className="space-y-3">
                          {discountPackages.map((pkg, index) => <div key={pkg.id} className="flex items-center gap-2 p-3 rounded-lg bg-background border border-border/50">
                              <div className="flex-1 grid grid-cols-3 gap-2">
                                <div className="space-y-1">
                                  <Label className="text-xs text-muted-foreground">De</Label>
                                  <Input type="number" min={1} value={pkg.minPhotos} onChange={e => updateDiscountPackage(pkg.id, 'minPhotos', parseInt(e.target.value) || 1)} className="h-8" />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs text-muted-foreground">Até</Label>
                                  {index === discountPackages.length - 1 ? <Input type="text" value={pkg.maxPhotos === null ? '∞' : pkg.maxPhotos} onChange={e => {
                          const val = e.target.value;
                          if (val === '' || val === '∞') {
                            updateDiscountPackage(pkg.id, 'maxPhotos', null);
                          } else {
                            const num = parseInt(val);
                            if (!isNaN(num)) {
                              updateDiscountPackage(pkg.id, 'maxPhotos', num);
                            }
                          }
                        }} placeholder="∞" className="h-8 text-center" /> : <Input type="number" min={pkg.minPhotos} value={pkg.maxPhotos ?? ''} onChange={e => updateDiscountPackage(pkg.id, 'maxPhotos', parseInt(e.target.value) || pkg.minPhotos)} className="h-8" />}
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs text-muted-foreground">R$</Label>
                                  <Input type="number" min={0} step={0.01} value={pkg.pricePerPhoto} onChange={e => updateDiscountPackage(pkg.id, 'pricePerPhoto', parseFloat(e.target.value) || 0)} className="h-8" />
                                </div>
                              </div>
                              <Button type="button" variant="ghost" size="icon" onClick={() => removeDiscountPackage(pkg.id)} className="text-destructive hover:text-destructive h-8 w-8">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>)}
                        </div>}
                    </div>}

                  {/* Charge Type */}
                  <div className="space-y-3">
                    <Label className="text-base font-medium">Tipo de cobrança</Label>
                    <Select value={chargeType} onValueChange={v => setChargeType(v as ChargeType)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="only_extras">Cobrar apenas as fotos extras</SelectItem>
                        <SelectItem value="all_selected">Cobrar todas as fotos selecionadas</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {chargeType === 'only_extras' ? `Fotos até o limite do pacote (${includedPhotos}) são gratuitas.` : `Todas as fotos selecionadas serão cobradas.`}
                    </p>
                  </div>
                </div>}
            </div>
            
            {/* Dialog para salvar predefinição */}
            <Dialog open={showSavePresetDialog} onOpenChange={setShowSavePresetDialog}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Salvar predefinição de faixas</DialogTitle>
                  <DialogDescription>
                    Salve esta configuração de faixas para reutilizar em outras galerias
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="presetName">Nome da predefinição</Label>
                    <Input id="presetName" value={presetName} onChange={e => setPresetName(e.target.value)} placeholder="Ex: Casamentos, Ensaios..." />
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground mb-2">Faixas a salvar:</p>
                    {discountPackages.map(pkg => <p key={pkg.id} className="text-sm">
                        {pkg.minPhotos} - {pkg.maxPhotos === null ? '∞' : pkg.maxPhotos} fotos: R$ {pkg.pricePerPhoto.toFixed(2)}
                      </p>)}
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowSavePresetDialog(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={savePreset}>Salvar predefinição</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>;
      case 4:
        return <div className="space-y-6 animate-fade-in">
            <div>
              
              <p className="text-muted-foreground text-lg font-serif">
                Adicione as fotos da sessão para o cliente selecionar
              </p>
            </div>

            {isCreatingGallery ? (
              <div className="flex flex-col items-center justify-center p-12 space-y-4">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                <p className="text-muted-foreground">Preparando galeria para uploads...</p>
              </div>
            ) : supabaseGalleryId ? (
              <PhotoUploader
                galleryId={supabaseGalleryId}
                maxLongEdge={imageResizeOption}
                onUploadComplete={handlePhotoUploadComplete}
              />
            ) : (
              <div className="border-2 border-dashed border-border rounded-xl p-12 text-center">
                <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium mb-2">
                  Preparando área de upload...
                </p>
                <p className="text-sm text-muted-foreground">
                  A galeria será criada automaticamente
                </p>
              </div>
            )}

            {uploadedCount > 0 && <div className="lunari-card p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Image className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{uploadedCount} fotos enviadas</p>
                      <p className="text-sm text-muted-foreground">
                        Fotos salvas com sucesso
                      </p>
                    </div>
                  </div>
                </div>
              </div>}

            <div className="p-4 rounded-lg bg-muted/50 text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">ℹ️ Informação técnica</p>
              <p>
                As fotos são comprimidas e enviadas de forma segura. 
                As versões derivadas (thumbnail + preview) são geradas automaticamente.
              </p>
            </div>
          </div>;
      case 3:
        return <div className="space-y-8 animate-fade-in">
            <div>
              
              <p className="text-muted-foreground font-serif text-xl">
                Personalize a experiência do cliente
              </p>
            </div>

            {/* Two column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left Block - Welcome Message & Deadline */}
              <div className="space-y-6">
                {/* Welcome Message */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    <Label>Mensagem de Saudação</Label>
                  </div>
                  <Textarea value={welcomeMessage} onChange={e => setWelcomeMessage(e.target.value)} placeholder="Personalize a mensagem de boas-vindas..." rows={6} className="resize-none" />
                  <p className="text-xs text-muted-foreground">
                    Use {'{cliente}'}, {'{sessao}'}, {'{estudio}'} para personalização automática.
                  </p>
                </div>

                {/* Deadline */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    <Label>Prazo de Seleção *</Label>
                  </div>
                  <div className="flex items-center gap-3">
                    <Input type="number" min={1} max={90} value={customDays} onChange={e => setCustomDays(parseInt(e.target.value) || 10)} className="w-24" />
                    <span className="text-muted-foreground">dias</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Configuração padrão: {settings.defaultExpirationDays || 10} dias
                  </p>
                </div>
              </div>

              {/* Right Block - Image Settings & Watermark & Interactions */}
              <div className="space-y-6">
                {/* Image Resize */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Image className="h-4 w-4 text-primary" />
                    <Label>Tamanho das Imagens</Label>
                  </div>
                  <Select value={String(imageResizeOption)} onValueChange={v => setImageResizeOption(parseInt(v) as ImageResizeOption)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1024">1024 px</SelectItem>
                      <SelectItem value="1920">1920 px (recomendado)</SelectItem>
                      <SelectItem value="2560">2560 px (4K)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Aresta longa • Fotos são redimensionadas proporcionalmente
                  </p>
                </div>

                {/* Watermark */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Droplet className="h-4 w-4 text-primary" />
                    <Label>Marca D'água</Label>
                  </div>
                  
                  {/* Watermark Type - Only standard and none */}
                  <RadioGroup value={watermarkType} onValueChange={v => setWatermarkType(v as WatermarkType)} className="flex flex-wrap gap-2">
                    <div className="flex items-center">
                      <RadioGroupItem value="standard" id="wm-standard" className="peer sr-only" />
                      <Label htmlFor="wm-standard" className="px-3 py-1.5 text-sm rounded-lg border cursor-pointer peer-data-[state=checked]:bg-primary peer-data-[state=checked]:text-primary-foreground peer-data-[state=checked]:border-primary">
                        Padrão
                      </Label>
                    </div>
                    <div className="flex items-center">
                      <RadioGroupItem value="none" id="wm-none" className="peer sr-only" />
                      <Label htmlFor="wm-none" className="px-3 py-1.5 text-sm rounded-lg border cursor-pointer peer-data-[state=checked]:bg-primary peer-data-[state=checked]:text-primary-foreground peer-data-[state=checked]:border-primary">
                        Nenhuma
                      </Label>
                    </div>
                  </RadioGroup>

                  {/* Standard Watermark Preview */}
                  {watermarkType === 'standard' && (
                    <div className="space-y-4 p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-4">
                        <div 
                          className="h-12 flex items-center justify-center bg-black/80 rounded px-2"
                        >
                          <img 
                            src="/watermarks/horizontal.png" 
                            alt="Marca d'água padrão" 
                            className="h-8 object-contain" 
                            style={{ opacity: watermarkOpacity / 100 }}
                          />
                        </div>
                        <div>
                          <p className="text-sm font-medium">Marca d'água padrão do sistema</p>
                          <p className="text-xs text-muted-foreground">
                            Aplicada automaticamente baseado na orientação
                          </p>
                        </div>
                      </div>
                      
                      {/* Opacity Slider */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm">Opacidade</Label>
                          <span className="text-sm font-medium text-muted-foreground">{watermarkOpacity}%</span>
                        </div>
                        <Slider
                          value={[watermarkOpacity]}
                          onValueChange={(value) => setWatermarkOpacity(value[0])}
                          min={10}
                          max={100}
                          step={5}
                          className="w-full"
                        />
                      </div>
                    </div>
                  )}

                  {/* Display setting for watermark */}
                  {watermarkType === 'standard' && (
                    <div className="space-y-2">
                      <Label className="text-sm">Onde aplicar</Label>
                      <Select value={watermarkDisplay} onValueChange={v => setWatermarkDisplay(v as WatermarkDisplay)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Fotos ampliadas e miniaturas</SelectItem>
                          <SelectItem value="fullscreen">Somente fotos ampliadas</SelectItem>
                          <SelectItem value="none">Não aplicar</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                {/* Theme Selection for Client Gallery - Simplified */}
                {settings.themeType === 'custom' && settings.customTheme && (
                  <div className="space-y-4 pt-2">
                    <div className="flex items-center gap-2">
                      <Palette className="h-4 w-4 text-primary" />
                      <h3 className="font-medium text-sm">Aparência da Galeria</h3>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Usando tema personalizado: {settings.customTheme.name}
                    </p>
                    
                    {/* Preview of custom theme */}
                    <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                      <div className="flex gap-1.5">
                        <div 
                          className="w-6 h-6 rounded-full border"
                          style={{ backgroundColor: settings.customTheme.primaryColor }}
                          title="Cor primária"
                        />
                        <div 
                          className="w-6 h-6 rounded-full border"
                          style={{ backgroundColor: settings.customTheme.accentColor }}
                          title="Cor de destaque"
                        />
                        <div 
                          className="w-6 h-6 rounded-full border"
                          style={{ backgroundColor: settings.customTheme.emphasisColor }}
                          title="Cor de ênfase"
                        />
                      </div>
                      <span className="text-sm text-muted-foreground">
                        Fundo {settings.customTheme.backgroundMode === 'dark' ? 'escuro' : 'claro'}
                      </span>
                    </div>
                    
                    {/* Client Mode Toggle - Override per gallery */}
                    <div className="flex items-center gap-3 pt-2">
                      <Label className="text-sm">Modo para esta galeria:</Label>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant={clientMode === 'light' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setClientMode('light')}
                          className="gap-1"
                        >
                          <Sun className="h-3.5 w-3.5" />
                          Claro
                        </Button>
                        <Button
                          type="button"
                          variant={clientMode === 'dark' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setClientMode('dark')}
                          className="gap-1"
                        >
                          <Moon className="h-3.5 w-3.5" />
                          Escuro
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Client Interactions */}
                <div className="space-y-3 pt-2">
                  <h3 className="font-medium text-sm">Interações do Cliente</h3>
                  
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-sm font-medium">Permitir comentários</p>
                      <p className="text-xs text-muted-foreground">
                        Cliente pode comentar em cada foto
                      </p>
                    </div>
                    <Switch checked={allowComments} onCheckedChange={setAllowComments} />
                  </div>

                  <div className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-sm font-medium">Permitir download</p>
                      <p className="text-xs text-muted-foreground">
                        Cliente pode baixar as imagens
                      </p>
                    </div>
                    <Switch checked={allowDownload} onCheckedChange={setAllowDownload} />
                  </div>

                  {saleMode !== 'no_sale' && <div className="flex items-center justify-between py-2">
                      <div>
                        <p className="text-sm font-medium">Permitir fotos extras</p>
                        <p className="text-xs text-muted-foreground">
                          Cliente pode selecionar além do limite
                        </p>
                      </div>
                      <Switch checked={allowExtraPhotos} onCheckedChange={setAllowExtraPhotos} />
                    </div>}
                </div>
              </div>
            </div>
          </div>;
      case 5:
        return <div className="space-y-6 animate-fade-in">
            <div>
              
              <p className="text-muted-foreground text-lg font-serif">
                Confira as informações antes de criar a galeria
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="lunari-card p-5 space-y-4">
                <h3 className="font-medium flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  Informações do Cliente
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cliente</span>
                    <span className="font-medium">{selectedClient?.name || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Email</span>
                    <span className="font-medium">{selectedClient?.email || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Sessão</span>
                    <span className="font-medium">{sessionName || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pacote</span>
                    <span className="font-medium">{packageName || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Fotos incluídas</span>
                    <span className="font-medium">{includedPhotos}</span>
                  </div>
                </div>
              </div>

              <div className="lunari-card p-5 space-y-4">
                <h3 className="font-medium flex items-center gap-2">
                  <Tag className="h-4 w-4 text-primary" />
                  Configuração de Venda
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Modo de venda</span>
                    <span className="font-medium">{getSaleModeLabel()}</span>
                  </div>
                  {saleMode !== 'no_sale' && <>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Modelo de preço</span>
                        <span className="font-medium">{getPricingModelLabel()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Tipo de cobrança</span>
                        <span className="font-medium">{getChargeTypeLabel()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Valor por foto</span>
                        <span className="font-medium">R$ {fixedPrice.toFixed(2)}</span>
                      </div>
                      {pricingModel === 'packages' && discountPackages.length > 0 && <div className="flex justify-between">
                          <span className="text-muted-foreground">Pacotes de desconto</span>
                          <span className="font-medium">{discountPackages.length} configurados</span>
                        </div>}
                    </>}
                </div>
              </div>

              <div className="lunari-card p-5 space-y-4">
                <h3 className="font-medium flex items-center gap-2">
                  <Settings className="h-4 w-4 text-primary" />
                  Configurações
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Fotos</span>
                    <span className="font-medium">{uploadedCount} arquivos</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Prazo</span>
                    <span className="font-medium">{customDays} dias</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tamanho</span>
                    <span className="font-medium">{imageResizeOption}px</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Marca d'água</span>
                    <span className="font-medium capitalize">{watermarkType === 'none' ? 'Nenhuma' : watermarkType}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Comentários</span>
                    <span className="font-medium">{allowComments ? 'Sim' : 'Não'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Download</span>
                    <span className="font-medium">{allowDownload ? 'Ativado' : 'Desativado'}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-primary/10 text-sm">
              <p className="text-primary font-medium mb-1">
                ✨ Pronto para criar!
              </p>
              <p className="text-muted-foreground">
                Após criar a galeria, você poderá enviar o link de seleção para o cliente.
              </p>
            </div>
          </div>;
      default:
        return null;
    }
  };
  return <div className="max-w-5xl mx-auto animate-fade-in pb-24">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" onClick={handleBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-semibold">
            Nova Galeria
          </h1>
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
        return <div key={step.id} className="flex items-center">
              <div className={cn('flex items-center gap-2 px-3 py-1.5 rounded-full transition-colors whitespace-nowrap', isActive && 'bg-primary text-primary-foreground', isCompleted && 'bg-primary/20 text-primary', !isActive && !isCompleted && 'text-muted-foreground')}>
                {isCompleted ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                <span className="text-sm font-medium hidden sm:block">
                  {step.name}
                </span>
              </div>
              {index < steps.length - 1 && <div className={cn('h-px w-4 md:w-12 mx-1 md:mx-2', isCompleted ? 'bg-primary' : 'bg-border')} />}
            </div>;
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
          
          <div className="flex items-center gap-2">
            {/* Save Draft button - always available */}
            <Button variant="outline" onClick={handleSaveDraft}>
              <Save className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Salvar Rascunho</span>
              <span className="sm:hidden">Salvar</span>
            </Button>
            
            <Button variant="terracotta" onClick={handleNext}>
              {currentStep === 5 ? 'Criar Galeria' : 'Próximo'}
              {currentStep < 5 && <ArrowRight className="h-4 w-4 ml-2" />}
            </Button>
          </div>
        </div>
      </div>
    </div>;
}