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
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/Logo';
import { MasonryGrid, MasonryItem } from '@/components/MasonryGrid';
import { PhotoCard } from '@/components/PhotoCard';
import { Lightbox } from '@/components/Lightbox';
import { SelectionSummary } from '@/components/SelectionSummary';
import { SelectionConfirmation } from '@/components/SelectionConfirmation';
import { PasswordScreen } from '@/components/PasswordScreen';
import { PaymentRedirect } from '@/components/PaymentRedirect';
import { PixPaymentScreen } from '@/components/PixPaymentScreen';
import { ClientGalleryHeader } from '@/components/ClientGalleryHeader';
import { getCloudinaryPhotoUrl } from '@/lib/cloudinaryUrl';
import { supabase } from '@/integrations/supabase/client';
import { WatermarkSettings, DiscountPackage } from '@/types/gallery';
import { GalleryPhoto, Gallery } from '@/types/gallery';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { calcularPrecoProgressivoComCredito, RegrasCongeladas } from '@/lib/pricingUtils';

// Helper to convert HEX to HSL values for CSS variables
function hexToHsl(hex: string): string | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;
  
  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

type SelectionStep = 'gallery' | 'confirmation' | 'payment' | 'confirmed';

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
  
  const [showWelcome, setShowWelcome] = useState(() => {
    // Se retornando de pagamento, pular tela de boas-vindas
    const params = new URLSearchParams(window.location.search);
    return params.get('payment') !== 'success';
  });
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [currentStep, setCurrentStep] = useState<SelectionStep>('gallery');
  const [localPhotos, setLocalPhotos] = useState<GalleryPhoto[]>([]);
  const [isConfirmed, setIsConfirmed] = useState(false);
  
  // Theme state for client gallery
  const [activeClientMode, setActiveClientMode] = useState<'light' | 'dark'>('light');
  
  // Payment state
  const [paymentInfo, setPaymentInfo] = useState<{
    checkoutUrl: string;
    provedor: string;
    valorTotal: number;
  } | null>(null);
  
  // PIX Manual payment state
  const [pixPaymentData, setPixPaymentData] = useState<{
    chavePix: string;
    nomeTitular: string;
    tipoChave?: string;
    valorTotal: number;
  } | null>(null);
  
  // Payment return detection state
  const [isProcessingPaymentReturn, setIsProcessingPaymentReturn] = useState(false);
  
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

  // Get session_id from gallery (for fetching frozen rules from Gestão session)
  // Support both camelCase (from Edge Function) and snake_case (from legacy)
  const sessionId = supabaseGallery?.sessionId || supabaseGallery?.session_id;

  // 2. Fetch frozen pricing rules from Gestão session (as fallback if Edge Function didn't load them)
  const { data: sessionRegras } = useQuery({
    queryKey: ['client-gallery-session-rules', sessionId],
    queryFn: async () => {
      if (!sessionId) return null;
      
      // Query by session_id (workflow string), not id (UUID)
      const { data, error } = await supabase
        .from('clientes_sessoes')
        .select('id, regras_congeladas, valor_foto_extra')
        .eq('session_id', sessionId)
        .single();
      
      if (error) {
        console.warn('Session rules fetch error:', error.message);
        return null;
      }
      
      console.log('📊 Session rules loaded for pricing:', data?.regras_congeladas ? 'yes' : 'no');
      return data;
    },
    // Only fetch if we have sessionId AND the gallery-access didn't already provide regras
    enabled: !!sessionId && !supabaseGallery?.regrasCongeladas,
  });

  // 3. Fetch photos from Supabase (for legacy) or use from response (for token)
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
      saleSettings: (() => {
        // Prioritize explicit saleSettings from Edge Function response
        const explicitSettings = isEdgeFunctionFormat 
          ? (supabaseGallery.saleSettings as Record<string, unknown> | null)
          : null;
        const configSettings = config?.saleSettings as Record<string, unknown> | null;
        const rawSettings = explicitSettings || configSettings;
        
        return {
          mode: (rawSettings?.mode as 'no_sale' | 'sale_with_payment' | 'sale_without_payment') || 'sale_without_payment',
          pricingModel: (rawSettings?.pricingModel as 'fixed' | 'packages') || 'fixed',
          chargeType: (rawSettings?.chargeType as 'all_selected' | 'only_extras') || 'only_extras',
          fixedPrice: (rawSettings?.fixedPrice as number) || (isEdgeFunctionFormat ? supabaseGallery.extraPhotoPrice : supabaseGallery.valor_foto_extra) || 25,
          discountPackages: (rawSettings?.discountPackages as DiscountPackage[]) || [],
          paymentMethod: (rawSettings?.paymentMethod as 'pix_manual' | 'infinitepay' | 'mercadopago' | undefined),
        };
      })(),
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
      // Check if we should request payment (sale_with_payment mode + extras)
      const saleMode = transformedGallery?.saleSettings?.mode;
      const shouldRequestPayment = saleMode === 'sale_with_payment' && pricingData.valorTotal > 0;
      
      const response = await fetch(`${SUPABASE_URL}/functions/v1/confirm-selection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          galleryId, 
          selectedCount: pricingData.selectedCount,
          extraCount: pricingData.extraCount,
          valorUnitario: pricingData.valorUnitario,
          valorTotal: pricingData.valorTotal,
          requestPayment: shouldRequestPayment,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao confirmar seleção');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setIsConfirmed(true);
      
      // PIX Manual - show internal payment screen
      if (data.requiresPayment && data.paymentMethod === 'pix_manual' && data.pixData) {
        setPixPaymentData({
          chavePix: data.pixData.chavePix || '',
          nomeTitular: data.pixData.nomeTitular || '',
          tipoChave: data.pixData.tipoChave,
          valorTotal: data.valorTotal || 0,
        });
        setCurrentStep('payment');
        toast.success('Seleção confirmada!', {
          description: 'Complete o pagamento via PIX para liberar suas fotos.',
        });
        return;
      }
      
      // Checkout externo (InfinitePay/MercadoPago) - redirect
      if (data.requiresPayment && data.checkoutUrl) {
        setPaymentInfo({
          checkoutUrl: data.checkoutUrl,
          provedor: data.provedor || 'pagamento',
          valorTotal: data.valorTotal || 0,
        });
        setCurrentStep('payment');
        toast.success('Seleção confirmada!', {
          description: 'Redirecionando para pagamento...',
        });
        return;
      }
      
      // Sem pagamento
      setCurrentStep('confirmed');
      toast.success('Seleção confirmada com sucesso!', {
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

  // LAYER 2: Detect payment return via redirect URL (?payment=success)
  // Captures ALL InfinitePay redirect parameters for public API verification
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get('payment');
    
    // Capture ALL InfinitePay redirect parameters
    const orderNsu = params.get('order_nsu');
    const transactionNsu = params.get('transaction_nsu');
    const slug = params.get('slug');
    const receiptUrl = params.get('receipt_url');
    const captureMethod = params.get('capture_method');
    
    if (paymentStatus === 'success' && galleryId && !isProcessingPaymentReturn) {
      setIsProcessingPaymentReturn(true);
      setShowWelcome(false); // Garantir que welcome não apareça
      
      const confirmPaymentReturn = async () => {
        try {
          console.log('🔄 Detectado retorno de pagamento - parâmetros:', {
            orderNsu,
            transactionNsu,
            slug,
            captureMethod,
            hasReceiptUrl: !!receiptUrl,
          });
          
          // Call check-payment-status with all InfinitePay parameters
          const response = await fetch(`${SUPABASE_URL}/functions/v1/check-payment-status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              sessionId: sessionId,
              orderNsu: orderNsu,
              transactionNsu: transactionNsu,
              slug: slug,
              receiptUrl: receiptUrl,
              forceUpdate: true,
            }),
          });
          
          const result = await response.json();
          console.log('✅ Resultado confirmação pagamento:', result);
          
          if (result.status === 'pago' || result.updated) {
            toast.success('Pagamento confirmado!', {
              description: 'Sua seleção foi finalizada com sucesso.',
            });
            setCurrentStep('confirmed');
            setIsConfirmed(true);
            
            // Clean URL params without reload
            const newUrl = window.location.pathname;
            window.history.replaceState({}, '', newUrl);
          }
        } catch (error) {
          console.error('❌ Erro ao confirmar pagamento:', error);
        } finally {
          setIsProcessingPaymentReturn(false);
        }
      };
      
      confirmPaymentReturn();
    }
  }, [galleryId, sessionId, isProcessingPaymentReturn]);

  // Initialize client mode from gallery response
  useEffect(() => {
    if (galleryResponse?.clientMode) {
      setActiveClientMode(galleryResponse.clientMode);
    }
  }, [galleryResponse?.clientMode]);

  const gallery = transformedGallery;
  const isLoading = isLoadingGallery || isLoadingPhotos;

  // Build dynamic CSS variables from custom theme - MUST be before early returns
  const themeStyles = useMemo(() => {
    const theme = galleryResponse?.theme;
    if (!theme) return {};
    
    // Use backgroundMode (light/dark) instead of custom background color
    const backgroundMode = theme.backgroundMode || 'light';
    
    // Base colors depend on background mode
    const baseColors = backgroundMode === 'dark' ? {
      '--background': '25 15% 10%',
      '--foreground': '30 20% 95%',
      '--card': '25 15% 13%',
      '--card-foreground': '30 20% 95%',
      '--muted': '25 12% 20%',
      '--muted-foreground': '30 15% 60%',
      '--border': '25 12% 22%',
      '--primary-foreground': '25 15% 10%',
      '--popover': '25 15% 13%',
      '--popover-foreground': '30 20% 95%',
      // Gradients for dark mode
      '--gradient-card': 'linear-gradient(180deg, hsl(25 15% 13%) 0%, hsl(25 12% 11%) 100%)',
    } : {
      '--background': '30 25% 97%',
      '--foreground': '25 20% 15%',
      '--card': '30 20% 99%',
      '--card-foreground': '25 20% 15%',
      '--muted': '30 15% 92%',
      '--muted-foreground': '25 10% 45%',
      '--border': '30 15% 88%',
      '--primary-foreground': '30 25% 98%',
      '--popover': '30 20% 99%',
      '--popover-foreground': '25 20% 15%',
      // Gradients for light mode
      '--gradient-card': 'linear-gradient(180deg, hsl(30 20% 99%) 0%, hsl(30 15% 96%) 100%)',
    };
    
    // Convert hex colors to HSL
    const primaryHsl = hexToHsl(theme.primaryColor);
    const accentHsl = hexToHsl(theme.accentColor);
    
    return {
      ...baseColors,
      '--primary': primaryHsl || '18 55% 55%',
      '--accent': accentHsl || '120 20% 62%',
      '--ring': primaryHsl || '18 55% 55%',
    } as React.CSSProperties;
  }, [galleryResponse?.theme]);

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
        themeStyles={themeStyles}
        backgroundMode={galleryResponse?.theme?.backgroundMode || 'light'}
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

  // Get frozen pricing rules - prioritize rules from Edge Function response (already loaded from session)
  // Fallback to separate session query, then to gallery rules
  const regrasCongeladas = 
    (supabaseGallery?.regrasCongeladas as unknown as RegrasCongeladas | null)
    || (sessionRegras?.regras_congeladas as unknown as RegrasCongeladas | null) 
    || (supabaseGallery?.regras_congeladas as unknown as RegrasCongeladas | null);

  const selectedCount = localPhotos.filter(p => p.isSelected).length;
  const extrasNecessarias = Math.max(0, selectedCount - gallery.includedPhotos);
  
  // Credit system: Get extras already paid from Edge Function response
  const extrasPagasTotal = supabaseGallery?.extrasPagasTotal || supabaseGallery?.total_fotos_extras_vendidas || 0;
  
  // Calculate extras to charge (respects credit system)
  const extrasACobrar = Math.max(0, extrasNecessarias - extrasPagasTotal);
  
  // For display purposes, use total extras needed
  const extraCount = extrasNecessarias;
  
  // Get already paid amount for credit calculation (camelCase from Edge Function response)
  const valorJaPago = supabaseGallery?.valorTotalVendido || supabaseGallery?.valor_total_vendido || 0;
  
  // Use credit-based progressive pricing calculation:
  // Formula: valor_a_cobrar = (total_extras × valor_faixa) - valor_já_pago
  const { 
    valorUnitario, 
    valorACobrar: extraTotal, 
    valorTotalIdeal,
    economia,
    totalExtras: totalExtrasAcumuladas 
  } = calcularPrecoProgressivoComCredito(
    extrasACobrar,      // New extras in this cycle
    extrasPagasTotal,   // Previously paid quantity
    valorJaPago,        // Previously paid amount R$
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
    // Go directly to unified confirmation screen (skips separate review step)
    setCurrentStep('confirmation');
  };

  const handleConfirm = () => {
    const currentSelectedCount = localPhotos.filter(p => p.isSelected).length;
    const currentExtrasNecessarias = Math.max(0, currentSelectedCount - gallery.includedPhotos);
    const currentExtrasACobrar = Math.max(0, currentExtrasNecessarias - extrasPagasTotal);
    
    // Use credit-based pricing
    const resultado = calcularPrecoProgressivoComCredito(
      currentExtrasACobrar,    // New extras in this cycle
      extrasPagasTotal,        // Previously paid quantity
      valorJaPago,             // Previously paid amount R$
      regrasCongeladas,
      gallery.extraPhotoPrice
    );
    
    confirmMutation.mutate({
      selectedCount: currentSelectedCount,
      extraCount: currentExtrasACobrar, // Pass extras to charge
      valorUnitario: resultado.valorUnitario,
      valorTotal: resultado.valorACobrar, // Use credit-adjusted amount
    });
  };

  // Parse welcome message
  const welcomeMessage = gallery.settings.welcomeMessage
    .replace('{cliente}', gallery.clientName.split(' ')[0])
    .replace('{sessao}', gallery.sessionName)
    .replace('{estudio}', 'Studio Lunari');

  if (showWelcome) {
    return (
      <div 
        className={cn(
          "min-h-screen flex flex-col",
          activeClientMode === 'dark' ? 'dark bg-background text-foreground' : 'bg-background text-foreground'
        )}
        style={themeStyles}
      >
        <header className="flex items-center justify-center p-4 border-b border-border/50">
          {galleryResponse?.studioSettings?.studio_logo_url ? (
            <img 
              src={galleryResponse.studioSettings.studio_logo_url} 
              alt={galleryResponse?.studioSettings?.studio_name || 'Logo'} 
              className="h-10 max-w-[180px] object-contain"
            />
          ) : (
            <Logo size="sm" variant="gallery" />
          )}
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

  // Render Unified Confirmation Step (combines Review + Checkout)
  if (currentStep === 'confirmation') {
    // Check if payment provider is configured (for sale_with_payment mode)
    const isWithPayment = gallery.saleSettings?.mode === 'sale_with_payment';
    const hasPaymentProvider = isWithPayment;
    
    return (
      <SelectionConfirmation
        gallery={gallery}
        photos={localPhotos}
        selectedCount={selectedCount}
        extraCount={extraCount}
        extrasACobrar={extrasACobrar}
        extrasPagasAnteriormente={extrasPagasTotal}
        valorJaPago={valorJaPago}
        regrasCongeladas={regrasCongeladas}
        hasPaymentProvider={hasPaymentProvider}
        isConfirming={confirmMutation.isPending}
        onBack={() => setCurrentStep('gallery')}
        onConfirm={handleConfirm}
        themeStyles={themeStyles}
        backgroundMode={galleryResponse?.theme?.backgroundMode || 'light'}
      />
    );
  }

  // Render Payment Step - PIX Manual (internal)
  if (currentStep === 'payment' && pixPaymentData) {
    return (
      <PixPaymentScreen
        chavePix={pixPaymentData.chavePix}
        nomeTitular={pixPaymentData.nomeTitular}
        tipoChave={pixPaymentData.tipoChave}
        valorTotal={pixPaymentData.valorTotal}
        studioName={galleryResponse?.studioSettings?.studio_name}
        studioLogoUrl={galleryResponse?.studioSettings?.studio_logo_url}
        onPaymentConfirmed={() => {
          // Client indicates they've paid - go to confirmed step
          setCurrentStep('confirmed');
          toast.success('Obrigado!', {
            description: 'Aguarde a confirmação do pagamento pelo fotógrafo.',
          });
        }}
        themeStyles={themeStyles}
        backgroundMode={galleryResponse?.theme?.backgroundMode || 'light'}
      />
    );
  }

  // Render Payment Redirect Step - Checkout externo (InfinitePay/MercadoPago)
  if (currentStep === 'payment' && paymentInfo) {
    return (
      <PaymentRedirect
        checkoutUrl={paymentInfo.checkoutUrl}
        provedor={paymentInfo.provedor}
        valorTotal={paymentInfo.valorTotal}
        onCancel={() => setCurrentStep('confirmed')}
        themeStyles={themeStyles}
        backgroundMode={galleryResponse?.theme?.backgroundMode || 'light'}
      />
    );
  }

  // Render Confirmed Step - Read-only view of selected photos
  if (currentStep === 'confirmed') {
    const confirmedSelectedPhotos = localPhotos.filter(p => p.isSelected);
    
    return (
      <div 
        className={cn(
          "min-h-screen flex flex-col",
          activeClientMode === 'dark' ? 'dark bg-background text-foreground' : 'bg-background text-foreground'
        )}
        style={themeStyles}
      >
        <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border/50">
          <div className="flex items-center justify-center px-3 py-4">
            {galleryResponse?.studioSettings?.studio_logo_url ? (
              <img 
                src={galleryResponse.studioSettings.studio_logo_url} 
                alt={galleryResponse?.studioSettings?.studio_name || 'Logo'} 
                className="h-10 max-w-[180px] object-contain"
              />
            ) : (
              <Logo size="sm" variant="gallery" />
            )}
          </div>
          <div className="text-center py-2 border-t border-border/30">
            <p className="text-sm font-medium">{gallery.sessionName}</p>
            <p className="text-xs text-muted-foreground">Seleção confirmada</p>
          </div>
        </header>
        
        <main className="flex-1 p-4 space-y-6">
          {/* Success Banner */}
          <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Check className="h-5 w-5 text-primary" />
              <h2 className="font-display text-lg font-semibold text-primary">
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
                    <div className="relative group cursor-pointer" onClick={() => setLightboxIndex(index)}>
                      <div className="aspect-square overflow-hidden rounded-lg">
                        <img 
                          src={photo.thumbnailUrl} 
                          alt={photo.filename}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                      {/* Selected indicator */}
                      <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-md">
                        <Check className="h-4 w-4 text-primary-foreground" />
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

        {/* Lightbox for confirmed view - only selected photos */}
        {lightboxIndex !== null && (
          <Lightbox
            photos={confirmedSelectedPhotos}
            currentIndex={lightboxIndex}
            watermark={gallery.settings.watermark}
            watermarkDisplay={gallery.settings.watermarkDisplay}
            allowComments={false}
            allowDownload={gallery.settings.allowDownload}
            disabled={true}
            onClose={() => setLightboxIndex(null)}
            onNavigate={setLightboxIndex}
            onSelect={() => {}}
          />
        )}
      </div>
    );
  }

  return (
    <div 
      className={cn(
        "min-h-screen flex flex-col",
        activeClientMode === 'dark' ? 'dark bg-background text-foreground' : 'bg-background text-foreground'
      )}
      style={themeStyles}
    >
      {/* New Header with centered logo */}
      <ClientGalleryHeader
        sessionName={gallery.sessionName}
        totalPhotos={localPhotos.length}
        deadline={hasDeadline ? gallery.settings.deadline : null}
        hasDeadline={hasDeadline}
        hoursUntilDeadline={hoursUntilDeadline}
        isNearDeadline={isNearDeadline}
        isExpired={isExpired}
        isConfirmed={isConfirmed}
        selectedCount={selectedCount}
        includedPhotos={gallery.includedPhotos}
        extraCount={extraCount}
        studioLogoUrl={galleryResponse?.studioSettings?.studio_logo_url}
        studioName={galleryResponse?.studioSettings?.studio_name}
        contactEmail={null}
        activeClientMode={activeClientMode}
        onToggleMode={() => setActiveClientMode(m => m === 'light' ? 'dark' : 'light')}
      />

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
        regrasCongeladas={regrasCongeladas}
        extrasPagasTotal={extrasPagasTotal}
        extrasACobrar={extrasACobrar}
        valorJaPago={valorJaPago}
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
