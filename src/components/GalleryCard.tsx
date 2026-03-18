import { format, differenceInHours } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, User, AlertTriangle, MoreHorizontal, Pencil, Share2, Trash2, Image, RotateCcw, DollarSign } from 'lucide-react';
import { Gallery } from '@/types/gallery';
import { StatusBadge } from './StatusBadge';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';

interface GalleryCardProps {
  gallery: Gallery;
  thumbnailUrl?: string;
  paymentStatus?: string | null;
  onClick?: () => void;
  onEdit?: () => void;
  onShare?: () => void;
  onDelete?: () => void;
  onReactivate?: () => void;
}

function PaymentBadge({ status }: { status: string }) {
  if (status === 'pago') {
    return (
      <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/15 text-[10px] px-1.5 py-0">
        <DollarSign className="h-2.5 w-2.5 mr-0.5" />
        Pago
      </Badge>
    );
  }
  if (['pendente', 'aguardando_pagamento', 'aguardando_confirmacao'].includes(status)) {
    return (
      <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20 hover:bg-amber-500/15 text-[10px] px-1.5 py-0">
        <DollarSign className="h-2.5 w-2.5 mr-0.5" />
        Pendente
      </Badge>
    );
  }
  return null;
}

export function GalleryCard({ gallery, thumbnailUrl, paymentStatus, onClick, onEdit, onShare, onDelete, onReactivate }: GalleryCardProps) {
  const hoursUntilDeadline = differenceInHours(gallery.settings.deadline, new Date());
  const isExpired = gallery.status === 'expired';
  const isActiveGallery = ['sent', 'selection_started'].includes(gallery.status);
  const isNearDeadline = isActiveGallery && hoursUntilDeadline <= 48 && hoursUntilDeadline > 0;

  return (
    <div 
      className={cn(
        'lunari-card cursor-pointer group relative hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 overflow-hidden',
        isNearDeadline && 'ring-1 ring-warning/40',
        isExpired && 'ring-1 ring-destructive/40 opacity-75'
      )}
      onClick={onClick}
    >
      <div className="flex p-3 gap-3">
        {/* Thumbnail 1:1 com margem */}
        <div className="w-[72px] h-[72px] flex-shrink-0 rounded-lg overflow-hidden bg-muted">
          {thumbnailUrl ? (
            <img src={thumbnailUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Image className="h-5 w-5 text-muted-foreground/30" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Row 1: Name + Status + Menu */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold truncate leading-tight">
                {gallery.sessionName}
              </h3>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <StatusBadge status={gallery.status} />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    onClick={(e) => e.stopPropagation()}
                    className="h-7 w-7 flex items-center justify-center rounded-md opacity-0 group-hover:opacity-100 md:opacity-0 max-md:opacity-100 hover:bg-muted transition-all"
                  >
                    <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit?.(); }}>
                    <Pencil className="h-3.5 w-3.5 mr-2" />
                    Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onShare?.(); }}>
                    <Share2 className="h-3.5 w-3.5 mr-2" />
                    Compartilhar
                  </DropdownMenuItem>
                  {onReactivate && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onReactivate(); }}>
                        <RotateCcw className="h-3.5 w-3.5 mr-2" />
                        Reativar
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-2" />
                    Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Row 2: Client */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
            <User className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{gallery.clientName}</span>
          </div>

          {/* Row 3: Progress + Payment Badge + Date */}
          <div className="flex items-center justify-between mt-2 text-xs">
            <div className="flex items-center gap-2">
              <div>
                <span className="font-medium text-foreground">
                  {gallery.selectedCount}
                </span>
                <span className="text-muted-foreground">
                  /{gallery.includedPhotos}
                </span>
                {gallery.extraCount > 0 && (
                  <span className="text-primary ml-0.5">
                    +{gallery.extraCount}
                  </span>
                )}
              </div>

              {isNearDeadline && !isExpired && (
                <span className="inline-flex items-center gap-1 text-warning">
                  <AlertTriangle className="h-3 w-3" />
                  {hoursUntilDeadline}h
                </span>
              )}

              {paymentStatus && paymentStatus !== 'sem_vendas' && (
                <PaymentBadge status={paymentStatus} />
              )}
            </div>

            <div className="flex items-center gap-1 text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>{format(gallery.settings.deadline, "dd 'de' MMM", { locale: ptBR })}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
