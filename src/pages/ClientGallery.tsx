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
  Download,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MasonryGrid, MasonryItem } from '@/components/MasonryGrid';
import { PhotoCard } from '@/components/PhotoCard';
import { Lightbox } from '@/components/Lightbox';
import { SelectionSummary } from '@/components/SelectionSummary';
import { SelectionConfirmation } from '@/components/SelectionConfirmation';
import { PasswordScreen } from '@/components/PasswordScreen';
import { FinalizedPreviewScreen } from '@/components/FinalizedPreviewScreen';
import { PaymentRedirect } from '@/components/PaymentRedirect';
import { PixPaymentScreen } from '@/components/PixPaymentScreen';
import { ClientGalleryHeader } from '@/components/ClientGalleryHeader';
import { DownloadModal } from '@/components/DownloadModal';
import { getPhotoUrl, getOriginalPhotoUrl } from '@/lib/photoUrl';
import { supabase } from '@/integrations/supabase/client';
import { WatermarkSettings, DiscountPackage, TitleCaseMode } from '@/types/gallery';
import { GalleryPhoto, Gallery } from '@/types/gallery';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { calcularPrecoProgressivoComCredito, RegrasCongeladas } from '@/lib/pricingUtils';
import { getFontFamilyById } from '@/components/FontSelect';
import { applyTitleCase } from '@/lib/textTransform';
import ClientDeliverGallery from '@/pages/ClientDeliverGallery';

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
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [hasAutoOpenedDownload, setHasAutoOpenedDownload] = useState(false);
  
  
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

  // Get gallery ID for queries (also check galleryResponse.galleryId for finalized galleries)
  const galleryId = supabaseGallery?.id || galleryResponse?.galleryId || (isLegacyAccess ? identifier : null);

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

  // Note: Watermark is now applied via CSS overlay in the frontend,
  // so we no longer need to fetch photographer watermark settings

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
        .order('original_filename', { ascending: true });
      
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
      includedPhotos: (isEdgeFunctionFormat ? supabaseGallery.includedPhotos : supabaseGallery.fotos_incluidas) ?? 0,
      extraPhotoPrice: (isEdgeFunctionFormat ? supabaseGallery.extraPhotoPrice : supabaseGallery.valor_foto_extra) ?? 0,
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
        sessionFont: config?.sessionFont as string | undefined,
        titleCaseMode: (config?.titleCaseMode as TitleCaseMode) || 'normal',
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

  // 4. Transform photos with direct static URLs from R2
  const photos = useMemo((): GalleryPhoto[] => {
    if (!supabasePhotos || !transformedGallery) return [];
    
    return supabasePhotos.map((photo) => {
      const photoWidth = photo.width || 800;
      const photoHeight = photo.height || 600;
      const storagePath = photo.storage_key;
      
      // Build photo paths object for URL generation
      const photoPaths = {
        storageKey: storagePath,
        thumbPath: photo.thumb_path,
        previewPath: photo.preview_path,
        width: photoWidth,
        height: photoHeight,
      };
      
      return {
        id: photo.id,
        filename: photo.original_filename || photo.filename,
        originalFilename: photo.original_filename || photo.filename,
        thumbnailUrl: getPhotoUrl(photoPaths, 'thumbnail'),
        previewUrl: getPhotoUrl(photoPaths, 'preview'),
        originalUrl: getOriginalPhotoUrl(storagePath),
        storageKey: storagePath,
        originalPath: photo.original_path || null,
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
      // 1. Atualizar estado local para feedback visual imediato
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
      
      // 2. Sincronizar cache do React Query para prevenir sobrescrita no refetch
      queryClient.setQueryData(['client-gallery-photos', galleryId], (oldData: any[] | undefined) => {
        if (!oldData) return oldData;
        return oldData.map((p) => 
          p.id === data.photo.id 
            ? { 
                ...p, 
                is_selected: data.photo.is_selected,
                is_favorite: data.photo.is_favorite ?? p.is_favorite,
                comment: data.photo.comment ?? p.comment,
              } 
            : p
        );
      });
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
      // PIX Manual - show internal payment screen
      if (data.requiresPayment && data.paymentMethod === 'pix_manual' && data.pixData) {
        setIsConfirmed(true);
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
      
      // Checkout externo (InfinitePay/MercadoPago) - redirect BEFORE confirming
      if (data.requiresPayment && data.checkoutUrl) {
        setIsConfirmed(true);
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
      
      // No payment required - go directly to confirmed
      setIsConfirmed(true);
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
  // Proteção: só sobrescreve localPhotos na primeira carga ou mudança estrutural
  useEffect(() => {
    if (photos.length > 0) {
      setLocalPhotos(prev => {
        // Primeira carga ou mudança estrutural (quantidade diferente)
        if (prev.length === 0 || prev.length !== photos.length) {
          return photos;
        }
        // Atualizar apenas campos não-editáveis (URLs, dimensions)
        // mantendo isSelected, isFavorite, comment do estado local
        return prev.map(localPhoto => {
          const serverPhoto = photos.find(p => p.id === localPhoto.id);
          return serverPhoto ? {
            ...serverPhoto,
            isSelected: localPhoto.isSelected,
            isFavorite: localPhoto.isFavorite,
            comment: localPhoto.comment,
          } : localPhoto;
        });
      });
      
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

  // Priority: theme.backgroundMode > clientMode > 'light'
  const effectiveBackgroundMode = useMemo(() => {
    return galleryResponse?.theme?.backgroundMode || galleryResponse?.clientMode || 'light';
  }, [galleryResponse?.theme?.backgroundMode, galleryResponse?.clientMode]);
  const gallery = transformedGallery;
  const isLoading = isLoadingGallery || isLoadingPhotos;

  // Auto-open download modal after confirmation (if allowDownload is enabled)
  // Only triggers on first confirmation, not on page reloads
  useEffect(() => {
    // Only auto-open if:
    // 1. Gallery is confirmed
    // 2. We're on the confirmed step (not payment or confirmation)
    // 3. Download is allowed
    // 4. There are selected photos
    // 5. We haven't already auto-opened (prevents reopen on navigation)
    const shouldAutoOpen = 
      isConfirmed && 
      currentStep === 'confirmed' && 
      gallery?.settings?.allowDownload &&
      localPhotos.some(p => p.isSelected) &&
      !hasAutoOpenedDownload &&
      !showDownloadModal;
    
    if (shouldAutoOpen) {
      // Delay to allow confirmation animation to complete
      const timer = setTimeout(() => {
        setShowDownloadModal(true);
        setHasAutoOpenedDownload(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isConfirmed, currentStep, gallery?.settings?.allowDownload, localPhotos, hasAutoOpenedDownload, showDownloadModal]);

  // Build dynamic CSS variables from custom theme - MUST be before early returns
  // Now always applies base colors based on backgroundMode, even for system theme
  const themeStyles = useMemo(() => {
    const theme = galleryResponse?.theme;
    
    // Use backgroundMode from theme, fallback to clientMode, then 'light'
    const backgroundMode = theme?.backgroundMode || galleryResponse?.clientMode || 'light';
    
    // Base colors depend on background mode (always applied, even for system theme)
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
    
    // Only add custom colors if theme has them (not system theme with null colors)
    if (theme?.primaryColor) {
      const primaryHsl = hexToHsl(theme.primaryColor);
      const accentHsl = hexToHsl(theme.accentColor);
      
      return {
        ...baseColors,
        '--primary': primaryHsl || '18 55% 55%',
        '--accent': accentHsl || '120 20% 62%',
        '--ring': primaryHsl || '18 55% 55%',
      } as React.CSSProperties;
    }
    
    return baseColors as React.CSSProperties;
  }, [galleryResponse?.theme, galleryResponse?.clientMode]);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
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
        sessionFont={getFontFamilyById(galleryResponse?.settings?.sessionFont)}
        titleCaseMode={(galleryResponse?.settings?.titleCaseMode as TitleCaseMode) || 'normal'}
        studioName={galleryResponse?.studioSettings?.studio_name}
        studioLogo={galleryResponse?.studioSettings?.studio_logo_url}
        onSubmit={handlePasswordSubmit}
        error={passwordError}
        isLoading={isCheckingPassword}
        themeStyles={themeStyles}
        backgroundMode={effectiveBackgroundMode}
      />
    );
  }

  // Deliver gallery - completely different product
  if (galleryResponse?.deliver) {
    return <ClientDeliverGallery data={galleryResponse} />;
  }

  // Finalized gallery screen - show preview of selected photos
  if (galleryResponse?.finalized) {
    return (
      <FinalizedPreviewScreen
        photos={galleryResponse.photos || []}
        galleryId={galleryId || ''}
        sessionName={galleryResponse.sessionName}
        sessionFont={getFontFamilyById(galleryResponse?.settings?.sessionFont)}
        titleCaseMode={(galleryResponse?.settings?.titleCaseMode as TitleCaseMode) || 'normal'}
        studioLogoUrl={galleryResponse.studioSettings?.studio_logo_url}
        studioName={galleryResponse.studioSettings?.studio_name}
        allowDownload={galleryResponse.allowDownload || false}
        themeStyles={themeStyles}
        backgroundMode={effectiveBackgroundMode}
      />
    );
  }

  // Error state - gallery not found
  if (galleryError || !gallery) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
              <AlertCircle className="h-10 w-10 text-destructive" />
            </div>
            
            <div>
              <h1 className="text-2xl font-bold mb-2">
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
  
  // Respect chargeType from saleSettings
  const chargeType = gallery.saleSettings?.chargeType || 'only_extras';
  const extrasNecessarias = chargeType === 'all_selected'
    ? selectedCount  // ALL selected photos are chargeable
    : Math.max(0, selectedCount - gallery.includedPhotos);  // Only extras
  
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
    
    // Respect chargeType from saleSettings (same logic as extras calculation)
    const currentChargeType = gallery.saleSettings?.chargeType || 'only_extras';
    const currentExtrasNecessarias = currentChargeType === 'all_selected'
      ? currentSelectedCount  // ALL selected photos
      : Math.max(0, currentSelectedCount - gallery.includedPhotos);  // Only extras
      
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

  // ✨ PRIMEIRA VERIFICAÇÃO: Galeria confirmada = modo read-only
  // Deve vir ANTES de showWelcome para garantir que galerias confirmadas
  // sempre mostrem apenas fotos selecionadas, independente do estado de welcome
  if (isConfirmed && currentStep !== 'confirmation' && currentStep !== 'payment') {
    const confirmedSelectedPhotos = localPhotos.filter(p => p.isSelected);
    
    return (
      <div 
        className={cn(
          "min-h-screen flex flex-col bg-background text-foreground",
          effectiveBackgroundMode === 'dark' && 'dark'
        )}
        style={themeStyles}
      >
        <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border/50">
          <div className="flex items-center justify-center px-3 py-4">
            {galleryResponse?.studioSettings?.studio_logo_url && (
              <img 
                src={galleryResponse.studioSettings.studio_logo_url} 
                alt={galleryResponse?.studioSettings?.studio_name || 'Logo'} 
                className="h-10 max-w-[180px] object-contain"
              />
            )}
          </div>
          <div className="text-center py-2 border-t border-border/30">
            <p 
              className="text-sm font-medium"
              style={{ fontFamily: getFontFamilyById(gallery.settings.sessionFont) }}
            >
              {gallery.sessionName}
            </p>
            <p className="text-xs text-muted-foreground">Seleção confirmada</p>
          </div>
        </header>
        
        <main className="flex-1 p-4 space-y-6">
          {/* Banner de sucesso */}
          <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Check className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-primary">
                Seleção Confirmada!
              </h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Você selecionou {confirmedSelectedPhotos.length} fotos. 
              Para alterações, entre em contato com o fotógrafo.
            </p>
            
            {/* Download button - only if allowDownload is enabled */}
            {gallery.settings.allowDownload && confirmedSelectedPhotos.length > 0 && (
              <Button
                onClick={() => setShowDownloadModal(true)}
                className="mt-4 gap-2"
              >
                <Download className="h-4 w-4" />
                Baixar Fotos
              </Button>
            )}
          </div>

          {/* Grid de APENAS fotos selecionadas */}
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
                      {/* Indicador de seleção */}
                      <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-md">
                        <Check className="h-4 w-4 text-primary-foreground" />
                      </div>
                      {/* Indicador de favorito */}
                      {photo.isFavorite && (
                        <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-destructive flex items-center justify-center shadow-md">
                          <svg className="h-3 w-3 text-destructive-foreground fill-current" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                          </svg>
                        </div>
                      )}
                      {/* Indicador de comentário */}
                      {photo.comment && !photo.isFavorite && (
                        <div className="absolute top-2 right-2 bg-background/90 rounded-full p-1.5 shadow-sm">
                          <svg className="h-3 w-3 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                          </svg>
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

        {/* Lightbox read-only - apenas fotos selecionadas (shows original without watermark) */}
        {lightboxIndex !== null && (
          <Lightbox
            photos={confirmedSelectedPhotos}
            currentIndex={lightboxIndex}
            allowComments={false}
            allowDownload={gallery.settings.allowDownload}
            disabled={true}
            isConfirmedMode={true}
            galleryId={gallery.id}
            onClose={() => setLightboxIndex(null)}
            onNavigate={setLightboxIndex}
            onSelect={() => {}}
          />
        )}
        
        {/* Download Modal */}
        <DownloadModal
          isOpen={showDownloadModal}
          onClose={() => setShowDownloadModal(false)}
          photos={confirmedSelectedPhotos}
          sessionName={gallery.sessionName}
          galleryId={gallery.id}
          onViewIndividual={() => {
            setShowDownloadModal(false);
            if (confirmedSelectedPhotos.length > 0) {
              setLightboxIndex(0);
            }
          }}
        />
      </div>
    );
  }

  // Tela de boas-vindas - apenas para galerias NÃO confirmadas
  if (showWelcome) {
    return (
      <div 
        className={cn(
          "min-h-screen flex flex-col bg-background text-foreground",
          effectiveBackgroundMode === 'dark' && 'dark'
        )}
        style={themeStyles}
      >
        {galleryResponse?.studioSettings?.studio_logo_url && (
          <header className="flex items-center justify-center p-4 border-b border-border/50">
            <img 
              src={galleryResponse.studioSettings.studio_logo_url} 
              alt={galleryResponse?.studioSettings?.studio_name || 'Logo'} 
              className="h-[150px] sm:h-[150px] md:h-40 lg:h-[200px] max-w-[280px] sm:max-w-[360px] md:max-w-[450px] lg:max-w-[600px] object-contain"
            />
          </header>
        )}
        
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full text-center space-y-6 animate-slide-up">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Image className="h-10 w-10 text-primary" />
            </div>
            
            <div>
              <h1 
                className="text-4xl sm:text-5xl font-normal mb-2"
                style={{ fontFamily: getFontFamilyById(gallery.settings.sessionFont) }}
              >
                {applyTitleCase(gallery.sessionName, gallery.settings.titleCaseMode || 'normal')}
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

  // Bloco 'confirmed' removido - agora verificamos isConfirmed no início do render

  return (
    <div 
      className={cn(
        "min-h-screen flex flex-col bg-background text-foreground",
        effectiveBackgroundMode === 'dark' && 'dark'
      )}
      style={themeStyles}
    >
      {/* New Header with centered logo */}
      <ClientGalleryHeader
        sessionName={gallery.sessionName}
        sessionFont={getFontFamilyById(gallery.settings.sessionFont)}
        titleCaseMode={gallery.settings.titleCaseMode || 'normal'}
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
      />

      {/* Main Content - Full width gallery */}
      <main className="flex-1 py-2 pb-20">
        <MasonryGrid>
          {localPhotos.map((photo, index) => (
            <MasonryItem key={photo.id}>
              <PhotoCard
                photo={photo}
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
