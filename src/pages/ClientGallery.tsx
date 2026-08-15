import { useState, useEffect, useMemo, useRef } from 'react';
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
import { RowMasonryGrid as MasonryGrid, RowMasonryItem as MasonryItem } from '@/components/RowMasonryGrid';
import { PhotoCard } from '@/components/PhotoCard';
import { Lightbox } from '@/components/Lightbox';
import { SelectionSummary } from '@/components/SelectionSummary';
import { SelectionConfirmation } from '@/components/SelectionConfirmation';
import { PreCheckoutContactStep } from '@/components/gallery/PreCheckoutContactStep';
import { hintsAreComplete } from '@/lib/payerHintsValidation';

import { UnifiedAccessScreen } from '@/components/UnifiedAccessScreen';
import { FinalizedPreviewScreen } from '@/components/FinalizedPreviewScreen';
import { PaymentRedirect } from '@/components/PaymentRedirect';
import { PaymentPendingScreen } from '@/components/PaymentPendingScreen';
import { PixPaymentScreen } from '@/components/PixPaymentScreen';
import { AsaasCheckout, AsaasCheckoutData } from '@/components/AsaasCheckout';
import { ClientGalleryHeader, FilterMode } from '@/components/ClientGalleryHeader';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

import { DownloadModal } from '@/components/DownloadModal';
import { ContactCollectionModal, ContactCollectionMissing } from '@/components/ContactCollectionModal';
import { getPhotoUrl, getOriginalPhotoUrl } from '@/lib/photoUrl';
import { supabase } from '@/integrations/supabase/client';
import { WatermarkSettings, DiscountPackage, TitleCaseMode } from '@/types/gallery';
import { GalleryPhoto, Gallery } from '@/types/gallery';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { calcularPrecoProgressivoComCredito, RegrasCongeladas } from '@/lib/pricingUtils';
import { getFontFamilyById } from '@/components/FontSelect';
import { applyTitleCase } from '@/lib/textTransform';
import { useImageProtection } from '@/hooks/useImageProtection';
import ClientDeliverGallery from '@/pages/ClientDeliverGallery';
import { applyTheme, DEFAULT_THEME, type ThemePresetId, type VisualThemeMode } from '@/lib/visualTheme';
import { sortPhotosByNaturalFilename } from '@/lib/photoOrdering';

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

type SelectionStep = 'gallery' | 'confirmation' | 'pre_checkout_contact' | 'payment' | 'confirmed';

const SUPABASE_URL = 'https://tlnjspsywycbudhewsfv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsbmpzcHN5d3ljYnVkaGV3c2Z2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NjU1MDEsImV4cCI6MjA3MzA0MTUwMX0.LR_nMBh8cVY1SQS1TsB7RrGQ1zmCRm_bDvyfI5Dn1QI';

// Check if the param is a UUID (legacy) or token (new)
function isUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

