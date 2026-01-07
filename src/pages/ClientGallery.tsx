import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, differenceInHours, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Calendar, 
  Image, 
  Check, 
  AlertTriangle, 
  Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/Logo';
import { MasonryGrid, MasonryItem } from '@/components/MasonryGrid';
import { PhotoCard } from '@/components/PhotoCard';
import { Lightbox } from '@/components/Lightbox';
import { SelectionSummary } from '@/components/SelectionSummary';
import { SelectionReview } from '@/components/SelectionReview';
import { SelectionCheckout } from '@/components/SelectionCheckout';
import { DemoImportScreen } from '@/components/DemoImportScreen';
import { DemoExportButton } from '@/components/DemoExportButton';
import { useGalleries } from '@/hooks/useGalleries';
import { supabase } from '@/integrations/supabase/client';
import { getThumbnailUrl, getPreviewUrl, getFullscreenUrl, WatermarkSettings } from '@/lib/cloudinaryUrl';
import { GalleryPhoto, Gallery } from '@/types/gallery';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type SelectionStep = 'gallery' | 'review' | 'checkout' | 'confirmed';

const SUPABASE_URL = 'https://tlnjspsywycbudhewsfv.supabase.co';

export default function ClientGallery() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const { getGallery, isLoading: isLocalLoading, updatePhotoSelection, updatePhotoComment, confirmSelection, importGalleryPackage, exportGalleryPackage } = useGalleries();
  
  const [showWelcome, setShowWelcome] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [currentStep, setCurrentStep] = useState<SelectionStep>('gallery');
  const [localPhotos, setLocalPhotos] = useState<GalleryPhoto[]>([]);
  const [isConfirmed, setIsConfirmed] = useState(false);

  // 1. Fetch gallery from Supabase
  const { data: supabaseGallery, isLoading: isLoadingGallery, error: galleryError } = useQuery({
    queryKey: ['client-gallery', id],
    queryFn: async () => {
      if (!id) return null;
      
      const { data, error } = await supabase
        .from('galerias')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) {
        console.log('Supabase gallery fetch error:', error);
        return null;
      }
      
      return data;
    },
    enabled: !!id,
    retry: false,
  });

  // 2. Fetch photos from Supabase
  const { data: supabasePhotos, isLoading: isLoadingPhotos } = useQuery({
    queryKey: ['client-gallery-photos', id],
    queryFn: async () => {
      if (!id) return null;
      
      const { data, error } = await supabase
        .from('galeria_fotos')
        .select('*')
        .eq('galeria_id', id)
        .order('order_index');
      
      if (error) {
        console.log('Supabase photos fetch error:', error);
        return null;
      }
      
      return data;
    },
    enabled: !!supabaseGallery,
  });

  // 3. Transform Supabase data to local format
  const transformedGallery = useMemo((): Gallery | null => {
    if (!supabaseGallery) return null;
    
    const config = supabaseGallery.configuracoes as Record<string, unknown> | null;
    const watermark = config?.watermark as WatermarkSettings | undefined;
    const watermarkDisplayRaw = config?.watermarkDisplay as string | undefined;
    const watermarkDisplay: 'all' | 'fullscreen' | 'none' = 
      watermarkDisplayRaw === 'fullscreen' || watermarkDisplayRaw === 'none' 
        ? watermarkDisplayRaw 
        : 'all';
    
    return {
      id: supabaseGallery.id,
      clientName: supabaseGallery.cliente_nome || 'Cliente',
      clientEmail: supabaseGallery.cliente_email || '',
      sessionName: supabaseGallery.nome_sessao || 'Sessão de Fotos',
      packageName: supabaseGallery.nome_pacote || 'Pacote',
      includedPhotos: supabaseGallery.fotos_incluidas || 10,
      extraPhotoPrice: supabaseGallery.valor_foto_extra || 25,
      status: 'sent' as Gallery['status'], // Map Supabase status
      selectionStatus: supabaseGallery.status_selecao === 'confirmado' ? 'confirmed' : 'in_progress',
      createdAt: new Date(supabaseGallery.created_at),
      updatedAt: new Date(supabaseGallery.updated_at),
      saleSettings: {
        mode: 'sale_without_payment',
        pricingModel: 'fixed',
        chargeType: 'only_extras',
        fixedPrice: supabaseGallery.valor_foto_extra || 25,
        discountPackages: [],
      },
      settings: {
        welcomeMessage: supabaseGallery.mensagem_boas_vindas || 'Olá {cliente}! Bem-vindo à galeria da sua sessão {sessao}.',
        deadline: supabaseGallery.prazo_selecao ? new Date(supabaseGallery.prazo_selecao) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        deadlinePreset: 7,
        watermark: watermark || { type: 'none', opacity: 50, position: 'bottom-right' },
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

  // 4. Transform photos with Cloudinary URLs
  const photos = useMemo((): GalleryPhoto[] => {
    if (!supabasePhotos || !transformedGallery) return [];
    
    return supabasePhotos.map((photo) => ({
      id: photo.id,
      filename: photo.original_filename || photo.filename,
      thumbnailUrl: getThumbnailUrl(photo.storage_key, 300),
      previewUrl: getPreviewUrl(photo.storage_key, transformedGallery.settings.watermark, 1200),
      originalUrl: getFullscreenUrl(photo.storage_key, transformedGallery.settings.watermark),
      width: photo.width || 800,
      height: photo.height || 600,
      isSelected: photo.is_selected || false,
      comment: photo.comment || '',
      order: photo.order_index || 0,
    }));
  }, [supabasePhotos, transformedGallery]);

  // 5. Mutation for toggling selection via Edge Function
  const selectionMutation = useMutation({
    mutationFn: async ({ photoId, action, comment }: { photoId: string; action: 'toggle' | 'select' | 'deselect' | 'comment'; comment?: string }) => {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/client-selection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ galleryId: id, photoId, action, comment }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao atualizar seleção');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      // Update local state optimistically
      setLocalPhotos(prev => prev.map(p => 
        p.id === data.photo.id 
          ? { ...p, isSelected: data.photo.is_selected, comment: data.photo.comment || p.comment } 
          : p
      ));
    },
    onError: (error: Error) => {
      toast.error(error.message);
      // Refetch to sync state
      queryClient.invalidateQueries({ queryKey: ['client-gallery-photos', id] });
    },
  });

  // 6. Mutation for confirming selection
  const confirmMutation = useMutation({
    mutationFn: async () => {
      // Update gallery status to confirmed
      const { error } = await supabase
        .from('galerias')
        .update({ 
          status_selecao: 'confirmado',
          status: 'selecao_completa',
          finalized_at: new Date().toISOString(),
          fotos_selecionadas: localPhotos.filter(p => p.isSelected).length,
        })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      setIsConfirmed(true);
      setCurrentStep('confirmed');
      toast.success('Seleção confirmada!', {
        description: 'O fotógrafo receberá sua seleção.',
      });
    },
    onError: () => {
      toast.error('Erro ao confirmar seleção');
    },
  });

  // Sync photos state when data loads
  useEffect(() => {
    if (photos.length > 0) {
      setLocalPhotos(photos);
      setIsConfirmed(supabaseGallery?.status_selecao === 'confirmado');
    }
  }, [photos, supabaseGallery?.status_selecao]);

  // Fallback to localStorage gallery
  const localGallery = getGallery(id || '');
  
  useEffect(() => {
    if (localGallery && !supabaseGallery && !isLoadingGallery) {
      setLocalPhotos(localGallery.photos.map(p => ({ ...p })));
      setIsConfirmed(localGallery.selectionStatus === 'confirmed');
    }
  }, [localGallery, supabaseGallery, isLoadingGallery]);

  // Determine which gallery to use
  const gallery = transformedGallery || localGallery;
  const isLoading = isLoadingGallery || isLoadingPhotos || isLocalLoading;
  const useSupabase = !!supabaseGallery;

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

  // No gallery found - show demo import
  if (!gallery) {
    return (
      <DemoImportScreen
        galleryId={id || 'unknown'}
        onImport={importGalleryPackage}
      />
    );
  }

  const hoursUntilDeadline = differenceInHours(gallery.settings.deadline, new Date());
  const isNearDeadline = hoursUntilDeadline <= 48 && hoursUntilDeadline > 0;
  const isExpired = isPast(gallery.settings.deadline);
  const isBlocked = isExpired || isConfirmed;

  const selectedCount = localPhotos.filter(p => p.isSelected).length;
  const extraCount = Math.max(0, selectedCount - gallery.includedPhotos);
  const extraTotal = extraCount * gallery.extraPhotoPrice;

  const toggleSelection = (photoId: string) => {
    if (isBlocked) return;
    
    if (useSupabase) {
      // Use Edge Function for Supabase galleries
      const photo = localPhotos.find(p => p.id === photoId);
      if (photo) {
        // Optimistic update
        setLocalPhotos(prev => prev.map(p => 
          p.id === photoId ? { ...p, isSelected: !p.isSelected } : p
        ));
        selectionMutation.mutate({ photoId, action: 'toggle' });
      }
    } else {
      // Use localStorage for demo galleries
      const photo = localPhotos.find(p => p.id === photoId);
      if (photo) {
        updatePhotoSelection(gallery.id, photoId, !photo.isSelected);
        setLocalPhotos(prev => prev.map(p => 
          p.id === photoId ? { ...p, isSelected: !p.isSelected } : p
        ));
      }
    }
  };

  const handleComment = (photoId: string, comment: string) => {
    if (useSupabase) {
      setLocalPhotos(prev => prev.map(p => 
        p.id === photoId ? { ...p, comment } : p
      ));
      selectionMutation.mutate({ photoId, action: 'comment', comment });
    } else {
      updatePhotoComment(gallery.id, photoId, comment);
      setLocalPhotos(prev => prev.map(p => 
        p.id === photoId ? { ...p, comment } : p
      ));
    }
    toast.success('Comentário salvo!');
  };

  const handleStartConfirmation = () => {
    if (extraCount > 0) {
      setCurrentStep('review');
    } else {
      setCurrentStep('checkout');
    }
  };

  const handleConfirm = () => {
    if (useSupabase) {
      confirmMutation.mutate();
    } else {
      confirmSelection(gallery.id);
      setIsConfirmed(true);
      setCurrentStep('confirmed');
      toast.success('Seleção confirmada!', {
        description: 'O fotógrafo receberá sua seleção.',
      });
    }
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
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>
                  até {format(gallery.settings.deadline, "dd 'de' MMM", { locale: ptBR })}
                </span>
              </div>
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

  // Render Confirmed Step
  if (currentStep === 'confirmed') {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <header className="flex items-center justify-center p-4 border-b border-border/50">
          <Logo size="sm" />
        </header>
        
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full text-center space-y-6 animate-slide-up">
            <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
              <Check className="h-10 w-10 text-green-500" />
            </div>
            
            <div>
              <h1 className="font-display text-3xl font-semibold mb-2">
                Seleção Confirmada!
              </h1>
              <p className="text-muted-foreground">
                Sua seleção de {selectedCount} fotos foi registrada.
              </p>
            </div>

            {!useSupabase && (
              <div className="lunari-card p-6 text-left space-y-4">
                <p className="text-sm text-muted-foreground">
                  Como estamos em <strong>modo demo</strong> (sem banco de dados), 
                  exporte sua seleção e envie ao fotógrafo para que ele veja as fotos escolhidas.
                </p>
                
                <DemoExportButton 
                  onExport={() => exportGalleryPackage(gallery.id)}
                  galleryId={gallery.id}
                />
              </div>
            )}

            {useSupabase && (
              <div className="lunari-card p-6 text-left">
                <p className="text-sm text-muted-foreground">
                  O fotógrafo já recebeu sua seleção e entrará em contato em breve 
                  para os próximos passos.
                </p>
              </div>
            )}

            <Button 
              variant="outline" 
              onClick={() => setCurrentStep('gallery')}
              className="w-full"
            >
              Ver galeria novamente
            </Button>
          </div>
        </main>
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
            <p className="text-xs text-muted-foreground">
              {format(gallery.settings.deadline, "dd 'de' MMMM", { locale: ptBR })}
            </p>
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
        />
      )}
    </div>
  );
}
