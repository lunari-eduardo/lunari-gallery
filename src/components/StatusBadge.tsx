import { cn } from '@/lib/utils';
import { GalleryStatus, SelectionStatus } from '@/types/gallery';
import { 
  Circle, 
  Send, 
  MousePointer, 
  CheckCircle, 
  Clock, 
  XCircle,
  Loader2
} from 'lucide-react';

interface StatusBadgeProps {
  status: GalleryStatus | SelectionStatus;
  type?: 'gallery' | 'selection';
  className?: string;
}

const galleryStatusConfig: Record<GalleryStatus, { label: string; className: string; icon: React.ElementType }> = {
  created: { label: 'Criada', className: 'status-created', icon: Circle },
  sent: { label: 'Enviada', className: 'status-sent', icon: Send },
  selection_started: { label: 'Em seleção', className: 'status-in-progress', icon: MousePointer },
  selection_completed: { label: 'Concluída', className: 'status-completed', icon: CheckCircle },
  expired: { label: 'Expirada', className: 'status-expired', icon: Clock },
  cancelled: { label: 'Cancelada', className: 'status-cancelled', icon: XCircle },
};

const selectionStatusConfig: Record<SelectionStatus, { label: string; className: string; icon: React.ElementType }> = {
  in_progress: { label: 'Em andamento', className: 'status-in-progress', icon: Loader2 },
  confirmed: { label: 'Confirmada', className: 'status-completed', icon: CheckCircle },
  blocked: { label: 'Bloqueada', className: 'status-expired', icon: XCircle },
};

export function StatusBadge({ status, type = 'gallery', className }: StatusBadgeProps) {
  const config = type === 'gallery' 
    ? galleryStatusConfig[status as GalleryStatus]
    : selectionStatusConfig[status as SelectionStatus];

  const Icon = config.icon;

  return (
    <span className={cn('status-badge', config.className, className)}>
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}
