import { useState, useMemo, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Copy, MessageCircle, Mail, Check, Link as LinkIcon, Phone, Calendar, Lock, Loader2, AlertCircle, RotateCcw } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { GlobalSettings } from '@/types/gallery';
import { Galeria } from '@/hooks/useSupabaseGalleries';
import { supabase } from '@/integrations/supabase/client';
import { buildWhatsAppUrl } from '@/lib/whatsappUrl';

interface ReactivateSuccessModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  gallery: Galeria;
  settings: GlobalSettings;
  clientLink: string | null;
  newDeadline: Date;
  daysGranted: number;
}

function formatPhoneDisplay(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return phone;
}

export function ReactivateSuccessModal({
  isOpen,
  onOpenChange,
  gallery,
  settings,
  clientLink,
  newDeadline,
  daysGranted,
}: ReactivateSuccessModalProps) {
  const [isCopied, setIsCopied] = useState(false);
  const [isLinkCopied, setIsLinkCopied] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailFeedback, setEmailFeedback] = useState<{ status: 'enviado' | 'erro' | 'ignorado'; message: string } | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setIsCopied(false);
      setIsLinkCopied(false);
      setIsSendingEmail(false);
      setEmailFeedback(null);
    }
  }, [isOpen]);

  const emailSendingEnabled = settings.emailSendingEnabled ?? true;
  const reactivationEmailEnabled = settings.emailOnGalleryReactivated ?? true;

  const reactivatedTemplate = useMemo(
    () => settings.emailTemplates.find((t) => t.type === 'gallery_reactivated'),
    [settings.emailTemplates],
  );

  const fullMessage = useMemo(() => {
    const cliente = gallery.clienteNome || 'Cliente';
    const galeriaName = gallery.nomeSessao || 'Galeria';
    const estudio = settings.studioName || 'Estúdio';
    const prazoStr = format(newDeadline, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    const link = clientLink || '[link]';

    let message: string;
    if (reactivatedTemplate) {
      message = reactivatedTemplate.body
        .replace(/{cliente}/g, cliente)
        .replace(/{galeria}/g, galeriaName)
        .replace(/{prazo}/g, prazoStr)
        .replace(/{link}/g, link)
        .replace(/{estudio}/g, estudio)
        .replace(/{dias_restantes}/g, String(daysGranted));
    } else {
      message = `Olá ${cliente}!\n\nBoas notícias: a galeria "${galeriaName}" foi reaberta para você concluir sua seleção de fotos.\n\nVocê tem até ${prazoStr} para escolher suas favoritas.\n\nAcesse: ${link}\n\nCom carinho,\n${estudio}`;
    }

    if (gallery.permissao === 'private' && gallery.galleryPassword) {
      message += `\n\n🔐 Senha: ${gallery.galleryPassword}`;
    }

    return message;
  }, [reactivatedTemplate, gallery, settings.studioName, clientLink, newDeadline, daysGranted]);

  const handleCopyMessage = async () => {
    await navigator.clipboard.writeText(fullMessage);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleCopyLink = async () => {
    if (clientLink) {
      await navigator.clipboard.writeText(clientLink);
      setIsLinkCopied(true);
      setTimeout(() => setIsLinkCopied(false), 2000);
    }
  };

  const handleWhatsApp = async () => {
    const { url, hasDirectContact } = buildWhatsAppUrl(gallery.clienteTelefone, fullMessage);
    if (!hasDirectContact) {
      try {
        await navigator.clipboard.writeText(fullMessage);
      } catch {
        // ignora
      }
      toast.info('Cliente sem telefone cadastrado. A mensagem foi copiada — escolha o contato no WhatsApp e cole.');
    }
    window.open(url, '_blank');
  };

  const handleSendEmail = async () => {
    if (!clientLink) {
      const message = 'Link da galeria ainda não está pronto.';
      setEmailFeedback({ status: 'erro', message });
      toast.error(message);
      return;
    }
    if (!gallery.clienteEmail) {
      const message = 'Cliente não possui e-mail cadastrado.';
      setEmailFeedback({ status: 'ignorado', message });
      toast.info(message);
      return;
    }
    if (!emailSendingEnabled) {
      const message = 'E-mails automáticos estão desativados.';
      setEmailFeedback({ status: 'ignorado', message });
      toast.info(message);
      return;
    }
    if (!reactivationEmailEnabled) {
      const message = 'E-mail de reativação está desativado nas configurações.';
      setEmailFeedback({ status: 'ignorado', message });
      toast.info(message);
      return;
    }

    setIsSendingEmail(true);
    setEmailFeedback(null);
    try {
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: {
          eventType: 'gallery_reactivated',
          galleryId: gallery.id,
          publicToken: gallery.publicToken || undefined,
        },
      });
      if (error) {
        console.error('send-email invoke error:', error);
        const message = error.message || 'Não foi possível enviar o e-mail agora.';
        setEmailFeedback({ status: 'erro', message });
        toast.error(message);
        return;
      }
      const result = data as { status?: 'enviado' | 'erro' | 'ignorado'; message?: string } | null;
      console.log('send-email result:', result);
      const status = result?.status || 'erro';
      const message = result?.message || (status === 'enviado' ? 'E-mail enviado para o cliente.' : 'Não foi possível enviar o e-mail agora.');
      setEmailFeedback({ status, message });
      if (status === 'enviado') toast.success(message);
      else if (status === 'erro') toast.error(message);
      else toast.info(message);
    } catch (e: any) {
      console.error('Reactivation email failed:', e);
      const message = e?.message || 'Não foi possível enviar o e-mail agora.';
      setEmailFeedback({ status: 'erro', message });
      toast.error(message);
    } finally {
      setIsSendingEmail(false);
    }
  };

  const formattedPhone = formatPhoneDisplay(gallery.clienteTelefone);
  const isEmailDisabled =
    isSendingEmail ||
    !gallery.clienteEmail ||
    !emailSendingEnabled ||
    !reactivationEmailEnabled ||
    !clientLink ||
    emailFeedback?.status === 'enviado';

  const emailStatusMessage = emailFeedback?.message
    || (!gallery.clienteEmail
      ? 'Cliente não possui e-mail cadastrado. Use Copiar Mensagem ou WhatsApp.'
      : !emailSendingEnabled
        ? 'E-mails automáticos estão desativados nas configurações.'
        : !reactivationEmailEnabled
          ? 'O envio de e-mail de reativação está desativado nas configurações.'
          : !clientLink
            ? 'Aguardando link público da galeria...'
            : 'Envie por e-mail para notificar o cliente da reabertura.');

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-4">
          <DialogTitle className="flex items-center gap-3 text-lg">
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
              <RotateCcw className="h-4 w-4 text-primary" />
            </div>
            Galeria Reativada
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Client Info + Copy Link */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
              <span className="font-medium text-base">{gallery.clienteNome || 'Cliente'}</span>
              {formattedPhone && (
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" />
                  {formattedPhone}
                </span>
              )}
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                Até {format(newDeadline, "dd 'de' MMM", { locale: ptBR })}
              </span>
              {gallery.permissao === 'private' && gallery.galleryPassword && (
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Lock className="h-3.5 w-3.5" />
                  Senha
                </span>
              )}
            </div>
            <Button
              onClick={handleCopyLink}
              variant="outline"
              size="sm"
              disabled={!clientLink}
              className="gap-2 flex-shrink-0"
            >
              {isLinkCopied ? <Check className="h-4 w-4 text-success" /> : <LinkIcon className="h-4 w-4" />}
              {isLinkCopied ? 'Copiado!' : 'Copiar Link'}
            </Button>
          </div>

          <Separator />

          {/* Message */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Mensagem para o cliente</label>
            <div className="rounded-lg border border-border bg-muted/30 p-4 max-h-[250px] overflow-y-auto">
              <p className="text-sm whitespace-pre-line leading-relaxed">{fullMessage}</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Button onClick={handleCopyMessage} variant="outline" className="justify-center gap-2 h-11">
                {isCopied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                {isCopied ? 'Copiada!' : 'Copiar Mensagem'}
              </Button>

              <Button onClick={handleWhatsApp} variant="terracotta" className="justify-center gap-2 h-11">
                <MessageCircle className="h-4 w-4" />
                WhatsApp
                {formattedPhone && <span className="text-xs opacity-80">→ {formattedPhone}</span>}
              </Button>

              <Button
                onClick={handleSendEmail}
                variant="outline"
                disabled={isEmailDisabled}
                className="justify-center gap-2 h-11"
              >
                {isSendingEmail ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : emailFeedback?.status === 'enviado' ? (
                  <Check className="h-4 w-4 text-success" />
                ) : (
                  <Mail className="h-4 w-4" />
                )}
                {isSendingEmail ? 'Enviando...' : !gallery.clienteEmail ? 'Sem e-mail' : 'Enviar e-mail'}
              </Button>
            </div>

            <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
              <div className="flex items-center gap-2">
                {emailFeedback?.status === 'enviado' ? (
                  <Check className="h-4 w-4 text-success shrink-0" />
                ) : emailFeedback?.status === 'erro' ? (
                  <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                ) : (
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <span className="text-muted-foreground">{emailStatusMessage}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={() => onOpenChange(false)}>Fechar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
