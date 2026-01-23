import { useState, useEffect, useMemo } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, differenceInHours, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Calendar, 
  Image, 
  Check, 
  AlertTriangle, 
  Clock,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/Logo';
import { MasonryGrid, MasonryItem } from '@/components/MasonryGrid';
import { PhotoCard } from '@/components/PhotoCard';
import { Lightbox } from '@/components/Lightbox';
import { SelectionSummary } from '@/components/SelectionSummary';
import { SelectionReview } from '@/components/SelectionReview';
import { SelectionCheckout } from '@/components/SelectionCheckout';
import { PasswordScreen } from '@/components/PasswordScreen';
import { getCloudinaryPhotoUrl } from '@/lib/cloudinaryUrl';
import { supabase } from '@/integrations/supabase/client';
import { WatermarkSettings } from '@/types/gallery';
import { GalleryPhoto, Gallery } from '@/types/gallery';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { calcularPrecoProgressivo, RegrasCongeladas } from '@/lib/pricingUtils';

type SelectionStep = 'gallery' | 'review' | 'checkout' | 'confirmed';

const SUPABASE_URL = 'https://tlnjspsywycbudhewsfv.supabase.co';

// Check if the param is a UUID (legacy) or token (new)
function isUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

export default function ClientGallery() {
  const { id, token } = useParams();
  const location = useLocation();
  const queryClient = useQueryClient();
  
  // Determine if we're using token or legacy UUID
  const identifier = token || id;
  const isLegacyAccess = identifier ? isUUID(identifier) : false;
  
  const [showWelcome, setShowWelcome] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [currentStep, setCurrentStep] = useState<SelectionStep>('gallery');
  const [localPhotos, setLocalPhotos] = useState<GalleryPhoto[]>([]);
  const [isConfirmed, setIsConfirmed] = useState(false);
  
  // Password state
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [isCheckingPassword, setIsCheckingPassword] = useState(false);
  const [sessionPassword, setSessionPassword] = useState<string | null>(() => {
    // Check sessionStorage for previously entered password
    return sessionStorage.getItem(`gallery_password_${identifier}`);
  });

  // R2 Worker is used for image URLs (no async config needed)

  // 1. Fetch gallery via Edge Function (handles token + password validation)
  const { data: galleryResponse, isLoading: isLoadingGallery, error: galleryError, refetch: refetchGallery } = useQuery({
    queryKey: ['client-gallery', identifier, sessionPassword],
    queryFn: async () => {
      if (!identifier) return null;
      
      // For legacy UUID access, use direct Supabase query
      if (isLegacyAccess) {
        const { data, error } = await supabase
          .from('galerias')
          .select('*')
          .eq('id', identifier)
          .single();
        
        if (error) throw new Error('Galeria não encontrada');
        return { success: true, gallery: data, photos: null, isLegacy: true };
      }
      
      // For token access, use Edge Function
      const response = await fetch(`${SUPABASE_URL}/functions/v1/gallery-access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          token: identifier, 
          password: sessionPassword 
        }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        if (result.code === 'NOT_FOUND') {
          throw new Error('Galeria não encontrada');
        }
        if (result.code === 'WRONG_PASSWORD') {
          throw new Error('Senha incorreta');
        }
        throw new Error(result.error || 'Erro ao acessar galeria');
      }
      
      return result;
    },
    enabled: !!identifier,
    retry: false,
  });

  // Handle password requirement
  useEffect(() => {
    if (galleryResponse?.requiresPassword) {
      setRequiresPassword(true);
    }
  }, [galleryResponse]);

  // Extract gallery data from response (handle both legacy and new format)
  const supabaseGallery = useMemo(() => {
    if (!galleryResponse) return null;
    if (galleryResponse.isLegacy) return galleryResponse.gallery;
    if (galleryResponse.success) return galleryResponse.gallery;
    return null;
  }, [galleryResponse]);

  // Get gallery ID for queries
  const galleryId = supabaseGallery?.id || (isLegacyAccess ? identifier : null);

  // 2. Fetch photos from Supabase (for legacy) or use from response (for token)
  const { data: supabasePhotos, isLoading: isLoadingPhotos } = useQuery({
    queryKey: ['client-gallery-photos', galleryId],
    queryFn: async () => {
      // For token access, photos come from the Edge Function response
      if (!isLegacyAccess && galleryResponse?.photos) {
        return galleryResponse.photos;
      }
      
      if (!galleryId) return [];
      
      const { data, error } = await supabase
        .from('galeria_fotos')
        .select('*')
        .eq('galeria_id', galleryId)
        .order('order_index');
      
      if (error) {
        console.error('Photos fetch error:', error);
        return [];
      }
      
      return data || [];
    },
    enabled: !!supabaseGallery,
  });

  // 3. Transform gallery data to local format (handles both legacy DB row and Edge Function response)
  const transformedGallery = useMemo((): Gallery | null => {
    if (!supabaseGallery) return null;
    
    // Handle Edge Function response format vs legacy DB format
    const isEdgeFunctionFormat = 'sessionName' in supabaseGallery;
    
    const config = isEdgeFunctionFormat 
      ? (supabaseGallery.settings as Record<string, unknown> | null)
      : (supabaseGallery.configuracoes as Record<string, unknown> | null);
    const watermark = config?.watermark as WatermarkSettings | undefined;
    const watermarkDisplayRaw = config?.watermarkDisplay as string | undefined;
    const watermarkDisplay: 'all' | 'fullscreen' | 'none' = 
      watermarkDisplayRaw === 'fullscreen' || watermarkDisplayRaw === 'none' 
        ? watermarkDisplayRaw 
        : 'all';
    
    const deadlineRaw = isEdgeFunctionFormat ? supabaseGallery.deadline : supabaseGallery.prazo_selecao;
    const deadline = deadlineRaw ? new Date(deadlineRaw) : null;
    
    return {
      id: supabaseGallery.id,
      clientName: (isEdgeFunctionFormat ? supabaseGallery.clientName : supabaseGallery.cliente_nome) || 'Cliente',
      clientEmail: (isEdgeFunctionFormat ? '' : supabaseGallery.cliente_email) || '',
      sessionName: (isEdgeFunctionFormat ? supabaseGallery.sessionName : supabaseGallery.nome_sessao) || 'Sessão de Fotos',
      packageName: (isEdgeFunctionFormat ? supabaseGallery.packageName : supabaseGallery.nome_pacote) || 'Pacote',
      includedPhotos: (isEdgeFunctionFormat ? supabaseGallery.includedPhotos : supabaseGallery.fotos_incluidas) || 10,
      extraPhotoPrice: (isEdgeFunctionFormat ? supabaseGallery.extraPhotoPrice : supabaseGallery.valor_foto_extra) || 25,
      status: 'sent' as Gallery['status'],
      selectionStatus: (isEdgeFunctionFormat ? supabaseGallery.selectionStatus : supabaseGallery.status_selecao) === 'confirmado' ? 'confirmed' : 'in_progress',
      createdAt: new Date(),
      updatedAt: new Date(),
      saleSettings: {
        mode: 'sale_without_payment',
        pricingModel: 'fixed',
        chargeType: 'only_extras',
        fixedPrice: (isEdgeFunctionFormat ? supabaseGallery.extraPhotoPrice : supabaseGallery.valor_foto_extra) || 25,
        discountPackages: [],
      },
      settings: {
        welcomeMessage: (isEdgeFunctionFormat ? supabaseGallery.welcomeMessage : supabaseGallery.mensagem_boas_vindas) || 'Olá {cliente}! Bem-vindo à galeria da sua sessão {sessao}.',
        deadline: deadline || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        deadlinePreset: 7,
        watermark: watermark || { type: 'standard', opacity: 40, position: 'center' },
        watermarkDisplay,
        imageResizeOption: 1920,
        allowComments: config?.allowComments !== false,
        allowDownload: config?.allowDownload === true,
        allowExtraPhotos: true,
      },
      photos: [],
      actions: [],
      selectedCount: 0,
      extraCount: 0,
      extraTotal: 0,
    };
  }, [supabaseGallery]);

  // Check if deadline is actually set in database
  const hasDeadline = !!supabaseGallery?.prazo_selecao;

  // 4. Transform photos with R2 Worker URLs
  const photos = useMemo((): GalleryPhoto[] => {
    if (!supabasePhotos || !transformedGallery) return [];
    
    // Get watermark settings from gallery
    const watermarkSettings = transformedGallery.settings?.watermark;
    
    return supabasePhotos.map((photo) => {
      const photoWidth = photo.width || 800;
      const photoHeight = photo.height || 600;
      const storagePath = photo.storage_key;
      
      return {
        id: photo.id,
        filename: photo.original_filename || photo.filename,
        originalFilename: photo.original_filename || photo.filename,
        thumbnailUrl: getCloudinaryPhotoUrl(storagePath, 'thumbnail', null),
        previewUrl: getCloudinaryPhotoUrl(storagePath, 'preview', watermarkSettings, photoWidth, photoHeight),
        originalUrl: getCloudinaryPhotoUrl(storagePath, 'full', watermarkSettings, photoWidth, photoHeight),
        width: photoWidth,
        height: photoHeight,
        isSelected: photo.is_selected || false,
        isFavorite: photo.is_favorite || false,
        comment: photo.comment || '',
        order: photo.order_index || 0,
      };
    });
  }, [supabasePhotos, transformedGallery]);

  // 5. Mutation for toggling selection via Edge Function
  const selectionMutation = useMutation({
    mutationFn: async ({ photoId, action, comment }: { photoId: string; action: 'toggle' | 'select' | 'deselect' | 'comment' | 'favorite'; comment?: string }) => {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/client-selection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ galleryId, photoId, action, comment }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao atualizar seleção');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setLocalPhotos(prev => prev.map(p => 
        p.id === data.photo.id 
          ? { 
              ...p, 
              isSelected: data.photo.is_selected, 
              isFavorite: data.photo.is_favorite ?? p.isFavorite,
              comment: data.photo.comment || p.comment 
            } 
          : p
      ));
    },
    onError: (error: Error) => {
      toast.error(error.message);
      queryClient.invalidateQueries({ queryKey: ['client-gallery-photos', galleryId] });
    },
  });

  // 6. Mutation for confirming selection via Edge Function
  const confirmMutation = useMutation({
    mutationFn: async (pricingData: { selectedCount: number; extraCount: number; valorUnitario: number; valorTotal: number }) => {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/confirm-selection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          galleryId, 
          selectedCount: pricingData.selectedCount,
          extraCount: pricingData.extraCount,
          valorUnitario: pricingData.valorUnitario,
          valorTotal: pricingData.valorTotal,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao confirmar seleção');
      }
      
      return response.json();
    },
    onSuccess: () => {
      setIsConfirmed(true);
      setCurrentStep('confirmed');
      toast.success('Seleção confirmada!', {
        description: 'O fotógrafo receberá sua seleção.',
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao confirmar seleção');
    },
  });

  // Sync photos state when data loads and detect if already confirmed
  useEffect(() => {
    if (photos.length > 0) {
      setLocalPhotos(photos);
      const isAlreadyConfirmed = supabaseGallery?.status_selecao === 'confirmado' || 
                                 supabaseGallery?.finalized_at;
      setIsConfirmed(!!isAlreadyConfirmed);
      if (isAlreadyConfirmed) {
        setCurrentStep('confirmed');
        setShowWelcome(false);
      }
    }
  }, [photos, supabaseGallery?.status_selecao, supabaseGallery?.finalized_at]);


  const gallery = transformedGallery;
  const isLoading = isLoadingGallery || isLoadingPhotos;

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Carregando galeria...</p>
        </div>
      </div>
    );
  }

  // Handle password submit
  const handlePasswordSubmit = async (password: string) => {
    setIsCheckingPassword(true);
    setPasswordError(undefined);
    
    try {
      // Store password in session and refetch
      sessionStorage.setItem(`gallery_password_${identifier}`, password);
      setSessionPassword(password);
      
      // Force refetch with new password
      const response = await fetch(`${SUPABASE_URL}/functions/v1/gallery-access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          token: identifier, 
          password: password 
        }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        if (result.code === 'WRONG_PASSWORD') {
          setPasswordError('Senha incorreta');
          sessionStorage.removeItem(`gallery_password_${identifier}`);
          return;
        }
        throw new Error(result.error || 'Erro ao acessar galeria');
      }
      
      // Success - refetch gallery data
      await refetchGallery();
      setRequiresPassword(false);
    } catch (error) {
      setPasswordError('Erro ao verificar senha');
      sessionStorage.removeItem(`gallery_password_${identifier}`);
    } finally {
      setIsCheckingPassword(false);
    }
  };

  // Password screen - BEFORE error check
  if (requiresPassword && !gallery) {
    return (
      <PasswordScreen
        sessionName={galleryResponse?.sessionName}
        studioName={galleryResponse?.studioSettings?.studio_name}
        studioLogo={galleryResponse?.studioSettings?.studio_logo_url}
        onSubmit={handlePasswordSubmit}
        error={passwordError}
        isLoading={isCheckingPassword}
      />
    );
  }

  // Error state - gallery not found
  if (galleryError || !gallery) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <header className="flex items-center justify-center p-4 border-b border-border/50">
          <Logo size="sm" />
        </header>
        
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
              <AlertCircle className="h-10 w-10 text-destructive" />
            </div>
            
            <div>
              <h1 className="font-display text-2xl font-semibold mb-2">
                Galeria não encontrada
              </h1>
              <p className="text-muted-foreground text-sm">
                Verifique se o link está correto ou entre em contato com o fotógrafo.
              </p>
            </div>

            <div className="lunari-card p-4">
              <p className="text-xs text-muted-foreground">
                ID solicitado: <code className="bg-muted px-1 rounded">{identifier}</code>
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // R2 config is synchronous - no error handling needed

  const hoursUntilDeadline = hasDeadline 
    ? differenceInHours(gallery.settings.deadline, new Date())
    : 999;
  const isNearDeadline = hasDeadline && hoursUntilDeadline <= 48 && hoursUntilDeadline > 0;
  const isExpired = hasDeadline && isPast(gallery.settings.deadline);
  const isBlocked = isExpired || isConfirmed;

  // Get frozen pricing rules from gallery
  const regrasCongeladas = supabaseGallery?.regras_congeladas as RegrasCongeladas | null;

  const selectedCount = localPhotos.filter(p => p.isSelected).length;
  const extraCount = Math.max(0, selectedCount - gallery.includedPhotos);
  
  // Use progressive pricing calculation
  const { valorUnitario, valorTotal: extraTotal, economia } = calcularPrecoProgressivo(
    extraCount,
    regrasCongeladas,
    gallery.extraPhotoPrice
  );

  const toggleSelection = (photoId: string) => {
    if (isBlocked) return;
    
    const photo = localPhotos.find(p => p.id === photoId);
    if (photo) {
      // Optimistic update
      setLocalPhotos(prev => prev.map(p => 
        p.id === photoId ? { ...p, isSelected: !p.isSelected } : p
      ));
      selectionMutation.mutate({ photoId, action: 'toggle' });
    }
  };

  const handleComment = (photoId: string, comment: string) => {
    setLocalPhotos(prev => prev.map(p => 
      p.id === photoId ? { ...p, comment } : p
    ));
    selectionMutation.mutate({ photoId, action: 'comment', comment });
    toast.success('Comentário salvo!');
  };

  const handleFavorite = (photoId: string) => {
    setLocalPhotos(prev => prev.map(p => 
      p.id === photoId ? { ...p, isFavorite: !p.isFavorite } : p
    ));
    selectionMutation.mutate({ photoId, action: 'favorite' });
  };

  const handleStartConfirmation = () => {
    if (extraCount > 0) {
      setCurrentStep('review');
    } else {
      setCurrentStep('checkout');
    }
  };

  const handleConfirm = () => {
    const currentSelectedCount = localPhotos.filter(p => p.isSelected).length;
    const currentExtraCount = Math.max(0, currentSelectedCount - gallery.includedPhotos);
    const { valorUnitario: currentValorUnitario, valorTotal: currentValorTotal } = calcularPrecoProgressivo(
      currentExtraCount,
      regrasCongeladas,
      gallery.extraPhotoPrice
    );
    
    confirmMutation.mutate({
      selectedCount: currentSelectedCount,
      extraCount: currentExtraCount,
      valorUnitario: currentValorUnitario,
      valorTotal: currentValorTotal,
    });
  };

  // Parse welcome message
  const welcomeMessage = gallery.settings.welcomeMessage
    .replace('{cliente}', gallery.clientName.split(' ')[0])
    .replace('{sessao}', gallery.sessionName)
    .replace('{estudio}', 'Studio Lunari');

  if (showWelcome) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <header className="flex items-center justify-center p-4 border-b border-border/50">
          <Logo size="sm" />
        </header>
        
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full text-center space-y-6 animate-slide-up">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Image className="h-10 w-10 text-primary" />
            </div>
            
            <div>
              <h1 className="font-display text-3xl font-semibold mb-2">
                {gallery.sessionName}
              </h1>
              <p className="text-muted-foreground">
                {localPhotos.length} fotos disponíveis
              </p>
            </div>

            <div className="lunari-card p-6 text-left">
              <p className="whitespace-pre-line text-sm leading-relaxed">
                {welcomeMessage}
              </p>
            </div>

            <div className="flex items-center justify-center gap-4 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Check className="h-4 w-4 text-primary" />
                <span>{gallery.includedPhotos} fotos incluídas</span>
              </div>
              {hasDeadline && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>
                    até {format(gallery.settings.deadline, "dd 'de' MMM", { locale: ptBR })}
                  </span>
                </div>
              )}
            </div>

            {isNearDeadline && (
              <div className="flex items-center gap-2 justify-center text-warning">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm font-medium">
                  Atenção: {hoursUntilDeadline}h restantes para seleção
                </span>
              </div>
            )}

            {isExpired && (
              <div className="flex items-center gap-2 justify-center text-destructive">
                <Clock className="h-4 w-4" />
                <span className="text-sm font-medium">
                  Prazo de seleção expirado
                </span>
              </div>
            )}

            <Button 
              variant="terracotta" 
              size="xl" 
              className="w-full"
              onClick={() => setShowWelcome(false)}
            >
              {isExpired ? 'Visualizar Galeria' : 'Começar Seleção'}
            </Button>
          </div>
        </main>
      </div>
    );
  }

  // Render Review Step
  if (currentStep === 'review') {
    return (
      <SelectionReview
        photos={localPhotos}
        includedPhotos={gallery.includedPhotos}
        onBack={() => setCurrentStep('gallery')}
        onContinue={() => setCurrentStep('checkout')}
      />
    );
  }

  // Render Checkout Step
  if (currentStep === 'checkout') {
    return (
      <SelectionCheckout
        gallery={gallery}
        selectedCount={selectedCount}
        extraCount={extraCount}
        extraTotal={extraTotal}
        onBack={() => extraCount > 0 ? setCurrentStep('review') : setCurrentStep('gallery')}
        onConfirm={handleConfirm}
      />
    );
  }

  // Render Confirmed Step - Read-only view of selected photos
  if (currentStep === 'confirmed') {
    const confirmedSelectedPhotos = localPhotos.filter(p => p.isSelected);
    
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border/50">
          <div className="flex items-center justify-between px-3 py-3">
            <Logo size="sm" />
            <div className="text-right">
              <p className="text-sm font-medium">{gallery.sessionName}</p>
              <p className="text-xs text-muted-foreground">Seleção confirmada</p>
            </div>
          </div>
        </header>
        
        <main className="flex-1 p-4 space-y-6">
          {/* Success Banner */}
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Check className="h-5 w-5 text-green-500" />
              <h2 className="font-display text-lg font-semibold text-green-700 dark:text-green-400">
                Seleção Confirmada!
              </h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Você selecionou {confirmedSelectedPhotos.length} fotos. 
              Para alterações, entre em contato com o fotógrafo.
            </p>
          </div>

          {/* Selected Photos Grid - Read Only */}
          {confirmedSelectedPhotos.length > 0 ? (
            <>
              <h3 className="font-medium text-sm text-muted-foreground">
                Suas fotos selecionadas ({confirmedSelectedPhotos.length})
              </h3>
              <MasonryGrid>
                {confirmedSelectedPhotos.map((photo, index) => (
                  <MasonryItem key={photo.id}>
                    <div className="relative group cursor-pointer" onClick={() => setLightboxIndex(localPhotos.findIndex(p => p.id === photo.id))}>
                      <div className="aspect-square overflow-hidden rounded-lg">
                        <img 
                          src={photo.thumbnailUrl} 
                          alt={photo.filename}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                      {/* Selected indicator */}
                      <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center shadow-md">
                        <Check className="h-4 w-4 text-white" />
                      </div>
                      {/* Comment indicator */}
                      {photo.comment && (
                        <div className="absolute bottom-2 right-2 bg-background/90 rounded-full p-1.5 shadow-sm">
                          <AlertCircle className="h-3 w-3 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  </MasonryItem>
                ))}
              </MasonryGrid>
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>Nenhuma foto foi selecionada.</p>
            </div>
          )}
        </main>

        {/* Lightbox for confirmed view */}
        {lightboxIndex !== null && (
          <Lightbox
            photos={localPhotos}
            currentIndex={lightboxIndex}
            onClose={() => setLightboxIndex(null)}
            onNavigate={setLightboxIndex}
            onSelect={() => {}} // No selection in read-only mode
            watermarkDisplay={gallery.settings.watermarkDisplay}
            allowComments={false}
            disabled={true}
          />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border/50">
        <div className="flex items-center justify-between px-3 py-3">
          <Logo size="sm" />
          
          <div className="text-right">
            <p className="text-sm font-medium">{gallery.sessionName}</p>
            {hasDeadline && (
              <p className="text-xs text-muted-foreground">
                {format(gallery.settings.deadline, "dd 'de' MMMM", { locale: ptBR })}
              </p>
            )}
          </div>
        </div>

        {/* Selection Bar */}
        <div className={cn(
          'border-t border-border/50 bg-muted/50 py-2 px-3',
          isBlocked && 'bg-destructive/10'
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm">
                <span className="font-semibold">{selectedCount}</span>
                <span className="text-muted-foreground">/{gallery.includedPhotos} selecionadas</span>
              </span>
              {extraCount > 0 && (
                <span className="text-sm text-primary font-medium">
                  +{extraCount} extras (R$ {extraTotal.toFixed(2)})
                </span>
              )}
            </div>
            
            {isNearDeadline && !isExpired && (
              <span className="text-sm text-warning font-medium flex items-center gap-1">
                <AlertTriangle className="h-4 w-4" />
                {hoursUntilDeadline}h restantes
              </span>
            )}

            {isExpired && (
              <span className="text-sm text-destructive font-medium flex items-center gap-1">
                <Clock className="h-4 w-4" />
                Prazo expirado
              </span>
            )}

            {isConfirmed && (
              <span className="text-sm text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
                <Check className="h-4 w-4" />
                Seleção confirmada
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main Content - Full width gallery */}
      <main className="flex-1 px-1 sm:px-2 py-2 pb-20">
        <MasonryGrid>
          {localPhotos.map((photo, index) => (
            <MasonryItem key={photo.id}>
              <PhotoCard
                photo={photo}
                watermark={gallery.settings.watermark}
                watermarkDisplay={gallery.settings.watermarkDisplay}
                isSelected={photo.isSelected}
                allowComments={gallery.settings.allowComments}
                disabled={isBlocked}
                onSelect={() => toggleSelection(photo.id)}
                onViewFullscreen={() => setLightboxIndex(index)}
                onComment={() => {}}
                onFavorite={() => handleFavorite(photo.id)}
              />
            </MasonryItem>
          ))}
        </MasonryGrid>
      </main>

      {/* Bottom Bar Summary */}
      <SelectionSummary 
        gallery={{
          ...gallery,
          selectedCount,
          extraCount,
          extraTotal,
          selectionStatus: isConfirmed ? 'confirmed' : 'in_progress',
        }}
        onConfirm={handleStartConfirmation}
        isClient
        variant="bottom-bar"
        regrasCongeladas={supabaseGallery?.regras_congeladas as RegrasCongeladas | null}
      />

      {lightboxIndex !== null && (
        <Lightbox
          photos={localPhotos}
          currentIndex={lightboxIndex}
          watermark={gallery.settings.watermark}
          watermarkDisplay={gallery.settings.watermarkDisplay}
          allowComments={gallery.settings.allowComments}
          allowDownload={gallery.settings.allowDownload}
          disabled={isBlocked}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
          onSelect={(photoId) => toggleSelection(photoId)}
          onComment={handleComment}
          onFavorite={handleFavorite}
        />
      )}
    </div>
  );
}
