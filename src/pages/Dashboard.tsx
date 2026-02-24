import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus, Search, Loader2, AlertCircle, MousePointerClick, Send, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { GalleryCard } from '@/components/GalleryCard';
import { DeliverGalleryCard } from '@/components/DeliverGalleryCard';
import { SendGalleryModal } from '@/components/SendGalleryModal';
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
import { useSupabaseGalleries, Galeria } from '@/hooks/useSupabaseGalleries';
import { useSettings } from '@/hooks/useSettings';
import { GalleryStatus, Gallery } from '@/types/gallery';
import { cn } from '@/lib/utils';
import { getDisplayUrl } from '@/lib/photoUrl';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { clearGalleryStorage } from '@/lib/storage';
import { isPast } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

import gallerySelectLogo from '@/assets/gallery-select-logo.png';
import galleryTransferLogo from '@/assets/gallery-transfer-logo.png';

const selectStatusFilters: { value: GalleryStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'created', label: 'Criadas' },
  { value: 'sent', label: 'Enviadas' },
  { value: 'selection_started', label: 'Em seleção' },
  { value: 'selection_completed', label: 'Concluídas' },
  { value: 'expired', label: 'Expiradas' },
];

type DeliverStatusFilter = 'all' | 'published' | 'expired';
const deliverStatusFilters: { value: DeliverStatusFilter; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'published', label: 'Publicadas' },
  { value: 'expired', label: 'Expiradas' },
];

// Map Supabase gallery status to local gallery status
function mapSupabaseStatus(status: string): GalleryStatus {
  switch (status) {
    case 'rascunho':
    case 'criado':
      return 'created';
    case 'enviado':
    case 'publicada':
      return 'sent';
    case 'selecao_iniciada':
    case 'em_selecao':
      return 'selection_started';
    case 'selecao_completa':
    case 'confirmada':
      return 'selection_completed';
    case 'expirado':
    case 'expirada':
      return 'expired';
    default:
      return 'created';
  }
}

