import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Grid, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GalleryCard } from '@/components/GalleryCard';
import { useGalleries } from '@/hooks/useGalleries';
import { GalleryStatus } from '@/types/gallery';
import { cn } from '@/lib/utils';

const statusFilters: { value: GalleryStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'created', label: 'Criadas' },
  { value: 'sent', label: 'Enviadas' },
  { value: 'selection_started', label: 'Em seleção' },
  { value: 'selection_completed', label: 'Concluídas' },
  { value: 'expired', label: 'Expiradas' },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<GalleryStatus | 'all'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const { galleries } = useGalleries();

  const filteredGalleries = galleries.filter((gallery) => {
    const matchesSearch = 
      gallery.clientName.toLowerCase().includes(search.toLowerCase()) ||
      gallery.sessionName.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || gallery.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: galleries.length,
    inProgress: galleries.filter(g => g.status === 'selection_started').length,
    completed: galleries.filter(g => g.status === 'selection_completed').length,
    expired: galleries.filter(g => g.status === 'expired').length,
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
        <Button 
          onClick={() => navigate('/gallery/new')}
          variant="terracotta"
          size="lg"
          className="gap-2"
        >
          <Plus className="h-5 w-5" />
          Nova Galeria
        </Button>
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
      {filteredGalleries.length > 0 ? (
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
            Tente ajustar os filtros ou criar uma nova galeria
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
