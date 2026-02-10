import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Grid, List, Loader2, AlertCircle, MousePointerClick, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GalleryCard } from '@/components/GalleryCard';
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

const statusFilters: { value: GalleryStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'created', label: 'Criadas' },
  { value: 'sent', label: 'Enviadas' },
  { value: 'selection_started', label: 'Em seleção' },
  { value: 'selection_completed', label: 'Concluídas' },
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
function transformSupabaseToLocal(galeria: Galeria): Gallery {
  // Calculate base status from database
  let status = mapSupabaseStatus(galeria.status);
  
  // Check if gallery is expired based on deadline
  // Only check expiration for galleries that are "sent" or "in selection" (active states)
  const hasDeadline = galeria.prazoSelecao !== null;
  const isActiveStatus = ['sent', 'selection_started'].includes(status);
  
  if (hasDeadline && isActiveStatus && isPast(galeria.prazoSelecao!)) {
    status = 'expired';
  }
  
  // Use createdAt as fallback for deadline display, not current date
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
    status: status,
    selectionStatus: galeria.statusSelecao === 'confirmado' ? 'confirmed' : 'in_progress',
    settings: {
      welcomeMessage: galeria.mensagemBoasVindas || '',
      deadline: deadline,
      deadlinePreset: 'custom',
      watermark: galeria.configuracoes?.watermark || { type: 'standard', opacity: 40, position: 'center' },
      watermarkDisplay: galeria.configuracoes?.watermarkDisplay || 'all',
      imageResizeOption: galeria.configuracoes?.imageResizeOption || 1920,
      allowComments: galeria.configuracoes?.allowComments ?? true,
      allowDownload: galeria.configuracoes?.allowDownload ?? false,
      allowExtraPhotos: galeria.configuracoes?.allowExtraPhotos ?? true,
    },
    photos: [], // Photos are fetched separately when needed
    actions: [],
    createdAt: galeria.createdAt,
    updatedAt: galeria.updatedAt,
    selectedCount: galeria.fotosSelecionadas,
    extraCount: Math.max(0, galeria.fotosSelecionadas - galeria.fotosIncluidas),
    extraTotal: galeria.valorExtras,
  };
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<GalleryStatus | 'all'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  // Only use Supabase galleries - localStorage removed
  const { galleries: supabaseGalleries, isLoading, error } = useSupabaseGalleries();

  // Clear any legacy localStorage galleries on mount
  useEffect(() => {
    clearGalleryStorage();
  }, []);

  // Transform galleries
  const allGalleries = useMemo(() => {
    return supabaseGalleries.map(transformSupabaseToLocal);
  }, [supabaseGalleries]);

  const filteredGalleries = allGalleries.filter((gallery) => {
    const matchesSearch = 
      gallery.clientName.toLowerCase().includes(search.toLowerCase()) ||
      gallery.sessionName.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || gallery.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: allGalleries.length,
    inProgress: allGalleries.filter(g => g.status === 'selection_started').length,
    completed: allGalleries.filter(g => g.status === 'selection_completed').length,
    expired: allGalleries.filter(g => g.status === 'expired').length,
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-semibold">
            Suas Galerias
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie as galerias de seleção dos seus clientes
          </p>
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

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: stats.total, color: 'bg-muted' },
          { label: 'Em seleção', value: stats.inProgress, color: 'bg-amber-100 dark:bg-amber-900/30' },
          { label: 'Concluídas', value: stats.completed, color: 'bg-green-100 dark:bg-green-900/30' },
          { label: 'Expiradas', value: stats.expired, color: 'bg-red-100 dark:bg-red-900/30' },
        ].map((stat) => (
          <div 
            key={stat.label}
            className={cn('rounded-xl p-4', stat.color)}
          >
            <p className="text-2xl md:text-3xl font-display font-semibold">
              {stat.value}
            </p>
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
          {statusFilters.map((filter) => (
            <Button
              key={filter.value}
              variant={statusFilter === filter.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(filter.value)}
              className="whitespace-nowrap"
            >
              {filter.label}
            </Button>
          ))}
        </div>

        <div className="hidden md:flex gap-1 border rounded-lg p-1">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'ghost'}
            size="icon"
            className="h-8 w-8"
            onClick={() => setViewMode('grid')}
          >
            <Grid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'ghost'}
            size="icon"
            className="h-8 w-8"
            onClick={() => setViewMode('list')}
          >
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
          <h3 className="font-display text-xl font-semibold mb-2">
            Erro ao carregar galerias
          </h3>
          <p className="text-muted-foreground mb-4">
            Não foi possível conectar ao banco de dados.
          </p>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Tentar novamente
          </Button>
        </div>
      ) : filteredGalleries.length > 0 ? (
        <div className={cn(
          'grid gap-4 md:gap-6',
          viewMode === 'grid' 
            ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' 
            : 'grid-cols-1'
        )}>
          {filteredGalleries.map((gallery) => (
            <GalleryCard
              key={gallery.id}
              gallery={gallery}
              onClick={() => navigate(`/gallery/${gallery.id}`)}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <Search className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="font-display text-xl font-semibold mb-2">
            Nenhuma galeria encontrada
          </h3>
          <p className="text-muted-foreground mb-6">
            {allGalleries.length === 0 
              ? 'Crie sua primeira galeria para começar' 
              : 'Tente ajustar os filtros ou criar uma nova galeria'}
          </p>
          <Button 
            onClick={() => navigate('/gallery/new')}
            variant="terracotta"
          >
            <Plus className="h-4 w-4 mr-2" />
            Criar Galeria
          </Button>
        </div>
      )}
    </div>
  );
}
