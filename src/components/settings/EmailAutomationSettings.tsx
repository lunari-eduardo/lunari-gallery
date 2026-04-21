import { Mail } from 'lucide-react';
import { GlobalSettings } from '@/types/gallery';
import { UpdateSettingsOptions } from '@/hooks/useGallerySettings';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface EmailAutomationSettingsProps {
  settings: GlobalSettings;
  updateSettings: (data: Partial<GlobalSettings>, options?: UpdateSettingsOptions) => void;
}

export function EmailAutomationSettings({ settings, updateSettings }: EmailAutomationSettingsProps) {
  const enabled = settings.emailSendingEnabled ?? true;

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Mail className="h-5 w-5 text-primary" />
        </div>
        <div className="space-y-1">
          <h4 className="font-medium">E-mails automáticos</h4>
          <p className="text-sm text-muted-foreground">Você pode desativar cada tipo de e-mail individualmente.</p>
          <p className="text-xs text-muted-foreground">Remetente: contato@mail.lunarihub.com</p>
          <p className="text-xs text-muted-foreground">Respostas vão para o e-mail cadastrado do fotógrafo quando disponível.</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <Label className="text-sm font-medium">Ativar envio de e-mails</Label>
          <Switch
            checked={enabled}
            onCheckedChange={(checked) => updateSettings({ emailSendingEnabled: checked }, { successMessage: 'Preferência de e-mail salva.' })}
          />
        </div>
        <div className={cn('space-y-4 pl-4 border-l border-border', !enabled && 'opacity-50')}>
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label className="text-sm">Envio inicial da galeria</Label>
              <p className="text-xs text-muted-foreground">Notifica o cliente quando você compartilha a galeria.</p>
            </div>
            <Switch
              disabled={!enabled}
              checked={settings.emailOnGallerySent ?? true}
              onCheckedChange={(checked) => updateSettings({ emailOnGallerySent: checked }, { successMessage: 'Preferência de e-mail salva.' })}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label className="text-sm">Reativação de galeria</Label>
              <p className="text-xs text-muted-foreground">Avisa o cliente quando você reabre o prazo de seleção.</p>
            </div>
            <Switch
              disabled={!enabled}
              checked={settings.emailOnGalleryReactivated ?? true}
              onCheckedChange={(checked) => updateSettings({ emailOnGalleryReactivated: checked }, { successMessage: 'Preferência de e-mail salva.' })}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label className="text-sm">Confirmação de pagamento</Label>
              <p className="text-xs text-muted-foreground">Envia recibo automático quando o pagamento é confirmado.</p>
            </div>
            <Switch
              disabled={!enabled}
              checked={settings.emailOnPaymentConfirmed ?? true}
              onCheckedChange={(checked) => updateSettings({ emailOnPaymentConfirmed: checked }, { successMessage: 'Preferência de e-mail salva.' })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