// Transform Supabase gallery to local format for display
function transformSupabaseToLocal(galeria: Galeria): Gallery & { tipo: 'selecao' | 'entrega'; totalFotos: number; firstPhotoKey: string | null; coverPhotoKey: string | null } {
  let status = mapSupabaseStatus(galeria.status);
  
  const hasDeadline = galeria.prazoSelecao !== null;
  const isActiveStatus = ['sent', 'selection_started'].includes(status);
  
  if (hasDeadline && isActiveStatus && isPast(galeria.prazoSelecao!)) {
    status = 'expired';
  }
  
  const deadline = galeria.prazoSelecao || galeria.createdAt;
  
  return {
    id: galeria.id,
    clientName: galeria.clienteNome || 'Cliente',
    clientEmail: galeria.clienteEmail || '',
    sessionName: galeria.nomeSessao || 'Sessão',
    packageName: galeria.nomePacote || '',
    includedPhotos: galeria.fotosIncluidas,
    extraPhotoPrice: galeria.valorFotoExtra,
    saleSettings: {
      mode: 'sale_without_payment',
      pricingModel: 'fixed',
      chargeType: 'only_extras',
      fixedPrice: galeria.valorFotoExtra,
      discountPackages: [],
    },
    status,
    selectionStatus: galeria.statusSelecao === 'selecao_completa' ? 'confirmed' : 'in_progress',
    settings: {
      welcomeMessage: galeria.mensagemBoasVindas || '',
      deadline,
      deadlinePreset: 'custom',
      watermark: galeria.configuracoes?.watermark || { type: 'standard', opacity: 40, position: 'center' },
      watermarkDisplay: galeria.configuracoes?.watermarkDisplay || 'all',
      imageResizeOption: galeria.configuracoes?.imageResizeOption || 1920,
      allowComments: galeria.configuracoes?.allowComments ?? true,
      allowDownload: galeria.configuracoes?.allowDownload ?? false,
      allowExtraPhotos: galeria.configuracoes?.allowExtraPhotos ?? true,
    },
    photos: [],
    actions: [],
    createdAt: galeria.createdAt,
    updatedAt: galeria.updatedAt,
    selectedCount: galeria.fotosSelecionadas,
    extraCount: Math.max(0, galeria.fotosSelecionadas - galeria.fotosIncluidas),
    extraTotal: galeria.valorExtras,
    tipo: galeria.tipo,
    totalFotos: galeria.totalFotos,
    firstPhotoKey: galeria.firstPhotoKey,
    coverPhotoKey: galeria.coverPhotoKey,
  };
}

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const activeTab = location.pathname.includes('/galleries/deliver') ? 'deliver' : 'select';

  const handleTabChange = (value: string) => {
    navigate(value === 'deliver' ? '/galleries/deliver' : '/galleries/select', { replace: true });
  };
  const [search, setSearch] = useState('');
  const [selectStatusFilter, setSelectStatusFilter] = useState<GalleryStatus | 'all'>('all');
  const [deliverStatusFilter, setDeliverStatusFilter] = useState<DeliverStatusFilter>('all');
  
  const { galleries: supabaseGalleries, isLoading, error, deleteGallery } = useSupabaseGalleries();
  const { settings } = useSettings();

  // Share & Delete modal state
  const [shareGalleryId, setShareGalleryId] = useState<string | null>(null);
  const [deleteGalleryId, setDeleteGalleryId] = useState<string | null>(null);

  const shareGaleria = useMemo(() => 
    supabaseGalleries.find(g => g.id === shareGalleryId) || null
  , [supabaseGalleries, shareGalleryId]);

  useEffect(() => {
    clearGalleryStorage();
  }, []);

  // Sync expired galleries to database (trigger auto-syncs clientes_sessoes)
  useEffect(() => {
    if (!supabaseGalleries.length) return;
    const expiredGalleries = supabaseGalleries.filter(g => {
      const isActive = ['enviado', 'selecao_iniciada'].includes(g.status);
      return isActive && g.prazoSelecao && isPast(g.prazoSelecao);
    });
    if (expiredGalleries.length === 0) return;

    const syncExpired = async () => {
      await Promise.all(expiredGalleries.map(async (g) => {
        await supabase
          .from('galerias')
          .update({ status: 'expirado', updated_at: new Date().toISOString() })
          .eq('id', g.id);
      }));
    };
    syncExpired();
  }, [supabaseGalleries]);

  const allGalleries = useMemo(() => {
    return supabaseGalleries.map(transformSupabaseToLocal);
  }, [supabaseGalleries]);

  const selectGalleries = useMemo(() => allGalleries.filter(g => g.tipo !== 'entrega'), [allGalleries]);
  const deliverGalleries = useMemo(() => allGalleries.filter(g => g.tipo === 'entrega'), [allGalleries]);

  const filteredSelectGalleries = selectGalleries.filter((gallery) => {
    const matchesSearch =
      gallery.clientName.toLowerCase().includes(search.toLowerCase()) ||
      gallery.sessionName.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = selectStatusFilter === 'all' || gallery.status === selectStatusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredDeliverGalleries = deliverGalleries.filter((gallery) => {
    const matchesSearch =
      gallery.clientName.toLowerCase().includes(search.toLowerCase()) ||
      gallery.sessionName.toLowerCase().includes(search.toLowerCase());
    if (deliverStatusFilter === 'all') return matchesSearch;
    if (deliverStatusFilter === 'published') return matchesSearch && gallery.status === 'sent';
    if (deliverStatusFilter === 'expired') return matchesSearch && gallery.status === 'expired';
    return matchesSearch;
  });

  const selectStats = {
    total: selectGalleries.length,
    inProgress: selectGalleries.filter(g => g.status === 'selection_started').length,
    completed: selectGalleries.filter(g => g.status === 'selection_completed').length,
    expired: selectGalleries.filter(g => g.status === 'expired').length,
  };

  const deliverStats = {
    total: deliverGalleries.length,
    published: deliverGalleries.filter(g => g.status === 'sent').length,
    expired: deliverGalleries.filter(g => g.status === 'expired').length,
  };

  const deleteTarget = allGalleries.find(g => g.id === deleteGalleryId);

  const handleDeleteConfirm = async () => {
    if (!deleteGalleryId) return;
    await deleteGallery(deleteGalleryId);
    setDeleteGalleryId(null);
  };

  const subtitle = activeTab === 'select'
    ? 'Gerencie as escolhas dos seus clientes.'
    : 'Gerencie suas entregas finais.';

  return (
    <div className="max-w-[1100px] mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <img 
            src={activeTab === 'select' ? gallerySelectLogo : galleryTransferLogo} 
            alt={activeTab === 'select' ? 'Gallery Select' : 'Gallery Transfer'}
            className="h-10 object-contain"
          />
          <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="terracotta" size="lg" className="gap-2">
              <Plus className="h-5 w-5" />
              Nova Galeria
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2" align="end" sideOffset={8}>
            <div className="space-y-1">
              <button
                onClick={() => navigate('/gallery/new')}
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-md text-sm font-medium hover:bg-muted transition-colors text-left"
              >
                <MousePointerClick className="h-4 w-4 text-primary shrink-0" />
                <div>
                  <p>Seleção</p>
                  <p className="text-xs text-muted-foreground font-normal">Cliente seleciona fotos</p>
                </div>
              </button>
              <button
                onClick={() => navigate('/deliver/new')}
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-md text-sm font-medium hover:bg-muted transition-colors text-left"
              >
                <Send className="h-4 w-4 text-primary shrink-0" />
                <div>
                  <p>Transfer</p>
                  <p className="text-xs text-muted-foreground font-normal">Entrega final de fotos</p>
                </div>
              </button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="bg-transparent p-0 h-auto rounded-none border-b border-border w-full justify-start">
          <TabsTrigger 
            value="select"
            className="bg-transparent rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-2.5 pt-1 text-muted-foreground data-[state=active]:text-foreground font-medium"
          >
            Select
          </TabsTrigger>
          <TabsTrigger 
            value="deliver"
            className="bg-transparent rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-2.5 pt-1 text-muted-foreground data-[state=active]:text-foreground font-medium"
          >
            Transfer
          </TabsTrigger>
        </TabsList>

        {/* ===== SELECT TAB ===== */}
        <TabsContent value="select" className="space-y-5 mt-4">
          <p className="text-sm text-muted-foreground">
            {selectStats.total} galerias · {selectStats.inProgress} em seleção · {selectStats.completed} concluídas · {selectStats.expired} expiradas
          </p>

          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente ou sessão..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="inline-flex border border-border rounded-lg overflow-hidden">
              {selectStatusFilters.map((filter, i) => (
                <button
                  key={filter.value}
                  onClick={() => setSelectStatusFilter(filter.value)}
                  className={cn(
                    'px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap',
                    i < selectStatusFilters.length - 1 && 'border-r border-border',
                    selectStatusFilter === filter.value
                      ? 'bg-muted text-foreground'
                      : 'bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  )}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <AlertCircle className="h-12 w-12 text-destructive mb-4" />
              <h3 className="text-xl font-semibold mb-2">Erro ao carregar galerias</h3>
              <p className="text-muted-foreground mb-4">Não foi possível conectar ao banco de dados.</p>
              <Button variant="outline" onClick={() => window.location.reload()}>Tentar novamente</Button>
            </div>
          ) : filteredSelectGalleries.length > 0 ? (
            <div className="flex flex-col gap-3">
              {filteredSelectGalleries.map((gallery) => (
                <GalleryCard
                  key={gallery.id}
                  gallery={gallery}
                  thumbnailUrl={gallery.firstPhotoKey ? getDisplayUrl(gallery.firstPhotoKey) : undefined}
                  onClick={() => navigate(`/gallery/${gallery.id}`)}
                  onEdit={() => navigate(`/gallery/${gallery.id}/edit`)}
                  onShare={() => setShareGalleryId(gallery.id)}
                  onDelete={() => setDeleteGalleryId(gallery.id)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <Search className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Nenhuma galeria encontrada</h3>
              <p className="text-muted-foreground mb-6">
                {selectGalleries.length === 0 ? 'Crie sua primeira galeria para começar' : 'Tente ajustar os filtros ou criar uma nova galeria'}
              </p>
              <Button onClick={() => navigate('/gallery/new')} variant="terracotta">
                <Plus className="h-4 w-4 mr-2" />
                Criar Galeria
              </Button>
            </div>
          )}
        </TabsContent>

        {/* ===== TRANSFER TAB ===== */}
        <TabsContent value="deliver" className="space-y-5 mt-4">
          <p className="text-sm text-muted-foreground">
            {deliverStats.total} transfers · {deliverStats.published} publicadas · {deliverStats.expired} expiradas
          </p>

          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente ou sessão..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="inline-flex border border-border rounded-lg overflow-hidden">
              {deliverStatusFilters.map((filter, i) => (
                <button
                  key={filter.value}
                  onClick={() => setDeliverStatusFilter(filter.value)}
                  className={cn(
                    'px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap',
                    i < deliverStatusFilters.length - 1 && 'border-r border-border',
                    deliverStatusFilter === filter.value
                      ? 'bg-muted text-foreground'
                      : 'bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  )}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <AlertCircle className="h-12 w-12 text-destructive mb-4" />
              <h3 className="text-xl font-semibold mb-2">Erro ao carregar galerias</h3>
              <p className="text-muted-foreground mb-4">Não foi possível conectar ao banco de dados.</p>
              <Button variant="outline" onClick={() => window.location.reload()}>Tentar novamente</Button>
            </div>
          ) : filteredDeliverGalleries.length > 0 ? (
            <div className="grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {filteredDeliverGalleries.map((gallery) => (
                <DeliverGalleryCard
                  key={gallery.id}
                  gallery={gallery}
                  totalPhotos={gallery.totalFotos}
                  onClick={() => navigate(`/deliver/${gallery.id}`)}
                  onEdit={() => navigate(`/deliver/${gallery.id}`)}
                  onShare={() => setShareGalleryId(gallery.id)}
                  onDelete={() => setDeleteGalleryId(gallery.id)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <Send className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Nenhuma galeria de transfer</h3>
              <p className="text-muted-foreground mb-6">
                Use esse modo para entregar as fotos finais aos seus clientes.
              </p>
              <Button onClick={() => navigate('/deliver/new')} variant="terracotta">
                <Plus className="h-4 w-4 mr-2" />
                Criar galeria de transfer
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Share Modal */}
      {shareGaleria && (
        <SendGalleryModal
          isOpen={!!shareGalleryId}
          onOpenChange={(open) => !open && setShareGalleryId(null)}
          gallery={shareGaleria}
          settings={settings}
        />
      )}

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteGalleryId} onOpenChange={(open) => !open && setDeleteGalleryId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir galeria?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>"{deleteTarget?.sessionName}"</strong>?
              <br /><br />
              <span className="text-destructive font-medium">
                Esta ação é irreversível. Todas as fotos serão removidas permanentemente.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteConfirm();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
