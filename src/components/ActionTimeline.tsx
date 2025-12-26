import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Circle, 
  Send, 
  MousePointer, 
  CheckCircle, 
  RotateCcw, 
  Clock 
} from 'lucide-react';
import { GalleryAction } from '@/types/gallery';
import { cn } from '@/lib/utils';

interface ActionTimelineProps {
  actions: GalleryAction[];
}

const actionConfig: Record<GalleryAction['type'], { icon: React.ElementType; color: string }> = {
  created: { icon: Circle, color: 'text-muted-foreground' },
  sent: { icon: Send, color: 'text-blue-500' },
  client_started: { icon: MousePointer, color: 'text-amber-500' },
  client_confirmed: { icon: CheckCircle, color: 'text-green-500' },
  selection_reopened: { icon: RotateCcw, color: 'text-primary' },
  expired: { icon: Clock, color: 'text-destructive' },
};

export function ActionTimeline({ actions }: ActionTimelineProps) {
  return (
    <div className="space-y-4">
      {actions.map((action, index) => {
        const config = actionConfig[action.type];
        const Icon = config.icon;
        const isLast = index === actions.length - 1;

        return (
          <div key={action.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={cn(
                'h-8 w-8 rounded-full flex items-center justify-center bg-muted',
                config.color
              )}>
                <Icon className="h-4 w-4" />
              </div>
              {!isLast && (
                <div className="flex-1 w-px bg-border mt-2" />
              )}
            </div>
            <div className="flex-1 pb-4">
              <p className="font-medium text-sm">{action.description}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {format(action.timestamp, "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
