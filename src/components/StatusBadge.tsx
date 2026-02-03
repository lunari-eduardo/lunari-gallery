import { cn } from '@/lib/utils';
import { GalleryStatus, SelectionStatus } from '@/types/gallery';
import { 
  Circle, 
  Send, 
  MousePointer, 
  CheckCircle, 
  Clock, 
  XCircle,
  Loader2,
  HelpCircle
} from 'lucide-react';

interface StatusBadgeProps {
  status: GalleryStatus | SelectionStatus | string;
  type?: 'gallery' | 'selection';
  className?: string;
}

// Mapeamento de status em português (banco) para inglês (código)
const statusTranslation: Record<string, GalleryStatus | SelectionStatus> = {
  // Português → Inglês (Gallery)
  'rascunho': 'created',
  'enviado': 'sent',
  'selecao_iniciada': 'selection_started',
  'selecao_concluida': 'selection_completed',
  'expirado': 'expired',
  'cancelado': 'cancelled',
  // Inglês → Inglês (já corretos)
  'created': 'created',
  'sent': 'sent',
  'selection_started': 'selection_started',
  'selection_completed': 'selection_completed',
  'expired': 'expired',
  'cancelled': 'cancelled',
  // Selection status
  'in_progress': 'in_progress',
  'confirmed': 'confirmed',
  'blocked': 'blocked',
  'em_andamento': 'in_progress',
  'confirmado': 'confirmed',
  'bloqueado': 'blocked',
};

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

const defaultConfig = { label: 'Desconhecido', className: 'status-created', icon: HelpCircle };

export function StatusBadge({ status, type = 'gallery', className }: StatusBadgeProps) {
  // Normalizar status usando mapeamento
  const normalizedStatus = statusTranslation[status] || status;
  
  const config = type === 'gallery' 
    ? galleryStatusConfig[normalizedStatus as GalleryStatus] || defaultConfig
    : selectionStatusConfig[normalizedStatus as SelectionStatus] || defaultConfig;

  const Icon = config.icon;

  return (
    <span className={cn('status-badge', config.className, className)}>
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}
