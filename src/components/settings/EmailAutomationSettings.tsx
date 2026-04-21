import { Mail, CheckCircle2, XCircle, MinusCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { GlobalSettings } from '@/types/gallery';
import { UpdateSettingsOptions } from '@/hooks/useGallerySettings';
import { useEmailLogs, EmailDeliveryStatus } from '@/hooks/useEmailLogs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface EmailAutomationSettingsProps {
  settings: GlobalSettings;
  updateSettings: (data: Partial<GlobalSettings>, options?: UpdateSettingsOptions) => void;
}

const statusConfig: Record<EmailDeliveryStatus, { label: string; className: string; Icon: typeof CheckCircle2 }> = {
  enviado: { label: 'Enviado', className: 'bg-success/10 text-success border-success/20', Icon: CheckCircle2 },
  erro: { label: 'Erro', className: 'bg-destructive/10 text-destructive border-destructive/20', Icon: XCircle },
  ignorado: { label: 'Ignorado', className: 'bg-muted text-muted-foreground border-border', Icon: MinusCircle },
};

function eventLabel(event: string) {
  return event === 'payment_confirmed' ? 'Pagamento confirmado' : 'Galeria enviada';
}

export function EmailAutomationSettings({ settings, updateSettings }: EmailAutomationSettingsProps) {
  const { data: logs = [], isLoading } = useEmailLogs();
  const enabled = settings.emailSendingEnabled ?? true;

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Mail className="h-5 w-5 text-primary" />
        </div>
        <div className="space-y-1">
          <h4 className="font-medium">E-mails automáticos</h4>
          <p className="text-sm text-muted-foreground">Você pode desativar os e-mails a qualquer momento.</p>
          <p className="text-xs text-muted-foreground">Remetente: contato@mail.lunarihub.com</p>
          <p className="text-xs text-muted-foreground">Respostas vão para o e-mail cadastrado do fotógrafo quando disponível.</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <Label className="text-sm font-medium">Ativar envio de e-mails</Label>
          <Switch checked={enabled} onCheckedChange={(checked) => updateSettings({ emailSendingEnabled: checked }, { successMessage: 'Preferência de e-mail salva.' })} />
        </div>
        <div className={cn('space-y-4 pl-4 border-l border-border', !enabled && 'opacity-50')}>
          <div className="flex items-center justify-between gap-4">
            <Label className="text-sm">Permitir envio de e-mail de galeria</Label>
            <Switch disabled={!enabled} checked={settings.emailOnGallerySent ?? true} onCheckedChange={(checked) => updateSettings({ emailOnGallerySent: checked }, { successMessage: 'Preferência de e-mail salva.' })} />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label className="text-sm">Enviar e-mail ao confirmar pagamento</Label>
            <Switch disabled={!enabled} checked={settings.emailOnPaymentConfirmed ?? true} onCheckedChange={(checked) => updateSettings({ emailOnPaymentConfirmed: checked }, { successMessage: 'Preferência de e-mail salva.' })} />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h5 className="text-sm font-medium">Histórico de e-mails</h5>
        <div className="space-y-2">
          {isLoading && <p className="text-sm text-muted-foreground">Carregando histórico...</p>}
          {!isLoading && logs.length === 0 && <p className="text-sm text-muted-foreground">Nenhum e-mail registrado ainda.</p>}
          {logs.map((log) => {
            const config = statusConfig[log.status];
            const Icon = config.Icon;
            return (
              <div key={log.id} className="flex flex-col gap-2 rounded-lg border border-border/70 bg-background/40 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{eventLabel(log.eventType)}</p>
                  <p className="truncate text-xs text-muted-foreground">{log.clienteNome || 'Cliente'} · {log.clienteEmail || 'sem e-mail'}</p>
                  {log.friendlyMessage && <p className="text-xs text-muted-foreground mt-1">{log.friendlyMessage}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium', config.className)}>
                    <Icon className="h-3 w-3" />
                    {config.label}
                  </span>
                  <span className="text-xs text-muted-foreground">{formatDistanceToNow(log.createdAt, { locale: ptBR, addSuffix: true })}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
