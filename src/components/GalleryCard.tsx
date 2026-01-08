import { format, differenceInHours } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Image, User, AlertTriangle, Clock } from 'lucide-react';
import { Gallery } from '@/types/gallery';
import { StatusBadge } from './StatusBadge';
import { cn } from '@/lib/utils';

interface GalleryCardProps {
  gallery: Gallery;
  onClick?: () => void;
}

export function GalleryCard({ gallery, onClick }: GalleryCardProps) {
  const hoursUntilDeadline = differenceInHours(gallery.settings.deadline, new Date());
  
  // Use status from gallery (already calculated in transformation) instead of recalculating
  const isExpired = gallery.status === 'expired';
  
  // Only show deadline warning for active galleries (sent or in selection)
  const isActiveGallery = ['sent', 'selection_started'].includes(gallery.status);
  const isNearDeadline = isActiveGallery && hoursUntilDeadline <= 48 && hoursUntilDeadline > 0;

  const previewPhotos = gallery.photos.slice(0, 4);

  return (
    <div 
      className={cn(
        'lunari-card overflow-hidden cursor-pointer group',
        isNearDeadline && 'ring-2 ring-warning/50',
        isExpired && 'ring-2 ring-destructive/50 opacity-75'
      )}
      onClick={onClick}
    >
      {/* Photo Preview Grid */}
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        <div className="grid grid-cols-2 grid-rows-2 h-full gap-0.5">
          {previewPhotos.map((photo, i) => (
            <div key={photo.id} className="relative overflow-hidden">
              <img
                src={photo.thumbnailUrl}
                alt=""
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </div>
          ))}
        </div>
        
        {/* Overlay with photo count */}
        <div className="absolute bottom-2 right-2 bg-background/90 backdrop-blur-sm rounded-full px-2.5 py-1 flex items-center gap-1.5 text-xs font-medium">
          <Image className="h-3.5 w-3.5" />
          {gallery.photos.length}
        </div>

        {/* Warning overlay for near deadline */}
        {isNearDeadline && !isExpired && (
          <div className="absolute top-2 left-2 bg-warning text-warning-foreground rounded-full px-2.5 py-1 flex items-center gap-1.5 text-xs font-medium animate-pulse">
            <AlertTriangle className="h-3.5 w-3.5" />
            {hoursUntilDeadline}h restantes
          </div>
        )}

        {/* Expired overlay */}
        {isExpired && (
          <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center">
            <div className="bg-destructive text-destructive-foreground rounded-full px-3 py-1.5 flex items-center gap-1.5 text-sm font-medium">
              <Clock className="h-4 w-4" />
              Prazo expirado
            </div>
          </div>
        )}
      </div>

      {/* Card Content */}
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-display text-lg font-semibold truncate">
              {gallery.sessionName}
            </h3>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <User className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">{gallery.clientName}</span>
            </div>
          </div>
          <StatusBadge status={gallery.status} />
        </div>

        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            <span>
              {format(gallery.settings.deadline, "dd 'de' MMM", { locale: ptBR })}
            </span>
          </div>
          
          <div className="text-right">
            <span className="font-medium text-foreground">
              {gallery.selectedCount}
            </span>
            <span className="text-muted-foreground">
              /{gallery.includedPhotos}
            </span>
            {gallery.extraCount > 0 && (
              <span className="text-primary ml-1">
                +{gallery.extraCount}
              </span>
            )}
          </div>
        </div>

        {gallery.extraTotal > 0 && (
          <div className="pt-2 border-t border-border">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Valor adicional</span>
              <span className="font-semibold text-primary">
                R$ {gallery.extraTotal.toFixed(2)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
