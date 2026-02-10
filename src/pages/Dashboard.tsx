import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Grid, List, Loader2, AlertCircle, MousePointerClick, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { GalleryCard } from '@/components/GalleryCard';
import { DeliverGalleryCard } from '@/components/DeliverGalleryCard';
import { useSupabaseGalleries, Galeria } from '@/hooks/useSupabaseGalleries';
import { GalleryStatus, Gallery } from '@/types/gallery';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { clearGalleryStorage } from '@/lib/storage';
import { isPast } from 'date-fns';

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
function transformSupabaseToLocal(galeria: Galeria): Gallery & { tipo: 'selecao' | 'entrega'; totalFotos: number } {
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
    selectionStatus: galeria.statusSelecao === 'confirmado' ? 'confirmed' : 'in_progress',
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
  };
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string>('select');
  const [search, setSearch] = useState('');
  const [selectStatusFilter, setSelectStatusFilter] = useState<GalleryStatus | 'all'>('all');
  const [deliverStatusFilter, setDeliverStatusFilter] = useState<DeliverStatusFilter>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  const { galleries: supabaseGalleries, isLoading, error } = useSupabaseGalleries();

  useEffect(() => {
    clearGalleryStorage();
  }, []);

  const allGalleries = useMemo(() => {
    return supabaseGalleries.map(transformSupabaseToLocal);
  }, [supabaseGalleries]);

  // Split by type
  const selectGalleries = useMemo(() => allGalleries.filter(g => g.tipo !== 'entrega'), [allGalleries]);
  const deliverGalleries = useMemo(() => allGalleries.filter(g => g.tipo === 'entrega'), [allGalleries]);

  // Select tab filtering
  const filteredSelectGalleries = selectGalleries.filter((gallery) => {
    const matchesSearch =
      gallery.clientName.toLowerCase().includes(search.toLowerCase()) ||
      gallery.sessionName.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = selectStatusFilter === 'all' || gallery.status === selectStatusFilter;
    return matchesSearch && matchesStatus;
  });

  // Deliver tab filtering
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

  const subtitle = activeTab === 'select'
    ? 'Gerencie as galerias de seleção dos seus clientes'
    : 'Gerencie as entregas finais de fotos';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-semibold">
            Suas Galerias
          </h1>
          <p className="text-muted-foreground mt-1">{subtitle}</p>
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
                  <p>Entrega</p>
                  <p className="text-xs text-muted-foreground font-normal">Download direto</p>
                </div>
              </button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="select">Select</TabsTrigger>
          <TabsTrigger value="deliver">Deliver</TabsTrigger>
        </TabsList>

        {/* ===== SELECT TAB ===== */}
        <TabsContent value="select" className="space-y-6 mt-4">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total', value: selectStats.total, color: 'bg-muted' },
              { label: 'Em seleção', value: selectStats.inProgress, color: 'bg-amber-100 dark:bg-amber-900/30' },
              { label: 'Concluídas', value: selectStats.completed, color: 'bg-green-100 dark:bg-green-900/30' },
              { label: 'Expiradas', value: selectStats.expired, color: 'bg-red-100 dark:bg-red-900/30' },
            ].map((stat) => (
              <div key={stat.label} className={cn('rounded-xl p-4', stat.color)}>
                <p className="text-2xl md:text-3xl font-display font-semibold">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Filters */}
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
            <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
              {selectStatusFilters.map((filter) => (
                <Button
                  key={filter.value}
                  variant={selectStatusFilter === filter.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectStatusFilter(filter.value)}
                  className="whitespace-nowrap"
                >
                  {filter.label}
                </Button>
              ))}
            </div>
            <div className="hidden md:flex gap-1 border rounded-lg p-1">
              <Button variant={viewMode === 'grid' ? 'default' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => setViewMode('grid')}>
                <Grid className="h-4 w-4" />
              </Button>
              <Button variant={viewMode === 'list' ? 'default' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => setViewMode('list')}>
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Gallery Grid */}
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <AlertCircle className="h-12 w-12 text-destructive mb-4" />
              <h3 className="font-display text-xl font-semibold mb-2">Erro ao carregar galerias</h3>
              <p className="text-muted-foreground mb-4">Não foi possível conectar ao banco de dados.</p>
              <Button variant="outline" onClick={() => window.location.reload()}>Tentar novamente</Button>
            </div>
          ) : filteredSelectGalleries.length > 0 ? (
            <div className={cn(
              'grid gap-4 md:gap-6',
              viewMode === 'grid' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1'
            )}>
              {filteredSelectGalleries.map((gallery) => (
                <GalleryCard key={gallery.id} gallery={gallery} onClick={() => navigate(`/gallery/${gallery.id}`)} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <Search className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-display text-xl font-semibold mb-2">Nenhuma galeria encontrada</h3>
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

        {/* ===== DELIVER TAB ===== */}
        <TabsContent value="deliver" className="space-y-6 mt-4">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { label: 'Total', value: deliverStats.total, color: 'bg-muted' },
              { label: 'Publicadas', value: deliverStats.published, color: 'bg-blue-100 dark:bg-blue-900/30' },
              { label: 'Expiradas', value: deliverStats.expired, color: 'bg-red-100 dark:bg-red-900/30' },
            ].map((stat) => (
              <div key={stat.label} className={cn('rounded-xl p-4', stat.color)}>
                <p className="text-2xl md:text-3xl font-display font-semibold">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Filters */}
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
            <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
              {deliverStatusFilters.map((filter) => (
                <Button
                  key={filter.value}
                  variant={deliverStatusFilter === filter.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDeliverStatusFilter(filter.value)}
                  className="whitespace-nowrap"
                >
                  {filter.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Deliver Gallery Grid */}
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <AlertCircle className="h-12 w-12 text-destructive mb-4" />
              <h3 className="font-display text-xl font-semibold mb-2">Erro ao carregar galerias</h3>
              <p className="text-muted-foreground mb-4">Não foi possível conectar ao banco de dados.</p>
              <Button variant="outline" onClick={() => window.location.reload()}>Tentar novamente</Button>
            </div>
          ) : filteredDeliverGalleries.length > 0 ? (
            <div className="grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredDeliverGalleries.map((gallery) => (
                <DeliverGalleryCard
                  key={gallery.id}
                  gallery={gallery}
                  totalPhotos={gallery.totalFotos}
                  onClick={() => navigate(`/gallery/${gallery.id}`)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <Send className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-display text-xl font-semibold mb-2">Nenhuma galeria de entrega</h3>
              <p className="text-muted-foreground mb-6">
                Você ainda não criou nenhuma galeria de entrega. Use esse modo para entregar as fotos finais aos seus clientes.
              </p>
              <Button onClick={() => navigate('/deliver/new')} variant="terracotta">
                <Plus className="h-4 w-4 mr-2" />
                Criar galeria de entrega
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
