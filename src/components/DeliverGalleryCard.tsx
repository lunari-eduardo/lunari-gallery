import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Download, Image, User, Clock, Send } from 'lucide-react';
import { Gallery } from '@/types/gallery';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface DeliverGalleryCardProps {
  gallery: Gallery;
  totalPhotos: number;
  onClick?: () => void;
}

function getDeliverStatus(gallery: Gallery): { label: string; variant: 'default' | 'destructive' | 'secondary' } {
  if (gallery.status === 'expired') return { label: 'Expirada', variant: 'destructive' };
  if (gallery.status === 'sent') return { label: 'Publicada', variant: 'default' };
  return { label: 'Rascunho', variant: 'secondary' };
}

export function DeliverGalleryCard({ gallery, totalPhotos, onClick }: DeliverGalleryCardProps) {
  const isExpired = gallery.status === 'expired';
  const status = getDeliverStatus(gallery);

  return (
    <div
      className={cn(
        'lunari-card overflow-hidden cursor-pointer group',
        isExpired && 'ring-2 ring-destructive/50 opacity-75'
      )}
      onClick={onClick}
    >
      {/* Photo Preview */}
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        {gallery.photos.length > 0 ? (
          <img
            src={gallery.photos[0].thumbnailUrl}
            alt=""
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Image className="h-12 w-12 text-muted-foreground/40" />
          </div>
        )}

        {/* Badge Deliver */}
        <div className="absolute top-2 left-2">
          <Badge className="bg-blue-600 hover:bg-blue-600 text-white gap-1 text-xs">
            <Send className="h-3 w-3" />
            Deliver
          </Badge>
        </div>

        {/* Photo count */}
        <div className="absolute bottom-2 right-2 bg-background/90 backdrop-blur-sm rounded-full px-2.5 py-1 flex items-center gap-1.5 text-xs font-medium">
          <Image className="h-3.5 w-3.5" />
          {totalPhotos} fotos
        </div>

        {/* Expired overlay */}
        {isExpired && (
          <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center">
            <div className="bg-destructive text-destructive-foreground rounded-full px-3 py-1.5 flex items-center gap-1.5 text-sm font-medium">
              <Clock className="h-4 w-4" />
              Expirada
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
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>

        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Download className="h-3.5 w-3.5" />
            <span>{totalPhotos} fotos</span>
          </div>
          <span className="text-primary font-medium text-xs">Ver entrega →</span>
        </div>
      </div>
    </div>
  );
}