export default function ClientGallery() {
  const { id, token } = useParams();
  const location = useLocation();
  const queryClient = useQueryClient();
  
  // Apply image protection (blocks print, right-click, shortcuts)
  useImageProtection();
  
  // Determine if we're using token or legacy UUID
  const identifier = token || id;
  const isLegacyAccess = identifier ? isUUID(identifier) : false;
  
  const [showWelcome, setShowWelcome] = useState(() => {
    // Se retornando de pagamento, pular tela de boas-vindas
    const params = new URLSearchParams(window.location.search);
    const isPaymentReturn = params.get('payment') === 'success';
    return !isPaymentReturn;
  });
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [currentStep, setCurrentStep] = useState<SelectionStep>(() => {
    // Se o backend jÃ¡ retornou que a galeria estÃ¡ finalizada no payload inicial (ou redirecionado), iniciar em 'confirmed'
    return 'gallery';
  });

  const [localPhotos, setLocalPhotos] = useState<GalleryPhoto[]>([]);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [hasAutoOpenedDownload, setHasAutoOpenedDownload] = useState(false);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [folderViewMode, setFolderViewMode] = useState<'albums' | 'grid'>('albums');
  const [showPartialSelectionDialog, setShowPartialSelectionDialog] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [forcedMissing, setForcedMissing] = useState<Partial<ContactCollectionMissing> | null>(null);
  const [pendingConfirmPayload, setPendingConfirmPayload] = useState<null | {
    selectedCount: number; extraCount: number; valorUnitario: number; valorTotal: number;
  }>(null);
  // Erros do provedor de pagamento que devem ser mostrados no PreCheckoutContactStep
  // (ex.: Asaas rejeitou email/telefone/CPF). Reabre a etapa com foco no campo.
  const [preCheckoutExternalErrors, setPreCheckoutExternalErrors] = useState<
    Partial<Record<'nome' | 'email' | 'phone' | 'cpfCnpj', string>>
  >({});
  
  
  
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

  // Asaas transparent checkout state
  const [asaasCheckoutData, setAsaasCheckoutData] = useState<AsaasCheckoutData | null>(null);
  
  // Payment return detection state (silent â€” no blocking UI)
  const [isProcessingPaymentReturn, setIsProcessingPaymentReturn] = useState(false);
  const [isConfirmingPixPayment, setIsConfirmingPixPayment] = useState(false);
  // Controla se o cliente jÃ¡ clicou em "Ir para pagamento" e queremos mostrar
  // o checkout inline (Asaas) ou tela de PIX, em vez da PaymentPendingScreen.
  const [showInlineCheckout, setShowInlineCheckout] = useState(false);
  // Overlay imediato de "abrindo checkout" â€” reduz percepÃ§Ã£o de lentidÃ£o
  const [isRedirectingToCheckout, setIsRedirectingToCheckout] = useState(false);
  const paymentRetryRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // Password state
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [isCheckingPassword, setIsCheckingPassword] = useState(false);
  const [sessionPassword, setSessionPassword] = useState<string | null>(() => {
    return sessionStorage.getItem(`gallery_password_${identifier}`);
  });

  // Visitor state (public galleries)
  const [requiresVisitor, setRequiresVisitor] = useState(false);
  const [visitorError, setVisitorError] = useState<string | undefined>();
  const [isRegisteringVisitor, setIsRegisteringVisitor] = useState(false);
  const [visitorId, setVisitorId] = useState<string | null>(() => {
    return localStorage.getItem(`gallery_visitor_${identifier}`);
  });
  const [visitorName, setVisitorName] = useState<string | null>(() => {
    return localStorage.getItem(`gallery_visitor_name_${identifier}`);
  });

  // R2 Worker is used for image URLs (no async config needed)

  // 1. Fetch gallery via Edge Function (handles token + password validation)
  const { data: galleryResponse, isLoading: isLoadingGallery, error: galleryError, refetch: refetchGallery } = useQuery({
    queryKey: ['client-gallery', identifier, sessionPassword, visitorId],
    queryFn: async () => {
      if (!identifier) return null;
      
      // For legacy UUID access, use direct Supabase query
      if (isLegacyAccess) {
        const { data, error } = await supabase
          .from('galerias')
          .select('*')
          .eq('id', identifier)
          .single();
        
        if (error) throw new Error('Galeria nÃ£o encontrada');
        return { success: true, gallery: data, photos: null, isLegacy: true };
      }
      
      // For token access, use Edge Function with pagination
      const fetchPage = async (page: number) => {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/gallery-access`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'apikey': SUPABASE_ANON_KEY 
          },
          body: JSON.stringify({ 
            token: identifier, 
            password: sessionPassword,
            page,
            limit: 200,
            visitorId: visitorId || undefined,
          }),
        });
        
        const result = await response.json();
        
        if (!response.ok) {
          if (result.code === 'NOT_FOUND') throw new Error('Galeria nÃ£o encontrada');
          if (result.code === 'WRONG_PASSWORD') throw new Error('Senha incorreta');
          if (result.code === 'NOT_AVAILABLE' && result.retryable) {
            throw new Error('GALLERY_PUBLISHING');
          }
          if (result.code === 'NOT_AVAILABLE') throw new Error('Galeria nÃ£o disponÃ­vel');
          if (result.code === 'INTERNAL_ERROR' || response.status >= 500) {
            throw new Error('GALLERY_SERVER_ERROR');
          }
          throw new Error(result.error || 'Erro ao acessar galeria');
        }
        
        return result;
      };

      // Fetch first page
      const firstPage = await fetchPage(1);
      
      // If there are more photos, fetch remaining pages in parallel
      if (firstPage.pagination?.hasMore) {
        const totalPages = Math.ceil(firstPage.pagination.total / firstPage.pagination.limit);
        const remainingPages = await Promise.all(
          Array.from({ length: totalPages - 1 }, (_, i) => fetchPage(i + 2))
        );
        // Merge all photos into first page result
        for (const page of remainingPages) {
          if (page.photos) {
            firstPage.photos.push(...page.photos);
          }
        }
      }
      
      return firstPage;
    },
    enabled: !!identifier,
    retry: (failureCount, error) => {
      // Retry up to 3 times for galleries that are being published (transitional state)
      if (error?.message === 'GALLERY_PUBLISHING' && failureCount < 3) return true;
      // Retry server errors up to 2 times
      if (error?.message === 'GALLERY_SERVER_ERROR' && failureCount < 2) return true;
      return false;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
    staleTime: 0, // Set to 0 to ensure fresh check on return from payment
    refetchOnWindowFocus: true,
  });

  // Handle password requirement
  useEffect(() => {
    if (galleryResponse?.requiresPassword) {
      setRequiresPassword(true);
    }
    if (galleryResponse?.requiresVisitor) {
      setRequiresVisitor(true);
    }
    // Recover visitor info from response
    if (galleryResponse?.visitorId && !visitorId) {
      setVisitorId(galleryResponse.visitorId);
      setVisitorName(galleryResponse.visitorName || null);
      localStorage.setItem(`gallery_visitor_${identifier}`, galleryResponse.visitorId);
      if (galleryResponse.visitorName) {
        localStorage.setItem(`gallery_visitor_name_${identifier}`, galleryResponse.visitorName);
      }
    }
    // Also check gallery.visitorId (nested in gallery object)
    if (galleryResponse?.gallery?.visitorId && !visitorId) {
      setVisitorId(galleryResponse.gallery.visitorId);
      setVisitorName(galleryResponse.gallery.visitorName || null);
      localStorage.setItem(`gallery_visitor_${identifier}`, galleryResponse.gallery.visitorId);
      if (galleryResponse.gallery.visitorName) {
        localStorage.setItem(`gallery_visitor_name_${identifier}`, galleryResponse.gallery.visitorName);
      }
    }
  }, [galleryResponse]);

  // Aplica tema do Studio do fotógrafo (preset + mode) na galeria pÃºblica.
  // NÃ£o persiste no localStorage â€” apenas overlay temporÃ¡rio enquanto o visitante
  // estÃ¡ na rota pÃºblica.
  useEffect(() => {
    if (galleryResponse) {
      const customHex = galleryResponse.theme?.primaryColor || undefined;
      const mode = galleryResponse.clientMode || galleryResponse.studioSettings?.clientTheme || 'system';
      
      applyTheme({
        presetId: 'lunari',
        mode: mode as VisualThemeMode,
        customHex: customHex,
      });
    }
  }, [galleryResponse]);

  // Restaurar default ao sair da rota pÃºblica
  useEffect(() => {
    return () => {
      applyTheme(DEFAULT_THEME);
    };
  }, []);


  // Fase 5 â€” Preconnect para o host do provedor de pagamento assim que sabemos
  // qual Ã©. Reduz DNS + TLS na hora do redirect (~200-500ms perceptivos).
  // SÃ³ dispara quando saleMode === 'sale_with_payment' para nÃ£o abrir socket
  // desnecessÃ¡rio em galerias no_sale.
  useEffect(() => {
    if (!galleryResponse) return;
    const g: any = (galleryResponse as any).gallery || galleryResponse;
    const settings: any =
      (galleryResponse as any).saleSettings ||
      g?.saleSettings ||
      g?.configuracoes?.saleSettings ||
      null;
    if (!settings || settings.mode !== 'sale_with_payment') return;
    const method: string | undefined = settings.paymentMethod || g?.venda_pagamento_provedor;
    const HOSTS: Record<string, string> = {
      infinitepay: 'https://checkout.infinitepay.io',
      mercadopago: 'https://www.mercadopago.com.br',
    };
    const host = method ? HOSTS[method] : undefined;
    if (!host) return;

    const links: HTMLLinkElement[] = [];
    const mk = (rel: string) => {
      const l = document.createElement('link');
      l.rel = rel;
      l.href = host;
      if (rel === 'preconnect') l.crossOrigin = 'anonymous';
      document.head.appendChild(l);
      links.push(l);
    };
    mk('preconnect');
    mk('dns-prefetch');
    return () => {
      links.forEach((l) => l.parentNode?.removeChild(l));
    };
  }, [galleryResponse]);


  // Extract gallery data from response (handle both legacy and new format)
  const supabaseGallery = useMemo(() => {
    if (!galleryResponse) return null;
    if (galleryResponse.isLegacy) return galleryResponse.gallery;
    // Enhanced detection: if it looks like a gallery response, treat it as success
    if (galleryResponse.success || galleryResponse.gallery || galleryResponse.sessionName) return galleryResponse.gallery;
    return null;
  }, [galleryResponse]);

  // Get gallery ID for queries (also check galleryResponse.galleryId for finalized galleries)
  const galleryId = supabaseGallery?.id || galleryResponse?.galleryId || (isLegacyAccess ? identifier : null);

  // Get session_id from gallery (for fetching frozen rules from GestÃ£o session)
  // Support both camelCase (from Edge Function) and snake_case (from legacy)
  const sessionId = supabaseGallery?.sessionId || supabaseGallery?.session_id;

  // 2. Fetch frozen pricing rules from GestÃ£o session (as fallback if Edge Function didn't load them)
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
      
      console.log('ðŸ“Š Session rules loaded for pricing:', data?.regras_congeladas ? 'yes' : 'no');
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
        .order('original_filename', { ascending: true })
        .order('id', { ascending: true });
      
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
      sessionName: (isEdgeFunctionFormat ? supabaseGallery.sessionName : supabaseGallery.nome_sessao) || 'SessÃ£o de Fotos',
      packageName: (isEdgeFunctionFormat ? supabaseGallery.packageName : supabaseGallery.nome_pacote) || 'Pacote',
      includedPhotos: (isEdgeFunctionFormat ? supabaseGallery.includedPhotos : supabaseGallery.fotos_incluidas) ?? 0,
      extraPhotoPrice: (() => {
        // Prioridade 1: Valor explÃ­cito definido na galeria (manual override)
        const fromGallery = Number(isEdgeFunctionFormat ? supabaseGallery.extraPhotoPrice : supabaseGallery.valor_foto_extra);
        if (fromGallery > 0) return fromGallery;

        // Prioridade 2: Valor congelado da sessÃ£o de GestÃ£o
        const regras: any = isEdgeFunctionFormat
          ? (supabaseGallery as any).regrasCongeladas
          : (supabaseGallery as any).regras_congeladas;
        const fromRegras = Number(regras?.pacote?.valorFotoExtra ?? 0);
        if (fromRegras > 0) return fromRegras;

        return 0;
      })(),

      status: 'sent' as Gallery['status'],
      selectionStatus: (isEdgeFunctionFormat ? supabaseGallery.selectionStatus : supabaseGallery.status_selecao) === 'selecao_completa' ? 'confirmed' : 'in_progress',
      createdAt: new Date(),
      updatedAt: new Date(),
      saleSettings: (() => {
        // Prioritize explicit saleSettings from Edge Function response
        if ((supabaseGallery as any).saleSettings) {
          return (supabaseGallery as any).saleSettings;
        }
        
        const settings = config?.saleSettings as Record<string, unknown> | undefined;

        const explicitSettings = isEdgeFunctionFormat 
          ? (supabaseGallery.saleSettings as Record<string, unknown> | null)
          : null;
        const configSettings = config?.saleSettings as Record<string, unknown> | null;
        const rawSettings = explicitSettings || configSettings;

        const regras: any = isEdgeFunctionFormat
          ? (supabaseGallery as any).regrasCongeladas
          : (supabaseGallery as any).regras_congeladas;
        const precoExtraFromRegras = Number(regras?.pacote?.valorFotoExtra ?? 0);

        return {
          // Fonte de verdade: gallery-access jÃ¡ projeta colunas > JSON > default.
          // Se ainda cair no fallback aqui, Ã© apenas para o formato legado (UUID/direct).
          mode: (rawSettings?.mode as 'no_sale' | 'sale_with_payment' | 'sale_without_payment') || 'no_sale',
          pricingModel: (rawSettings?.pricingModel as 'fixed' | 'packages') || 'fixed',
          chargeType: (rawSettings?.chargeType as 'all_selected' | 'only_extras') || 'only_extras',
          fixedPrice: (rawSettings?.fixedPrice as number)
            || (precoExtraFromRegras > 0 ? precoExtraFromRegras : undefined)
            || (isEdgeFunctionFormat ? supabaseGallery.extraPhotoPrice : supabaseGallery.valor_foto_extra)
            || 25,
          discountPackages: (rawSettings?.discountPackages as DiscountPackage[]) || [],
          paymentMethod: (rawSettings?.paymentMethod as 'pix_manual' | 'infinitepay' | 'mercadopago' | 'asaas' | undefined),
        };

      })(),
      settings: {
        welcomeMessage: (isEdgeFunctionFormat ? supabaseGallery.welcomeMessage : supabaseGallery.mensagem_boas_vindas) || '',
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
        photoSpacing: (isEdgeFunctionFormat ? supabaseGallery.settings?.photoSpacing : supabaseGallery.configuracoes?.photoSpacing) ?? (galleryResponse?.settings?.photoSpacing ?? 6),
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
    
    const mapped = supabasePhotos.map((photo) => {
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
        folderId: photo.pasta_id || null,
        coverUrl: photo.cover_path ? getPhotoUrl({ storageKey: photo.cover_path }, 'thumbnail') : null,
      };
    });

    // Ordem canÃ´nica Ãºnica para qualquer galeria: alfabÃ©tica natural pelo
    // nome original do arquivo. Garante leitura linha-a-linha 1 -> 2 -> 3.
    return sortPhotosByNaturalFilename(mapped);
  }, [supabasePhotos, transformedGallery]);

  // 5. Mutation for toggling selection via Edge Function
  const selectionMutation = useMutation({
    mutationFn: async ({ photoId, action, comment, previousState }: { 
      photoId: string; 
      action: 'toggle' | 'select' | 'deselect' | 'comment' | 'favorite'; 
      comment?: string;
      previousState?: { isSelected: boolean; isFavorite: boolean; comment: string | null };
    }) => {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/client-selection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ galleryToken: identifier, photoId, action, comment, visitorId: visitorId || undefined }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao atualizar seleÃ§Ã£o');
      }
      
      return response.json();
    },
    retry: 2,
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
    onError: (error: Error, variables) => {
      toast.error(error.message);
      // Rollback optimistic state to previous value
      if (variables.previousState) {
        setLocalPhotos(prev => prev.map(p =>
          p.id === variables.photoId
            ? { ...p, isSelected: variables.previousState!.isSelected, isFavorite: variables.previousState!.isFavorite, comment: variables.previousState!.comment }
            : p
        ));
      } else {
        queryClient.invalidateQueries({ queryKey: ['client-gallery-photos', galleryId] });
      }
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
        headers: { 
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
         body: JSON.stringify({ 
          galleryToken: identifier,
          selectedCount: pricingData.selectedCount,
          extraCount: pricingData.extraCount,
          valorUnitario: pricingData.valorUnitario,
          valorTotal: pricingData.valorTotal,
          requestPayment: shouldRequestPayment,
          visitorId: visitorId || undefined,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        // R1 (gallery-rules): galeria jÃ¡ finalizada => forÃ§a refetch e mostra
        // tela de pagamento pendente. Nunca mostra toast de erro genÃ©rico.
        if (response.status === 409 || error?.code === 'ALREADY_PROCESSING' || error?.code === 'ALREADY_FINALIZED') {
          await refetchGallery();
          const err = new Error('ALREADY_FINALIZED') as Error & { silent?: boolean };
          err.silent = true;
          throw err;
        }
        throw new Error(error.error || 'Erro ao confirmar seleÃ§Ã£o');
      }

      return response.json();
    },
    onSuccess: async (data) => {

      // PIX Manual - show internal payment screen
      if (data.requiresPayment && data.paymentMethod === 'pix_manual' && data.pixData) {
        // Don't set isConfirmed - gallery is aguardando_pagamento, not confirmed
        setPixPaymentData({
          chavePix: data.pixData.chavePix || '',
          nomeTitular: data.pixData.nomeTitular || '',
          tipoChave: data.pixData.tipoChave,
          valorTotal: data.valorTotal || 0,
        });
        setCurrentStep('payment');
        return;
      }
      
      // Asaas transparent checkout - show inline payment form
      if (data.requiresPayment && data.transparentCheckout && data.asaasCheckoutData) {
        setAsaasCheckoutData(data.asaasCheckoutData as AsaasCheckoutData);
        setCurrentStep('payment');
        return;
      }

      // Checkout externo (InfinitePay/MercadoPago) - redirect immediately
      if (data.requiresPayment && data.checkoutUrl) {
        console.log('ðŸ’³ Redirecionando para checkout externo:', data.checkoutUrl);
        // Fase 6: overlay imediato + breadcrumb + replace (tira galeria do histÃ³rico).
        // O overlay mostra transiÃ§Ã£o visual enquanto o browser resolve DNS/TLS.
        try {
          sessionStorage.setItem(`gallery_checkout_pending_${identifier}`, JSON.stringify({
            cobrancaId: data.cobrancaId ?? null,
            provedor: data.provedor ?? 'externo',
            valorTotal: data.valorTotal ?? 0,
            timestamp: Date.now(),
          }));
        } catch { /* ignore quota */ }
        setIsRedirectingToCheckout(true);
        // rAF garante que o overlay pintou antes do navigate
        requestAnimationFrame(() => {
          window.location.replace(data.checkoutUrl);
        });
        return;
      }
      

      
      // GUARD: If backend says payment is required but no checkout data arrived,
      // do NOT confirm â€” this is likely a config/payload issue
      if (data.requiresPayment) {
        console.error('âš ï¸ Backend indicated requiresPayment=true but no valid checkout data arrived. Payload:', JSON.stringify(data));
        toast.error('Pagamento pendente', {
          description: 'NÃ£o foi possÃ­vel carregar o checkout. Recarregue a pÃ¡gina e tente novamente.',
          duration: 8000,
        });
        // Refetch gallery to let gallery-access handle the pending payment state
        refetchGallery();
        return;
      }
      
      // ðŸ›¡ï¸ CONTRACT GUARD: se a galeria exige pagamento (sale_with_payment + extras > 0)
      // e o backend voltou requiresPayment=false, NUNCA finalize localmente.
      // Isso impede a tela "SeleÃ§Ã£o Confirmada" de aparecer indevidamente e forÃ§a
      // refetch para cair na PaymentPendingScreen â€” nunca perder rastreamento de pagamento.
      const expectsPayment = transformedGallery?.saleSettings?.mode === 'sale_with_payment' && (extrasACobrar ?? 0) > 0;
      if (expectsPayment && !data.requiresPayment) {
        console.error('[CONTRACT VIOLATION] Gallery requires payment but backend returned requiresPayment=false', {
          galleryId, mode: transformedGallery?.saleSettings?.mode, extrasACobrar, response: data,
        });
        toast.error('Falha na criaÃ§Ã£o do pagamento', {
          description: 'Reabrindo a galeria para retomar a cobranÃ§a. Se persistir, contate o fotógrafo.',
          duration: 8000,
        });
        await refetchGallery();
        return;
      }

      // No payment required - go directly to confirmed
      setIsConfirmed(true);
      setCurrentStep('confirmed');

    },
    onError: (error: Error & { silent?: boolean }) => {
      // Silent errors (ex.: ALREADY_FINALIZED) jÃ¡ dispararam refetch â€” nada de toast.
      if (error?.silent || error?.message === 'ALREADY_FINALIZED') return;
      const msg = error.message || 'Erro ao confirmar seleÃ§Ã£o';

      // Erros de validaÃ§Ã£o do provedor devolvem o cliente Ã  etapa de coleta
      // com a mensagem grudada no campo certo â€” em vez do toast genÃ©rico.
      const upper = msg.toUpperCase();
      const providerFieldErrors: Partial<Record<'nome' | 'email' | 'phone' | 'cpfCnpj', string>> = {};
      if (upper.includes('INVALID_EMAIL') || /e-?mail\s*inv[aÃ¡]lid/i.test(msg) || /invalid.*email/i.test(msg)) {
        providerFieldErrors.email = 'O e-mail foi rejeitado pelo processador de pagamento. Confira e digite novamente.';
      }
      if (upper.includes('INVALID_PHONE') || /telefone\s*inv[aÃ¡]lid|invalid.*phone|invalid.*mobilephone/i.test(msg)) {
        providerFieldErrors.phone = 'O WhatsApp foi rejeitado pelo processador. Confira DDD e nÃºmero.';
      }
      if (upper.includes('INVALID_CPF') || upper.includes('INVALID_CNPJ') || /cpf.*inv[aÃ¡]lid|cnpj.*inv[aÃ¡]lid/i.test(msg)) {
        providerFieldErrors.cpfCnpj = 'CPF/CNPJ invÃ¡lido para o processador. Confira os nÃºmeros digitados.';
      }
      if (Object.keys(providerFieldErrors).length > 0) {
        setPreCheckoutExternalErrors(providerFieldErrors);
        setCurrentStep('pre_checkout_contact');
        return;
      }

      // Fallback: Asaas exigiu CPF que o cache do gallery-access ainda nÃ£o sabia
      // que estava faltando. Reabrir a etapa de coleta com o campo marcado.
      if (msg.includes('MISSING_CPF_CNPJ')) {
        setPreCheckoutExternalErrors({ cpfCnpj: 'CPF/CNPJ Ã© obrigatÃ³rio para gerar a cobranÃ§a.' });
        refetchGallery().finally(() => setCurrentStep('pre_checkout_contact'));
        return;
      }

      if (msg.includes('Nenhum mÃ©todo de pagamento configurado') || msg.includes('NO_PAYMENT_PROVIDER')) {
        toast.error('Pagamento nÃ£o disponÃ­vel', {
          description: 'O fotógrafo ainda nÃ£o configurou o mÃ©todo de pagamento. Entre em contato com ele.',
          duration: 8000,
        });
      } else if (msg.includes('InfinitePay indisponÃ­vel') || msg.includes('INFINITEPAY_UNAVAILABLE')) {
        toast.error('ServiÃ§o de pagamento indisponÃ­vel', {
          description: 'Tente novamente em alguns minutos.',
          duration: 6000,
        });
      } else if (msg.includes('PAYMENT_CALC_MISMATCH') || msg.includes('SELECTION_SYNC_ERROR') || msg.includes('NÃ£o foi possÃ­vel calcular o valor')) {
        toast.error('NÃ£o foi possÃ­vel gerar sua cobranÃ§a', {
          description: 'Recarregue a pÃ¡gina e tente novamente. Se persistir, contate o fotógrafo.',
          duration: 8000,
        });
        refetchGallery();
      } else {
        toast.error('Erro ao processar pagamento', {
          description: msg,
          duration: 6000,
        });
      }


    },
  });

  // Sync photos state when data loads and detect if already confirmed
  // ProteÃ§Ã£o: sÃ³ sobrescreve localPhotos na primeira carga ou mudanÃ§a estrutural
  useEffect(() => {
    if (photos.length > 0) {
      setLocalPhotos(prev => {
        // Primeira carga ou mudanÃ§a estrutural (quantidade diferente)
        if (prev.length === 0 || prev.length !== photos.length) {
          return photos;
        }
        // Segue SEMPRE a ordem canÃ´nica do servidor (alfabÃ©tica natural),
        // mas preserva o estado local de seleÃ§Ã£o/favorito/comentÃ¡rio.
        const localById = new Map(prev.map(p => [p.id, p]));
        return photos.map(serverPhoto => {
          const localPhoto = localById.get(serverPhoto.id);
          return localPhoto ? {
            ...serverPhoto,
            isSelected: localPhoto.isSelected,
            isFavorite: localPhoto.isFavorite,
            comment: localPhoto.comment,
          } : serverPhoto;
        });
      });
      
      const isAlreadyConfirmed = supabaseGallery?.status_selecao === 'selecao_completa' || 
                                 supabaseGallery?.finalized_at ||
                                 galleryResponse?.finalized; // Check edge function explicit field
                                 
      // Don't treat aguardando_pagamento as confirmed
      const isAwaitingPayment = supabaseGallery?.status_selecao === 'aguardando_pagamento' ||
                                galleryResponse?.pendingPayment;
      
      const shouldBeConfirmed = !!isAlreadyConfirmed && !isAwaitingPayment;
      
      if (shouldBeConfirmed && !isConfirmed) {
        setIsConfirmed(true);
        setCurrentStep('confirmed');
        setShowWelcome(false);
      } else if (isAwaitingPayment && currentStep !== 'payment') {
        // If we found a pending payment in the initial load/refetch
        setCurrentStep('payment');
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
      setShowWelcome(false);
      
      // Clean URL params immediately (no blocking UI)
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
      
      const confirmPaymentReturn = async () => {
        try {
          console.log('ðŸ”„ VerificaÃ§Ã£o silenciosa de pagamento em background:', {
            orderNsu, transactionNsu, slug, captureMethod,
          });
          
          const response = await fetch(`${SUPABASE_URL}/functions/v1/check-payment-status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              sessionId: sessionId,
              visitorId: visitorId || undefined,
              orderNsu, transactionNsu, slug, receiptUrl,
              forceUpdate: true,
            }),
          });
          
          const result = await response.json();
          console.log('âœ… Resultado verificaÃ§Ã£o silenciosa:', result);
          
          if (result.status === 'pago' || result.updated) {
            setCurrentStep('confirmed');
            setIsConfirmed(true);
            refetchGallery();
          } else {
            // Not yet confirmed â€” start Realtime subscription + fallback polling
            const channel = supabase
              .channel(`payment-return-${sessionId || galleryId}`)
              .on(
                'postgres_changes',
                {
                  event: 'UPDATE',
                  schema: 'public',
                  table: 'cobrancas',
                  ...(sessionId ? { filter: `session_id=eq.${sessionId}` } : {}),
                },
                (payload) => {
                  if ((payload.new as any).status === 'pago') {
                    console.log('âœ… Realtime: pagamento confirmado');
                    if (paymentRetryRef.current) clearTimeout(paymentRetryRef.current as unknown as number);
                    supabase.removeChannel(channel);
                    setCurrentStep('confirmed');
                    setIsConfirmed(true);
                    refetchGallery();
                  }
                }
              )
              .subscribe();

            // Polling adaptativo: 3s nos primeiros 30s, depois 60s (safety net)
            const startTime = Date.now();
            const tick = async () => {
              if (Date.now() - startTime > 10 * 60 * 1000) {
                if (paymentRetryRef.current) clearTimeout(paymentRetryRef.current as unknown as number);
                supabase.removeChannel(channel);
                return;
              }
              try {
                const retryResponse = await fetch(`${SUPABASE_URL}/functions/v1/check-payment-status`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ sessionId, visitorId: visitorId || undefined, orderNsu, forceUpdate: false }),
                });
                const retryResult = await retryResponse.json();
                if (retryResult.status === 'pago' || retryResult.updated) {
                  if (paymentRetryRef.current) clearTimeout(paymentRetryRef.current as unknown as number);
                  supabase.removeChannel(channel);
                  setCurrentStep('confirmed');
                  setIsConfirmed(true);
                  refetchGallery();
                  return;
                }
              } catch (e) {
                console.error('[Auto-retry] Error:', e);
              }
              const elapsed = Date.now() - startTime;
              const nextDelay = elapsed < 30_000 ? 3_000 : 60_000;
              paymentRetryRef.current = setTimeout(tick, nextDelay) as unknown as ReturnType<typeof setInterval>;
            };
            paymentRetryRef.current = setTimeout(tick, 3_000) as unknown as ReturnType<typeof setInterval>;
          }
        } catch (error) {
          console.error('âŒ Erro ao verificar pagamento:', error);
          // Silently fail â€” gallery will show natural state
          refetchGallery();
        }
      };
      
      confirmPaymentReturn();
    }
    
    return () => {
      if (paymentRetryRef.current) {
        clearTimeout(paymentRetryRef.current as unknown as number);
        paymentRetryRef.current = null;
      }
    };
  }, [galleryId, sessionId, isProcessingPaymentReturn]);

  // Priority: clientMode (gallery decision) > theme.backgroundMode > 'light'
  const effectiveBackgroundMode = useMemo(() => {
    return galleryResponse?.clientMode || galleryResponse?.theme?.backgroundMode || 'light';
  }, [galleryResponse?.clientMode, galleryResponse?.theme?.backgroundMode]);
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
    
    // Gallery's clientMode wins over theme's backgroundMode
    const backgroundMode = galleryResponse?.clientMode || theme?.backgroundMode || 'light';
    
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

  // Extract folders from gallery response
  const galleryFolders = galleryResponse?.folders || [];
  const hasFolders = galleryFolders.length > 0;

  // Fase 6 â€” Overlay imediato de redirect para checkout externo.
  // Renderizado com PRIORIDADE mÃ¡xima: mantÃ©m a tela travada e clara
  // enquanto o browser resolve DNS/TLS e o checkout carrega.
  if (isRedirectingToCheckout) {
    return (
      <div
        className={cn(
          'min-h-screen flex flex-col items-center justify-center bg-background text-foreground',
          effectiveBackgroundMode === 'dark' && 'dark'
        )}
        style={themeStyles}
        aria-live="polite"
      >
        {galleryResponse?.studioSettings?.studio_logo_url && (
          <img
            src={galleryResponse.studioSettings.studio_logo_url}
            alt=""
            className="h-16 max-w-[200px] object-contain mb-8 opacity-80"
          />
        )}
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-muted border-t-primary" />
        <p className="mt-6 text-base font-medium">Abrindo checkoutâ€¦</p>
        <p className="mt-1 text-sm text-muted-foreground">Você serÃ¡ redirecionado em instantes.</p>
      </div>
    );
  }

  // Loading state with branded skeleton
  if (isLoading) {

    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background" style={themeStyles}>
        {galleryResponse?.studioSettings?.studio_logo_url && (
          <img 
            src={galleryResponse.studioSettings.studio_logo_url} 
            alt="" 
            className="h-16 max-w-[200px] object-contain mb-6 opacity-60"
          />
        )}
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
        <p className="mt-4 text-sm text-muted-foreground">Carregando galeria...</p>
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

  // Unified Access Screen (Password and/or Visitor)
  if ((requiresPassword && !sessionPassword) || (requiresVisitor && !visitorId)) {
    return (
      <UnifiedAccessScreen
        sessionName={galleryResponse?.sessionName}
        sessionFont={getFontFamilyById(supabaseGallery?.configuracoes?.sessionFont || galleryResponse?.settings?.sessionFont)}
        titleCaseMode={(supabaseGallery?.configuracoes?.titleCaseMode || galleryResponse?.settings?.titleCaseMode) as TitleCaseMode || 'normal'}
        studioName={galleryResponse?.studioSettings?.studio_name}
        studioLogo={galleryResponse?.studioSettings?.studio_logo_url}
        requiresPassword={requiresPassword && !sessionPassword}
        requiresVisitor={requiresVisitor && !visitorId}
        totalPhotos={galleryResponse?.pagination?.total || localPhotos.length}
        includedPhotos={transformedGallery?.includedPhotos}
        deadline={transformedGallery?.settings?.deadline}
        welcomeMessage={supabaseGallery?.configuracoes?.welcomeMessage || galleryResponse?.settings?.welcomeMessage}
        onSubmit={async (data) => {
          if (data.password) {
            await handlePasswordSubmit(data.password);
          }
          if (data.visitor) {
            await handleVisitorSubmit(data.visitor);
          }
        }}
        error={passwordError || visitorError}
        isLoading={isCheckingPassword || isRegisteringVisitor}
        themeStyles={themeStyles}
        backgroundMode={effectiveBackgroundMode}
      />
    );
  }

  // Handle visitor identification for public galleries
  const handleVisitorSubmit = async (data: { nome: string; contato: string; contatoTipo: 'email' | 'whatsapp' }) => {
    setIsRegisteringVisitor(true);
    setVisitorError(undefined);
    
    try {
      // Generate simple device hash
      const deviceHash = btoa(`${data.contato}:${navigator.userAgent}`).slice(0, 64);
      
      const response = await fetch(`${SUPABASE_URL}/functions/v1/gallery-access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          token: identifier, 
          password: sessionPassword,
          visitorData: {
            nome: data.nome,
            contato: data.contato,
            contatoTipo: data.contatoTipo,
            deviceHash,
          },
        }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        setVisitorError(result.error || 'Erro ao registrar');
        return;
      }
      
      // Extract visitor info
      const newVisitorId = result.visitorId || result.gallery?.visitorId;
      const newVisitorName = result.visitorName || result.gallery?.visitorName;
      
      if (newVisitorId) {
        setVisitorId(newVisitorId);
        setVisitorName(newVisitorName || data.nome);
        localStorage.setItem(`gallery_visitor_${identifier}`, newVisitorId);
        localStorage.setItem(`gallery_visitor_name_${identifier}`, newVisitorName || data.nome);
        setRequiresVisitor(false);
        await refetchGallery();
      } else {
        setVisitorError('Erro ao criar sessÃ£o do visitante');
      }
    } catch (error) {
      setVisitorError('Erro ao conectar');
    } finally {
      setIsRegisteringVisitor(false);
    }
  };

  if (galleryResponse?.deliver) {
    return <ClientDeliverGallery data={galleryResponse} />;
  }

  // ðŸ”’ R2 (gallery-rules): selectionLocked decidido no SERVIDOR.
  // Uma vez travada a seleÃ§Ã£o, o cliente NUNCA renderiza grid â€” sÃ³
  // pagamento pendente ou preview finalizado. Os OR abaixo sÃ£o apenas
  // salvaguarda contra payload legado; a fonte real Ã© galleryResponse.
  const selectionLocked = Boolean(
    galleryResponse?.selectionLocked
    || galleryResponse?.finalized
    || (galleryResponse as any)?.finalizedAt
    || supabaseGallery?.finalized_at
    || supabaseGallery?.status_selecao === 'aguardando_pagamento'
    || supabaseGallery?.status_selecao === 'selecao_completa'
    || supabaseGallery?.status_selecao === 'processando_selecao'
  );
  const hasPaid = Boolean(galleryResponse?.hasPaid);
  const blockedReason = (galleryResponse as any)?.blockedReason as
    | 'awaiting_payment' | 'awaiting_charge_regeneration' | 'finalized_paid' | null | undefined;
  if (selectionLocked && !hasPaid) {
    // Log defensivo: se algum fluxo posterior tentar renderizar grid, saberemos.
    console.debug('[ClientGallery] selectionLocked=true, blockedReason=', blockedReason);
  }

  // Preview finalizada sÃ³ se pago
  if (selectionLocked && hasPaid && galleryResponse?.finalized) {
    return (
      <FinalizedPreviewScreen
        photos={galleryResponse.photos || []}
        galleryId={galleryId || ''}
        sessionName={galleryResponse.sessionName}
        sessionFont={getFontFamilyById(supabaseGallery?.configuracoes?.sessionFont || galleryResponse?.settings?.sessionFont)}
        titleCaseMode={(supabaseGallery?.configuracoes?.titleCaseMode || galleryResponse?.settings?.titleCaseMode) as TitleCaseMode || 'normal'}
        studioLogoUrl={galleryResponse.studioSettings?.studio_logo_url}
        studioName={galleryResponse.studioSettings?.studio_name}
        allowDownload={galleryResponse.allowDownload || false}
        themeStyles={themeStyles}
        backgroundMode={effectiveBackgroundMode}
      />
    );
  }



  // Expired gallery screen - always light background
  if (galleryResponse?.expired) {
    const expiredFont = getFontFamilyById(supabaseGallery?.configuracoes?.sessionFont || galleryResponse?.settings?.sessionFont);
    const expiredTitleCase = (supabaseGallery?.configuracoes?.titleCaseMode || galleryResponse?.settings?.titleCaseMode) as TitleCaseMode || 'normal';
    const expiredSessionName = galleryResponse?.sessionName || '';
    const expiredStudioLogo = galleryResponse?.studioSettings?.studio_logo_url;
    const expiredStudioName = galleryResponse?.studioSettings?.studio_name;

    // Always use light background for expired screen
    const expiredBgStyle: React.CSSProperties = {
      backgroundColor: '#FAF9F7',
      color: '#2D2A26',
      fontFamily: expiredFont || 'Inter, system-ui, sans-serif',
    };

    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center p-6"
        style={expiredBgStyle}
      >
        {/* Studio logo - larger */}
        {expiredStudioLogo && (
          <div className="mb-10">
            <img
              src={expiredStudioLogo}
              alt={expiredStudioName || 'Studio'}
              style={{ height: '80px', maxWidth: '240px', objectFit: 'contain', margin: '0 auto', display: 'block' }}
            />
          </div>
        )}

        <div className="max-w-sm w-full text-center space-y-6">
          {/* Icon */}
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center mx-auto"
            style={{ backgroundColor: '#EDE9E4' }}
          >
            <Clock className="h-9 w-9" style={{ color: '#8A8078' }} />
          </div>

          {/* Session name */}
          {expiredSessionName && (
            <p
              className="text-sm tracking-widest uppercase"
              style={{ color: '#8A8078', fontWeight: 400 }}
            >
              {applyTitleCase(expiredSessionName, expiredTitleCase)}
            </p>
          )}

          {/* Main message */}
          <div className="space-y-4">
            <h1
              className="text-2xl"
              style={{ color: '#2D2A26', fontWeight: 600 }}
            >
              Galeria expirada
            </h1>
            <p
              className="text-base leading-relaxed"
              style={{ color: '#5A534A', fontWeight: 400 }}
            >
              O prazo de acesso Ã  galeria expirou.
            </p>
            <p
              className="text-sm leading-relaxed"
              style={{ color: '#8A8078', fontWeight: 400 }}
            >
              Para visualizar novamente, entre em contato com o fotógrafo e solicite a liberaÃ§Ã£o.
            </p>
          </div>

          {/* Studio name fallback */}
          {!expiredStudioLogo && expiredStudioName && (
            <p
              className="text-xs pt-4"
              style={{ color: '#8A8078', borderTop: '1px solid #E5E0D9', fontWeight: 400 }}
            >
              {expiredStudioName}
            </p>
          )}
        </div>
      </div>
    );
  }

  // Payment verification now runs silently â€” no blocking screen

  // â”€â”€ Contact-collection helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Declarados aqui (antes dos early returns de pagamento) porque
  // sÃ£o reutilizados dentro dos ramos que renderizam AsaasCheckout,
  // PixPaymentScreen e no return final.
  const handleContactCollected = async (data: { email?: string; phone?: string; nome?: string; cpfCnpj?: string }) => {
    try {
      const { error } = await supabase.rpc('upsert_visitor_contact', {
        p_token: identifier as string,
        p_visitor_id: visitorId || null,
        p_email: data.email || null,
        p_phone: data.phone || null,
        p_nome: data.nome || null,
        p_cpf_cnpj: data.cpfCnpj || null,
      } as any);
      if (error) throw error;

      await refetchGallery();
      setContactModalOpen(false);
      setForcedMissing(null);
      if (pendingConfirmPayload) {
        confirmMutation.mutate(pendingConfirmPayload);
        setPendingConfirmPayload(null);
      } else {
        toast.success('Dados salvos. Toque em "Gerar PIX" novamente para continuar.');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'NÃ£o foi possÃ­vel salvar seus dados. Tente novamente.');
    }
  };

  // Handler compartilhado: backend Asaas respondeu 422 MISSING_CPF_CNPJ.
  // ForÃ§a o modal a exibir o campo CPF mesmo se o cache do gallery-access
  // ainda dizia que estava tudo OK.
  const openMissingCpfModal = () => {
    setForcedMissing({ cpfCnpj: true, cpfRequired: true, provider: 'asaas' });
    setContactModalOpen(true);
  };

  const effectiveMissing: ContactCollectionMissing = {
    ...((galleryResponse?.payerHintsMissing as ContactCollectionMissing) || {
      email: false, phone: false, name: false,
    }),
    ...(forcedMissing || {}),
  };

  // Modal reutilizÃ¡vel â€” montado ao lado de cada early return que
  // renderiza AsaasCheckout/PixPaymentScreen, para garantir que
  // setContactModalOpen(true) realmente exiba o modal na tela.
  const contactModalNode = (
    <ContactCollectionModal
      open={contactModalOpen}
      missing={effectiveMissing}
      onCancel={() => { setContactModalOpen(false); setPendingConfirmPayload(null); setForcedMissing(null); }}
      onSubmit={handleContactCollected}
      themeStyles={themeStyles}
      backgroundMode={effectiveBackgroundMode}
    />
  );

  // Props compartilhadas para todos os AsaasCheckout: prÃ©-preenchem e persistem dados.
  const payerHintsPrefill = (galleryResponse as any)?.payerHints || undefined;
  const payerMissingFlags = (galleryResponse?.payerHintsMissing as ContactCollectionMissing | undefined)
    ? {
        name: !!galleryResponse?.payerHintsMissing?.name,
        email: !!galleryResponse?.payerHintsMissing?.email,
        phone: !!galleryResponse?.payerHintsMissing?.phone,
        cpfCnpj: !!galleryResponse?.payerHintsMissing?.cpfCnpj,
      }
    : undefined;
  const handlePersistContact = async (payload: { email?: string; phone?: string; nome?: string; cpfCnpj?: string }) => {
    const { error } = await supabase.rpc('upsert_visitor_contact', {
      p_token: identifier as string,
      p_visitor_id: visitorId || null,
      p_email: payload.email || null,
      p_phone: payload.phone || null,
      p_nome: payload.nome || null,
      p_cpf_cnpj: payload.cpfCnpj || null,
    } as any);
    if (error) throw error;
    // Atualiza o cache local para que prÃ³ximas cobranÃ§as usem os novos dados.
    refetchGallery();
  };



  // Pending payment screen - travada e nÃ£o paga (fonte: selectionLocked + !hasPaid).
  // Cobre tambÃ©m o caso awaitingCharge (sem cobranÃ§a viva â†’ botÃ£o "gerar novo link").
  if (selectionLocked && !hasPaid && !isProcessingPaymentReturn) {
    const pendingPaymentMethod = galleryResponse?.paymentMethod;
    const pendingPixDados = galleryResponse?.pixDados;
    const pendingCheckoutUrl = galleryResponse?.checkoutUrl;
    const pendingValorTotal = galleryResponse?.valorTotal || 0;
    const pendingBgMode = effectiveBackgroundMode;
    const awaitingCharge = Boolean(galleryResponse?.awaitingCharge) || !galleryResponse?.cobrancaId;

    // pendingAction canÃ´nica (backend). Fallback deriva de awaitingCharge/checkoutUrl.
    const pendingAction = (galleryResponse as any)?.pendingAction as
      | { kind: 'external_redirect' | 'asaas_modal' | 'pix_modal' | 'regenerate'; checkoutUrl?: string; provedor: string }
      | undefined;

    // ApÃ³s regenerar, tenta redirecionar/abrir checkout com o payload novo.
    const routeFromFreshData = (fresh: any) => {
      const freshAction = fresh?.pendingAction;
      const freshCheckoutUrl =
        freshAction?.checkoutUrl || fresh?.checkoutUrl || null;
      if (freshAction?.kind === 'external_redirect' && freshCheckoutUrl) {
        window.location.assign(freshCheckoutUrl);
        return true;
      }
      if (
        (freshAction?.kind === 'asaas_modal' && fresh?.asaasCheckoutData) ||
        (freshAction?.kind === 'pix_modal' && fresh?.pixDados) ||
        (fresh?.paymentMethod === 'asaas' && fresh?.asaasCheckoutData) ||
        (fresh?.paymentMethod === 'pix_manual' && fresh?.pixDados)
      ) {
        setShowInlineCheckout(true);
        return true;
      }
      if (freshCheckoutUrl) {
        window.location.assign(freshCheckoutUrl);
        return true;
      }
      return false;
    };

    const handleRegenerateCharge = async () => {
      try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/client-selection`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            galleryToken: identifier,
            action: 'regenerate_charge',
            visitorId: visitorId || undefined,
          }),
        });
        const result = await response.json().catch(() => ({} as any));
        if (!response.ok || !result?.success) {
          const msg = result?.error || 'NÃ£o foi possÃ­vel gerar o link agora.';
          const code = result?.code ? ` (${result.code})` : '';
          throw new Error(`${msg}${code}`);
        }

        const charge = result?.data?.charge || {};
        console.log('[handleRegenerateCharge] charge payload:', charge);

        // 1) Nada a cobrar â†’ apenas atualiza estado
        if (charge?.code === 'NO_AMOUNT_DUE' || charge?.alreadyPaid) {
          toast.success('Pagamento jÃ¡ concluÃ­do');
          await refetchGallery();
          return;
        }

        // 2) Redirect externo (InfinitePay / Mercado Pago)
        if (charge?.checkoutUrl) {
          toast.success('Redirecionandoâ€¦');
          window.location.assign(charge.checkoutUrl);
          return;
        }

        // 3) Checkout inline (Asaas transparente / PIX)
        if (charge?.transparentCheckout || charge?.provedor === 'asaas' || charge?.provedor === 'pix_manual') {
          toast.success('Abrindo pagamentoâ€¦');
          const fresh = await refetchGallery();
          if (routeFromFreshData(fresh?.data)) return;
          // Se por algum motivo os dados frescos nÃ£o bateram, forÃ§a inline mesmo assim.
          setShowInlineCheckout(true);
          return;
        }

        // 4) Fallback: tenta usar o que veio na galeria atualizada
        const fresh = await refetchGallery();
        if (!routeFromFreshData(fresh?.data)) {
          toast.error('NÃ£o foi possÃ­vel abrir o pagamento. Tente novamente.');
          console.error('[handleRegenerateCharge] sem rota resolvida', { charge, fresh: fresh?.data });
        }
      } catch (e) {
        console.error('[handleRegenerateCharge] erro:', e);
        const errMsg = e instanceof Error ? e.message : 'Erro ao gerar novo link';
        
        // Auto-heal: se o erro for de valor zerado ou PAYMENT_CREATE_ERROR (indicando
        // dessincronizaÃ§Ã£o de backend), forÃ§amos um refetch da galeria para corrigir
        // a UI em vez de travar o usuÃ¡rio.
        if (errMsg.includes('PAYMENT_CREATE_ERROR') || errMsg.toLowerCase().includes('maior que zero') || errMsg.includes('SYNC_REQUIRED')) {
          toast.info('Sincronizando cobranÃ§a...');
          const fresh = await refetchGallery();
          if (routeFromFreshData(fresh?.data)) return;
        } else {
          toast.error(errMsg);
        }
      }
    };

    // Handler unificado do botÃ£o "Ir para pagamento" na PaymentPendingScreen.
    const handleResume = async () => {
      // Se jÃ¡ temos dados de checkout inline (Asaas/PIX), apenas revela o componente.
      if (pendingAction?.kind === 'asaas_modal' && galleryResponse?.asaasCheckoutData) {
        toast.success('Abrindo pagamentoâ€¦');
        setShowInlineCheckout(true);
        return;
      }
      if (pendingAction?.kind === 'pix_modal' && pendingPixDados) {
        toast.success('Abrindo pagamentoâ€¦');
        setShowInlineCheckout(true);
        return;
      }
      if (pendingPaymentMethod === 'asaas' && galleryResponse?.asaasCheckoutData) {
        toast.success('Abrindo pagamentoâ€¦');
        setShowInlineCheckout(true);
        return;
      }
      if (pendingPaymentMethod === 'pix_manual' && pendingPixDados) {
        toast.success('Abrindo pagamentoâ€¦');
        setShowInlineCheckout(true);
        return;
      }
      // Fallback: se temos checkoutUrl externo, redireciona direto.
      if (pendingCheckoutUrl) {
        toast.success('Redirecionandoâ€¦');
        window.location.assign(pendingCheckoutUrl);
        return;
      }
      // Caso a cobranÃ§a viva nÃ£o exista, aciona regeneraÃ§Ã£o (mesmo fluxo do botÃ£o regenerate).
      await handleRegenerateCharge();
    };

    const handlePixPaymentConfirmed = async () => {
      setIsConfirmingPixPayment(true);
      try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/client-selection`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ 
            galleryToken: identifier,
            action: 'finalize_payment',
            visitorId: visitorId || undefined,
          }),
        });
        
        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || 'Erro ao confirmar pagamento');
        }
        
        // Refetch gallery to show finalized state
        await refetchGallery();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Erro ao informar pagamento');
      } finally {
        setIsConfirmingPixPayment(false);
      }
    };

    // === Checkout inline: sÃ³ renderiza depois que o cliente clica "Ir para pagamento" ===
    if (showInlineCheckout) {
      // Asaas transparente
      if (
        (pendingAction?.kind === 'asaas_modal' || pendingPaymentMethod === 'asaas') &&
        galleryResponse?.asaasCheckoutData
      ) {
        return (
          <>
            <AsaasCheckout
              data={galleryResponse.asaasCheckoutData as AsaasCheckoutData}
              studioName={galleryResponse.studioSettings?.studio_name}
              studioLogoUrl={galleryResponse.studioSettings?.studio_logo_url}
              onPaymentConfirmed={() => {
                setCurrentStep('confirmed');
                setIsConfirmed(true);
                refetchGallery();
              }}
              onMissingCpf={openMissingCpfModal}
              payerHints={payerHintsPrefill}
              payerMissing={payerMissingFlags}
              onPersistContact={handlePersistContact}
              themeStyles={themeStyles}
              backgroundMode={pendingBgMode}
            />
            {contactModalNode}
          </>
        );
      }
      // PIX manual
      if (
        (pendingAction?.kind === 'pix_modal' || pendingPaymentMethod === 'pix_manual') &&
        pendingPixDados
      ) {
        return (
          <PixPaymentScreen
            chavePix={pendingPixDados.chavePix || ''}
            nomeTitular={pendingPixDados.nomeTitular || ''}
            tipoChave={pendingPixDados.tipoChave}
            valorTotal={pendingValorTotal}
            studioName={galleryResponse.studioSettings?.studio_name}
            studioLogoUrl={galleryResponse.studioSettings?.studio_logo_url}
            onPaymentConfirmed={handlePixPaymentConfirmed}
            themeStyles={themeStyles}
            backgroundMode={pendingBgMode}
            isConfirming={isConfirmingPixPayment}
          />
        );
      }
      // Se caiu aqui sem dados, reseta o flag e mostra a PaymentPendingScreen.
    }

    // === Mapeia todas as aÃ§Ãµes para "resume_modal" (Asaas/PIX) ou externo/regenerate ===
    // Isso forÃ§a TODOS os provedores a passarem pela PaymentPendingScreen primeiro.
    const screenAction = pendingAction
      ? pendingAction.kind === 'external_redirect'
        ? { kind: 'external_redirect' as const, checkoutUrl: pendingAction.checkoutUrl || '', provedor: pendingAction.provedor }
        : pendingAction.kind === 'regenerate'
          ? { kind: 'regenerate' as const, provedor: pendingAction.provedor }
          : { kind: 'resume_modal' as const, provedor: pendingAction.provedor }
      : awaitingCharge
        ? { kind: 'regenerate' as const, provedor: pendingPaymentMethod || 'desconhecido' }
        : pendingCheckoutUrl
          ? { kind: 'external_redirect' as const, checkoutUrl: pendingCheckoutUrl, provedor: pendingPaymentMethod || 'externo' }
          : (pendingPaymentMethod === 'asaas' && galleryResponse?.asaasCheckoutData) ||
            (pendingPaymentMethod === 'pix_manual' && pendingPixDados)
            ? { kind: 'resume_modal' as const, provedor: pendingPaymentMethod }
            : { kind: 'regenerate' as const, provedor: pendingPaymentMethod || 'desconhecido' };

    return (
      <PaymentPendingScreen
        cobrancaId={galleryResponse?.cobrancaId}
        sessionId={sessionId || undefined}
        checkoutUrl={pendingCheckoutUrl}
        valorTotal={pendingValorTotal}
        provedor={pendingPaymentMethod || 'pagamento'}
        studioName={galleryResponse?.studioSettings?.studio_name}
        studioLogoUrl={galleryResponse?.studioSettings?.studio_logo_url}
        themeStyles={themeStyles}
        backgroundMode={pendingBgMode}
        awaitingCharge={awaitingCharge}
        pendingAction={screenAction}
        onResume={handleResume}
        onRegenerate={handleRegenerateCharge}
        onPaymentConfirmed={() => {
          setCurrentStep('confirmed');
          setIsConfirmed(true);
          refetchGallery();
        }}
      />
    );

  }


  // If processing payment return and gallery is momentarily null, show loading instead of error
  if (isProcessingPaymentReturn && !gallery) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background" style={themeStyles}>
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
        <p className="mt-4 text-sm text-muted-foreground">Finalizando...</p>
      </div>
    );
  }

  // Error state - gallery not found or not available (BUT skip if password/visitor is required)
  if ((galleryError || !gallery) && !requiresPassword && !requiresVisitor) {
    const errorMessage = galleryError?.message || '';
    const isNotAvailable = errorMessage === 'Galeria nÃ£o disponÃ­vel';
    const isPublishing = errorMessage === 'GALLERY_PUBLISHING';
    
    return (
      <div className="min-h-screen flex flex-col bg-background">
        
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full text-center space-y-6">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto ${isPublishing ? 'bg-primary/10' : isNotAvailable ? 'bg-muted' : 'bg-destructive/10'}`}>
              {isPublishing ? (
                <Clock className="h-10 w-10 text-primary animate-pulse" />
              ) : (
                <AlertCircle className={`h-10 w-10 ${isNotAvailable ? 'text-muted-foreground' : 'text-destructive'}`} />
              )}
            </div>
            
            <div>
              <h1 className="text-2xl font-bold mb-2">
                {isPublishing ? 'Galeria em publicaÃ§Ã£o' : isNotAvailable ? 'Galeria nÃ£o disponÃ­vel' : 'Galeria nÃ£o encontrada'}
              </h1>
              <p className="text-muted-foreground text-sm">
                {isPublishing 
                  ? 'A galeria estÃ¡ sendo preparada. Tente novamente em alguns instantes.'
                  : isNotAvailable
                  ? 'Esta galeria ainda nÃ£o estÃ¡ acessÃ­vel. Entre em contato com o fotógrafo.'
                  : 'Verifique se o link estÃ¡ correto ou entre em contato com o fotógrafo.'}
              </p>
            </div>

            {isPublishing && (
              <Button variant="outline" onClick={() => refetchGallery()}>
                Tentar novamente
              </Button>
            )}

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
  // Formula: valor_a_cobrar = (total_extras Ã— valor_faixa) - valor_jÃ¡_pago
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
      const previousState = { isSelected: photo.isSelected, isFavorite: photo.isFavorite, comment: photo.comment };
      // Optimistic update
      setLocalPhotos(prev => prev.map(p => 
        p.id === photoId ? { ...p, isSelected: !p.isSelected } : p
      ));
      selectionMutation.mutate({ photoId, action: 'toggle', previousState });
    }
  };

  const handleComment = (photoId: string, comment: string) => {
    const photo = localPhotos.find(p => p.id === photoId);
    const previousState = photo ? { isSelected: photo.isSelected, isFavorite: photo.isFavorite, comment: photo.comment } : undefined;
    setLocalPhotos(prev => prev.map(p => 
      p.id === photoId ? { ...p, comment } : p
    ));
    selectionMutation.mutate({ photoId, action: 'comment', comment, previousState });
  };

  const handleFavorite = (photoId: string) => {
    const photo = localPhotos.find(p => p.id === photoId);
    const previousState = photo ? { isSelected: photo.isSelected, isFavorite: photo.isFavorite, comment: photo.comment } : undefined;
    setLocalPhotos(prev => prev.map(p => 
      p.id === photoId ? { ...p, isFavorite: !p.isFavorite } : p
    ));
    selectionMutation.mutate({ photoId, action: 'favorite', previousState });
  };


  const handleStartConfirmation = () => {
    const currentSelectedCount = localPhotos.filter(p => p.isSelected).length;
    
    // Block empty selection
    if (currentSelectedCount === 0) {
      toast.error('Selecione pelo menos uma foto para confirmar');
      return;
    }
    
    // Warn if selecting fewer than included photos
    if (currentSelectedCount < gallery.includedPhotos) {
      setShowPartialSelectionDialog(true);
      return;
    }
    
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
    
    const payload = {
      selectedCount: currentSelectedCount,
      extraCount: currentExtrasACobrar,
      valorUnitario: resultado.valorUnitario,
      valorTotal: resultado.valorACobrar,
    };

    // ðŸ§­ Etapa intermediÃ¡ria "Dados de cobranÃ§a": SÃ“ aparece quando faltar
    // algum dado (nome/email/whatsapp/CPF) OU quando algum estiver invÃ¡lido.
    // Quando o cliente jÃ¡ tem tudo preenchido e vÃ¡lido, pulamos direto para
    // o `confirm-selection` â€” sem tela intermediÃ¡ria.
    const saleMode = gallery.saleSettings?.mode;
    const shouldRequestPayment = saleMode === 'sale_with_payment' && payload.valorTotal > 0;
    const hints = (galleryResponse as any)?.payerHints as
      | { fullName?: string | null; email?: string | null; phone?: string | null; cpfCnpj?: string | null }
      | undefined;
    const needsPreCheckout = shouldRequestPayment && !hintsAreComplete(hints);
    // Guardar payload permite retomar apÃ³s coleta.
    setPendingConfirmPayload(payload);
    if (needsPreCheckout) {
      setCurrentStep('pre_checkout_contact');
      return;
    }

    confirmMutation.mutate(payload);
  };

  // Submit da etapa "Dados de cobranÃ§a": persiste via RPC e dispara confirm-selection.
  // Regras:
  //  - Erros de rede/RPC exibem toast claro e NÃƒO avanÃ§am (usuÃ¡rio precisa saber).
  //  - `cpf_conflict` (o CPF jÃ¡ pertence a outro cliente do mesmo fotógrafo) NÃƒO trava
  //    o pagamento: mostramos aviso claro, `galeria_visitantes` foi enriquecido, e
  //    seguimos para o checkout com os valores digitados.
  const handlePreCheckoutSubmit = async (values: {
    nome: string; email: string; phone: string; cpfCnpj: string;
  }) => {
    setPreCheckoutExternalErrors({});
    try {
      const { data, error } = await supabase.rpc('upsert_visitor_contact', {
        p_token: identifier as string,
        p_visitor_id: visitorId || null,
        p_email: values.email,
        p_phone: values.phone,
        p_nome: values.nome,
        p_cpf_cnpj: values.cpfCnpj,
      } as any);

      if (error) {
        // Duplicidade real (nÃ£o deveria mais ocorrer com a RPC atualizada, mas mantemos guard).
        if ((error as any).code === '23505') {
          console.warn('[handlePreCheckoutSubmit] cpf duplicado (fallback):', error);
          toast.warning(
            'Este CPF/CNPJ jÃ¡ estÃ¡ cadastrado em outro cliente do fotógrafo. ' +
            'Vamos usar seus dados apenas nesta cobranÃ§a.'
          );
        } else {
          console.error('[handlePreCheckoutSubmit] rpc error:', error);
          toast.error(
            (error as any).message
              ? `NÃ£o foi possÃ­vel salvar seus dados: ${(error as any).message}`
              : 'NÃ£o foi possÃ­vel salvar seus dados. Verifique sua conexÃ£o e tente novamente.'
          );
          return; // Erros reais bloqueiam â€” usuÃ¡rio precisa ver o problema.
        }
      } else if ((data as any)?.cpf_conflict) {
        toast.warning(
          'Este CPF/CNPJ jÃ¡ estÃ¡ vinculado a outro cadastro do fotógrafo. ' +
          'Vamos usar seus dados apenas nesta cobranÃ§a.'
        );
      }

      // Reidrata payerHints antes de submeter â€” evita loop de "faltando dado".
      await refetchGallery();
      if (pendingConfirmPayload) {
        confirmMutation.mutate(pendingConfirmPayload);
      }
    } catch (e: any) {
      console.error('[handlePreCheckoutSubmit] exception:', e);
      toast.error(
        e?.message
          ? `Falha ao salvar dados: ${e.message}`
          : 'Falha inesperada ao salvar dados. Tente novamente.'
      );
    }
  };




  // Parse welcome message
  const welcomeMessage = gallery.settings.welcomeMessage
    .replace('{cliente}', (gallery.clientName || 'Cliente').split(' ')[0])
    .replace('{sessao}', gallery.sessionName)
    .replace('{estudio}', galleryResponse?.studioSettings?.studio_name || 'EstÃºdio');

  // âœ¨ PRIMEIRA VERIFICAÃ‡ÃƒO: Galeria confirmada = modo read-only
  // Deve vir ANTES de showWelcome para garantir que galerias confirmadas
  // sempre mostrem apenas fotos selecionadas, independente do estado de welcome
  if (isConfirmed && currentStep !== 'confirmation' && currentStep !== 'payment') {
    const confirmedSelectedPhotos = localPhotos.filter(p => p.isSelected);
    const allowDownload = gallery.settings.allowDownload;

    // === SEM DOWNLOAD: tela simples de mensagem ===
    if (!allowDownload) {
      return (
        <div 
          className={cn(
            "min-h-screen flex flex-col bg-background text-foreground",
            effectiveBackgroundMode === 'dark' && 'dark'
          )}
          style={themeStyles}
        >
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
            {galleryResponse?.studioSettings?.studio_logo_url && (
              <img 
                src={galleryResponse.studioSettings.studio_logo_url} 
                alt={galleryResponse?.studioSettings?.studio_name || 'Logo do estÃºdio'} 
                className="h-[100px] sm:h-[120px] md:h-[150px] max-w-[280px] sm:max-w-[360px] md:max-w-[450px] object-contain mb-8" 
              />
            )}

            <div className="w-14 h-14 rounded-full bg-primary/15 flex items-center justify-center mb-5">
              <Check className="h-7 w-7 text-primary" />
            </div>

            <h2 className="text-xl font-semibold text-foreground mb-2">
              SeleÃ§Ã£o Confirmada
            </h2>

            <p className="text-sm text-muted-foreground mb-6">
              {confirmedSelectedPhotos.length} {confirmedSelectedPhotos.length === 1 ? 'foto selecionada' : 'fotos selecionadas'}
            </p>

            {gallery.sessionName && (
              <p 
                className="text-base font-normal text-muted-foreground mb-8"
                style={{ fontFamily: getFontFamilyById(gallery.settings.sessionFont) }}
              >
                {gallery.sessionName}
              </p>
            )}

            <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
              Sua galeria jÃ¡ foi finalizada. Para acessÃ¡-la novamente, entre em contato com o(a) fotógrafo(a).
            </p>
          </div>
        </div>
      );
    }
    
    // === COM DOWNLOAD: tela completa com grid + download ===
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
    
    const payload = {
      selectedCount: currentSelectedCount,
      extraCount: currentExtrasACobrar,
      valorUnitario: resultado.valorUnitario,
      valorTotal: resultado.valorACobrar,
    };

    // ðŸ§­ Etapa intermediÃ¡ria "Dados de cobranÃ§a": SÃ“ aparece quando faltar
    // algum dado (nome/email/whatsapp/CPF) OU quando algum estiver invÃ¡lido.
    // Quando o cliente jÃ¡ tem tudo preenchido e vÃ¡lido, pulamos direto para
    // o `confirm-selection` â€” sem tela intermediÃ¡ria.
    const saleMode = gallery.saleSettings?.mode;
    const shouldRequestPayment = saleMode === 'sale_with_payment' && payload.valorTotal > 0;
    const hints = (galleryResponse as any)?.payerHints as
      | { fullName?: string | null; email?: string | null; phone?: string | null; cpfCnpj?: string | null }
      | undefined;
    const needsPreCheckout = shouldRequestPayment && !hintsAreComplete(hints);
    // Guardar payload permite retomar apÃ³s coleta.
    setPendingConfirmPayload(payload);
    if (needsPreCheckout) {
      setCurrentStep('pre_checkout_contact');
      return;
    }

    confirmMutation.mutate(payload);
  };

  // Submit da etapa "Dados de cobranÃ§a": persiste via RPC e dispara confirm-selection.
  // Regras:
  //  - Erros de rede/RPC exibem toast claro e NÃƒO avanÃ§am (usuÃ¡rio precisa saber).
  //  - `cpf_conflict` (o CPF jÃ¡ pertence a outro cliente do mesmo fotógrafo) NÃƒO trava
  //    o pagamento: mostramos aviso claro, `galeria_visitantes` foi enriquecido, e
  //    seguimos para o checkout com os valores digitados.
  const handlePreCheckoutSubmit = async (values: {
    nome: string; email: string; phone: string; cpfCnpj: string;
  }) => {
    setPreCheckoutExternalErrors({});
    try {
      const { data, error } = await supabase.rpc('upsert_visitor_contact', {
        p_token: identifier as string,
        p_visitor_id: visitorId || null,
        p_email: values.email,
        p_phone: values.phone,
        p_nome: values.nome,
        p_cpf_cnpj: values.cpfCnpj,
      } as any);

      if (error) {
        // Duplicidade real (nÃ£o deveria mais ocorrer com a RPC atualizada, mas mantemos guard).
        if ((error as any).code === '23505') {
          console.warn('[handlePreCheckoutSubmit] cpf duplicado (fallback):', error);
          toast.warning(
            'Este CPF/CNPJ jÃ¡ estÃ¡ cadastrado em outro cliente do fotógrafo. ' +
            'Vamos usar seus dados apenas nesta cobranÃ§a.'
          );
        } else {
          console.error('[handlePreCheckoutSubmit] rpc error:', error);
          toast.error(
            (error as any).message
              ? `NÃ£o foi possÃ­vel salvar seus dados: ${(error as any).message}`
              : 'NÃ£o foi possÃ­vel salvar seus dados. Verifique sua conexÃ£o e tente novamente.'
          );
          return; // Erros reais bloqueiam â€” usuÃ¡rio precisa ver o problema.
        }
      } else if ((data as any)?.cpf_conflict) {
        toast.warning(
          'Este CPF/CNPJ jÃ¡ estÃ¡ vinculado a outro cadastro do fotógrafo. ' +
          'Vamos usar seus dados apenas nesta cobranÃ§a.'
        );
      }

      // Reidrata payerHints antes de submeter â€” evita loop de "faltando dado".
      await refetchGallery();
      if (pendingConfirmPayload) {
        confirmMutation.mutate(pendingConfirmPayload);
      }
    } catch (e: any) {
      console.error('[handlePreCheckoutSubmit] exception:', e);
      toast.error(
        e?.message
          ? `Falha ao salvar dados: ${e.message}`
          : 'Falha inesperada ao salvar dados. Tente novamente.'
      );
    }
  };




  // Parse welcome message
  const welcomeMessage = gallery.settings.welcomeMessage
    .replace('{cliente}', (gallery.clientName || 'Cliente').split(' ')[0])
    .replace('{sessao}', gallery.sessionName)
    .replace('{estudio}', galleryResponse?.studioSettings?.studio_name || 'EstÃºdio');

  // âœ¨ PRIMEIRA VERIFICAÃ‡ÃƒO: Galeria confirmada = modo read-only
  // Deve vir ANTES de showWelcome para garantir que galerias confirmadas
  // sempre mostrem apenas fotos selecionadas, independente do estado de welcome
  if (isConfirmed && currentStep !== 'confirmation' && currentStep !== 'payment') {
    const confirmedSelectedPhotos = localPhotos.filter(p => p.isSelected);
    const allowDownload = gallery.settings.allowDownload;

    // === SEM DOWNLOAD: tela simples de mensagem ===
    if (!allowDownload) {
      return (
        <div 
          className={cn(
            "min-h-screen flex flex-col bg-background text-foreground",
            effectiveBackgroundMode === 'dark' && 'dark'
          )}
          style={themeStyles}
        >
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
            {galleryResponse?.studioSettings?.studio_logo_url && (
              <img 
                src={galleryResponse.studioSettings.studio_logo_url} 
                alt={galleryResponse?.studioSettings?.studio_name || 'Logo do estÃºdio'} 
                className="h-[100px] sm:h-[120px] md:h-[150px] max-w-[280px] sm:max-w-[360px] md:max-w-[450px] object-contain mb-8" 
              />
            )}

            <div className="w-14 h-14 rounded-full bg-primary/15 flex items-center justify-center mb-5">
              <Check className="h-7 w-7 text-primary" />
            </div>

            <h2 className="text-xl font-semibold text-foreground mb-2">
              SeleÃ§Ã£o Confirmada
            </h2>

            <p className="text-sm text-muted-foreground mb-6">
              {confirmedSelectedPhotos.length} {confirmedSelectedPhotos.length === 1 ? 'foto selecionada' : 'fotos selecionadas'}
            </p>

            {gallery.sessionName && (
              <p 
                className="text-base font-normal text-muted-foreground mb-8"
                style={{ fontFamily: getFontFamilyById(gallery.settings.sessionFont) }}
              >
                {gallery.sessionName}
              </p>
            )}

            <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
              Sua galeria jÃ¡ foi finalizada. Para acessÃ¡-la novamente, entre em contato com o(a) fotógrafo(a).
            </p>
          </div>
        </div>
      );
    }
    
    // === COM DOWNLOAD: tela completa com grid + download ===
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
              <h2 className="text-lg font-semibold text-foreground">
                Seleção Confirmada!
              </h2>
            </div>
            <button
                onClick={() => setFolderViewMode('albums')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-background border border-border shadow-sm text-sm font-medium text-foreground hover:bg-muted transition-colors whitespace-nowrap"
              >
                {'\u2190'} {'\u00c1'}lbuns
              </button>
            <p className="text-sm text-muted-foreground">
              Você selecionou {confirmedSelectedPhotos.length} fotos. 
              Para alterações, entre em contato com o fotógrafo.
            </p>
            
            {confirmedSelectedPhotos.length > 0 && (
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
            <MasonryGrid gap={supabaseGallery?.configuracoes?.photoSpacing ?? galleryResponse?.settings?.photoSpacing ?? transformedGallery?.settings?.photoSpacing ?? 6}>
                {confirmedSelectedPhotos.map((photo, index) => (
                  <MasonryItem key={photo.id} photoWidth={photo.width} photoHeight={photo.height}>
                    <div className="relative group cursor-pointer" onClick={() => setLightboxIndex(index)}>
                      <div className="overflow-hidden rounded-lg w-full">
                        <img 
                          src={photo.thumbnailUrl} 
                          alt={photo.filename}
                          className="w-full h-auto block"
                          loading="lazy"
                        />
                      </div>
                      <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-md">
                        <Check className="h-4 w-4 text-primary-foreground" />
                      </div>
                      {photo.isFavorite && (
                        <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-destructive flex items-center justify-center shadow-md">
                          <svg className="h-3 w-3 text-destructive-foreground fill-current" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                          </svg>
                        </div>
                      )}
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

  // Welcome screen is now integrated into the access screen.
  // If we reach here, user is authenticated. 
  // We only show welcome if it was explicitly requested AND we haven't skipped it.
  if (showWelcome && !requiresPassword && !requiresVisitor) {
    // If it was already shown or we don't need it, we skip it
    setShowWelcome(false);
  }

  // Pre-checkout contact step â€” universal para todos provedores
  if (currentStep === 'pre_checkout_contact' && pendingConfirmPayload) {
    const hints = (galleryResponse as any)?.payerHints as
      | { fullName?: string | null; email?: string | null; phone?: string | null; cpfCnpj?: string | null }
      | undefined;
    return (
      <PreCheckoutContactStep
        valorTotal={pendingConfirmPayload.valorTotal}
        provider={(gallery.saleSettings?.paymentMethod as any) || null}
        studioName={galleryResponse?.studioSettings?.studio_name}
        photographerFirstName={(() => {
          const raw = (galleryResponse?.studioSettings as any)?.photographer_name
            || galleryResponse?.studioSettings?.studio_name
            || '';
          return String(raw).trim().split(/\s+/)[0] || undefined;
        })()}


        prefill={{
          fullName: hints?.fullName,
          email: hints?.email,
          phone: hints?.phone,
          cpfCnpj: hints?.cpfCnpj,
        }}
        missing={{
          name: !hints?.fullName,
          email: !hints?.email,
          phone: !hints?.phone,
          cpfCnpj: !hints?.cpfCnpj,
        }}
        isSubmitting={confirmMutation.isPending}
        externalErrors={preCheckoutExternalErrors}
        onBack={() => { setPreCheckoutExternalErrors({}); setCurrentStep('confirmation'); }}
        onSubmit={handlePreCheckoutSubmit}
        themeStyles={themeStyles}
        backgroundMode={effectiveBackgroundMode}
      />
    );
  }

  // Render Unified Confirmation Step (combines Review + Checkout)
  if (currentStep === 'confirmation') {

    // Check if payment provider is configured (for sale_with_payment mode)
    const isWithPayment = gallery.saleSettings?.mode === 'sale_with_payment';
    // hasPaymentProvider reflete se REALMENTE existe provider configurado
    // (evita mostrar "Confirmar e Pagar" sem provider, evita "cobrado depois" com provider).
    const hasPaymentProvider = isWithPayment && !!gallery.saleSettings?.paymentMethod;

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
        backgroundMode={effectiveBackgroundMode}
      />
    );
  }


  // Render Payment Step - PIX Manual (internal)
  if (currentStep === 'payment' && pixPaymentData) {
    const handlePixFinalizePayment = async () => {
      setIsConfirmingPixPayment(true);
      try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/client-selection`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ 
            galleryToken: identifier,
            action: 'finalize_payment',
            visitorId: visitorId || undefined,
          }),
        });
        
        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || 'Erro ao confirmar pagamento');
        }
        
        setIsConfirmed(true);
        setCurrentStep('confirmed');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Erro ao informar pagamento');
      } finally {
        setIsConfirmingPixPayment(false);
      }
    };

    return (
      <PixPaymentScreen
        chavePix={pixPaymentData.chavePix}
        nomeTitular={pixPaymentData.nomeTitular}
        tipoChave={pixPaymentData.tipoChave}
        valorTotal={pixPaymentData.valorTotal}
        studioName={galleryResponse?.studioSettings?.studio_name}
        studioLogoUrl={galleryResponse?.studioSettings?.studio_logo_url}
        onPaymentConfirmed={handlePixFinalizePayment}
        isConfirming={isConfirmingPixPayment}
        themeStyles={themeStyles}
        backgroundMode={effectiveBackgroundMode}
      />
    );
  }

  // Render Asaas Transparent Checkout
  if (currentStep === 'payment' && asaasCheckoutData) {
    return (
      <>
        <AsaasCheckout
          data={asaasCheckoutData}
          studioName={galleryResponse?.studioSettings?.studio_name}
          studioLogoUrl={galleryResponse?.studioSettings?.studio_logo_url}
          onPaymentConfirmed={() => {
            setAsaasCheckoutData(null);
            setCurrentStep('confirmed');
            setIsConfirmed(true);
            refetchGallery();
          }}
          onCancel={() => {
            setAsaasCheckoutData(null);
            setCurrentStep('confirmation');
          }}
          onMissingCpf={openMissingCpfModal}
          payerHints={payerHintsPrefill}
          payerMissing={payerMissingFlags}
          onPersistContact={handlePersistContact}
          themeStyles={themeStyles}
          backgroundMode={effectiveBackgroundMode}
        />
        {contactModalNode}
      </>
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
        backgroundMode={effectiveBackgroundMode}
      />
    );
  }

  // Album selection screen â€” shown when gallery has folders and user hasn't picked one
  if (hasFolders && folderViewMode === 'albums' && activeFolderId === null) {
    return (
      <div 
        className={cn(
          "min-h-screen flex flex-col bg-background text-foreground",
          effectiveBackgroundMode === 'dark' && 'dark'
        )}
        style={themeStyles}
      >
        {galleryResponse?.studioSettings?.studio_logo_url && (
          <header className="flex items-center justify-center py-6 sm:py-8">
            <img 
              src={galleryResponse.studioSettings.studio_logo_url} 
              alt={galleryResponse?.studioSettings?.studio_name || 'Logo'} 
              className="h-24 sm:h-28 md:h-36 lg:h-40 max-w-[320px] object-contain"
            />
          </header>
        )}
        <main className="flex-1 flex flex-col items-center px-5 py-6">
          <h2 
            className="text-3xl sm:text-4xl font-normal mb-1 text-center tracking-tight"
            style={{ fontFamily: getFontFamilyById(gallery.settings.sessionFont) }}
          >
            {applyTitleCase(gallery.sessionName, gallery.settings.titleCaseMode || 'normal')}
          </h2>
          <p className="text-muted-foreground text-sm mb-10">{localPhotos.length} fotos</p>
          
          <div className={cn(
            "grid gap-5 w-full",
            galleryFolders.length === 1 
              ? "max-w-md mx-auto" 
              : galleryFolders.length === 2 
                ? "grid-cols-1 sm:grid-cols-2 max-w-2xl mx-auto"
                : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 max-w-4xl mx-auto"
          )}>
            {galleryFolders.map((folder: { id: string; nome: string; ordem: number; cover_photo_id?: string | null }) => {
              const folderPhotos = localPhotos.filter(p => p.folderId === folder.id);
              const coverPhoto = folder.cover_photo_id ? localPhotos.find(p => p.id === folder.cover_photo_id) : null;
              const thumb = coverPhoto || folderPhotos[0];
              const coverUrl = thumb ? ((thumb as any).coverUrl || (thumb as any).previewUrl || thumb.thumbnailUrl) : null;
              const folderSelectedCount = folderPhotos.filter(p => p.isSelected).length;
              return (
                <button
                  key={folder.id}
                  onClick={() => {
                    setActiveFolderId(folder.id);
                    setFolderViewMode('grid');
                  }}
                  className="group relative aspect-[4/5] overflow-hidden cursor-pointer rounded-sm ring-1 ring-white/10 hover:ring-primary/50 transition-all duration-500"
                >
                  {coverUrl ? (
                    <img
                      src={coverUrl}
                      alt={folder.nome}
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000 ease-out"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-zinc-900" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-80 group-hover:opacity-90 transition-opacity" />
                  <div className="absolute bottom-0 left-0 right-0 p-6 text-left transform translate-y-1 group-hover:translate-y-0 transition-transform duration-500">
                    <p 
                      className="text-white font-light text-2xl tracking-tight mb-1"
                      style={{ fontFamily: getFontFamilyById(gallery.settings.sessionFont) }}
                    >
                      {folder.nome}
                    </p>
                    <div className="flex items-center gap-3">
                      <p className="text-white/40 text-[10px] uppercase tracking-[0.2em] font-medium">
                        {folderPhotos.length} fotos
                      </p>
                      {folderSelectedCount > 0 && (
                        <span className="flex items-center gap-1 text-foreground/90 text-[10px] uppercase tracking-[0.2em] font-bold">
                          <Check className="h-2.5 w-2.5" />
                          {folderSelectedCount} selecionadas
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </main>
      </div>
    );
  }

  // Compute filtered photos for grid
  const displayPhotos = (() => {
    let base = localPhotos;
    // Filter by folder when active
    if (hasFolders && activeFolderId) {
      base = base.filter(p => p.folderId === activeFolderId);
    }
    // Then apply filter mode
    if (filterMode === 'favorites') return base.filter(p => p.isFavorite);
    if (filterMode === 'selected') return base.filter(p => p.isSelected);
    return base;
  })();

  // Active folder name
  const activeFolderName = hasFolders && activeFolderId
    ? galleryFolders.find((f: { id: string; nome: string }) => f.id === activeFolderId)?.nome
    : null;

  return (
    <div 
      className={cn(
        "min-h-screen flex flex-col bg-background text-foreground gallery-protected",
        effectiveBackgroundMode === 'dark' && 'dark'
      )}
      style={themeStyles}
    >
      {/* New Header with centered logo */}
      <ClientGalleryHeader
        sessionName={gallery.sessionName}
        sessionFont={getFontFamilyById(gallery.settings.sessionFont)}
        titleCaseMode={gallery.settings.titleCaseMode || 'normal'}
        totalPhotos={hasFolders && activeFolderId ? displayPhotos.length : localPhotos.length}
        deadline={hasDeadline ? gallery.settings.deadline : null}
        hasDeadline={hasDeadline}
        hoursUntilDeadline={hoursUntilDeadline}
        isNearDeadline={isNearDeadline}
        isExpired={isExpired}
        isConfirmed={isConfirmed}
        selectedCount={selectedCount}
        includedPhotos={gallery.includedPhotos}
        extraCount={extraCount}
        extrasPagasAnteriormente={extrasPagasTotal}
        extrasACobrar={extrasACobrar}
        studioLogoUrl={galleryResponse?.studioSettings?.studio_logo_url}
        studioName={galleryResponse?.studioSettings?.studio_name}
        contactEmail={null}
        filterMode={filterMode}
        onFilterChange={setFilterMode}
        favoritesCount={localPhotos.filter(p => p.isFavorite).length}
      />

      {/* Visitor banner for public galleries */}
      {visitorName && (
        <div className="bg-primary/5 border-b border-primary/10 px-4 py-2 text-center">
          <p className="text-xs text-muted-foreground">
            OlÃ¡, <span className="font-medium text-foreground">{visitorName}</span> â€” vocÃª estÃ¡ selecionando suas fotos
          </p>
        </div>
      )}

      {/* Folder navigation bar */}
      {hasFolders && activeFolderId && (
        <div className="bg-background border-b border-border/30 px-3 py-2">
          <div className="flex items-center gap-2 overflow-x-auto">
            <button
                onClick={() => setFolderViewMode('albums')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-background border border-border shadow-sm text-sm font-medium text-foreground hover:bg-muted transition-colors whitespace-nowrap"
              >
                {'\u2190'} {'\u00c1'}lbuns
              </button>
            {galleryFolders.map((f: { id: string; nome: string }) => {
              const isActive = f.id === activeFolderId;
              const count = localPhotos.filter(p => p.folderId === f.id).length;
              return (
                <button
                  key={f.id}
                  onClick={() => setActiveFolderId(f.id)}
                  className={cn(
                    'shrink-0 px-3 py-1 rounded-lg text-xs font-medium transition-colors border',
                    isActive 
                      ? 'bg-foreground text-background border-foreground shadow-sm'
                      : 'border-border text-foreground/70 hover:bg-muted hover:text-foreground'
                  )}
                >
                  {f.nome} ({count})
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Content - Full width gallery */}
      <main 
        className="flex-1 py-2 pb-28" 
        style={{ '--masonry-gap': `${supabaseGallery?.configuracoes?.photoSpacing ?? galleryResponse?.settings?.photoSpacing ?? transformedGallery?.settings?.photoSpacing ?? 8}px` } as React.CSSProperties}
      >
        <MasonryGrid gap={supabaseGallery?.configuracoes?.photoSpacing ?? galleryResponse?.settings?.photoSpacing ?? transformedGallery?.settings?.photoSpacing ?? 8}>
          {displayPhotos.map((photo) => {
            const originalIndex = localPhotos.findIndex(p => p.id === photo.id);
            return (
              <MasonryItem key={photo.id} photoWidth={photo.width} photoHeight={photo.height}>
                <PhotoCard
                  photo={photo}
                  isSelected={photo.isSelected}
                  allowComments={gallery.settings.allowComments}
                  disabled={isBlocked}
                  onSelect={() => toggleSelection(photo.id)}
                  onViewFullscreen={() => setLightboxIndex(originalIndex)}
                  onComment={() => {}}
                  onFavorite={() => handleFavorite(photo.id)}
                />
              </MasonryItem>
            );
          })}
        </MasonryGrid>
      </main>

      {/* Bottom Bar Summary (with integrated discount tiers) */}
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
        saleSettings={gallery.saleSettings}
        hasPayment={gallery.saleSettings?.mode === 'sale_with_payment' && (extrasACobrar ?? 0) > 0}
      />

      {lightboxIndex !== null && (() => {
        const lightboxPhotos = (hasFolders && activeFolderId) ? displayPhotos : localPhotos;
        const lightboxIdx = (hasFolders && activeFolderId)
          ? displayPhotos.findIndex((_, i) => {
              const originalIdx = localPhotos.findIndex(p => p.id === displayPhotos[i]?.id);
              return originalIdx === lightboxIndex;
            })
          : lightboxIndex;
        const actualIdx = lightboxIdx >= 0 ? lightboxIdx : 0;
        return (
          <Lightbox
            photos={lightboxPhotos}
            currentIndex={actualIdx}
            allowComments={gallery.settings.allowComments}
            allowDownload={gallery.settings.allowDownload}
            disabled={isBlocked}
            onClose={() => setLightboxIndex(null)}
            onNavigate={(idx) => {
              if (hasFolders && activeFolderId) {
                const photo = lightboxPhotos[idx];
                if (photo) {
                  const origIdx = localPhotos.findIndex(p => p.id === photo.id);
                  setLightboxIndex(origIdx >= 0 ? origIdx : idx);
                }
              } else {
                setLightboxIndex(idx);
              }
            }}
            onSelect={(photoId) => toggleSelection(photoId)}
            onComment={handleComment}
            onFavorite={handleFavorite}
          />
        );
      })()}

      {/* Partial selection warning dialog */}
      <AlertDialog open={showPartialSelectionDialog} onOpenChange={setShowPartialSelectionDialog}>
        <AlertDialogContent style={themeStyles}>
          <AlertDialogHeader>
            <AlertDialogTitle>SeleÃ§Ã£o abaixo do pacote</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Seu pacote inclui <strong>{gallery?.includedPhotos}</strong> fotos, mas vocÃª selecionou apenas{' '}
                <strong>{localPhotos.filter(p => p.isSelected).length}</strong>.
              </p>
              <p>As fotos nÃ£o selecionadas nÃ£o poderÃ£o ser recuperadas depois.</p>
              <p>Deseja confirmar mesmo assim?</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar e selecionar mais</AlertDialogCancel>
            <AlertDialogAction onClick={() => setCurrentStep('confirmation')}>
              Sim, confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Contact collection modal â€” coleta email/telefone/nome/CPF antes do redirect ao checkout */}
      {contactModalNode}
    </div>
  );
}
