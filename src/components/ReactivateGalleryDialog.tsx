import { useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Copy, Check, RotateCcw, MessageCircle, Mail, Loader2, AlertCircle, Link as LinkIcon } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { GlobalSettings } from '@/types/gallery';
import { Galeria } from '@/hooks/useSupabaseGalleries';

interface ReactivateGalleryDialogProps {
  galleryName: string;
  clientLink: string | null;
  onReactivate: (days: number) => Promise<void>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  gallery?: Galeria;
  settings?: GlobalSettings;
}

function formatPhoneDisplay(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return phone;
}

export function ReactivateGalleryDialog({
  galleryName,
  clientLink,
  onReactivate,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  gallery,
  settings,
}: ReactivateGalleryDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? (controlledOnOpenChange || (() => {})) : setInternalOpen;
  const [days, setDays] = useState('7');
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [copied, setCopied] = useState(false);
  const [messageCopied, setMessageCopied] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailFeedback, setEmailFeedback] = useState<{ status: 'enviado' | 'erro' | 'ignorado'; message: string } | null>(null);
  const lastDaysRef = useRef(7);

  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setShowSuccess(false);
        setDays('7');
        setCopied(false);
        setMessageCopied(false);
        setEmailFeedback(null);
        setIsSendingEmail(false);
      }, 200);
    }
  }, [open]);

  const emailSendingEnabled = settings?.emailSendingEnabled ?? true;
  const galleryEmailEnabled = settings?.emailOnGallerySent ?? true;
  const reactivatedTemplate = useMemo(
    () => settings?.emailTemplates.find((t) => t.type === 'gallery_reactivated'),
    [settings?.emailTemplates],
  );

  const newDeadline = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + lastDaysRef.current);
    return d;
  }, [showSuccess]);

  const fullMessage = useMemo(() => {
    const cliente = gallery?.clienteNome || 'Cliente';
    const galeriaName = gallery?.nomeSessao || galleryName;
    const estudio = settings?.studioName || 'Estúdio';
    const prazoStr = format(newDeadline, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    const link = clientLink || '[link]';

    if (reactivatedTemplate) {
      return reactivatedTemplate.body
        .replace(/{cliente}/g, cliente)
        .replace(/{galeria}/g, galeriaName)
        .replace(/{prazo}/g, prazoStr)
        .replace(/{link}/g, link)
        .replace(/{estudio}/g, estudio)
        .replace(/{dias_restantes}/g, String(lastDaysRef.current));
    }

    return `Olá ${cliente}!\n\nBoas notícias: a galeria "${galeriaName}" foi reaberta para você concluir sua seleção de fotos.\n\nVocê tem até ${prazoStr} para escolher suas favoritas.\n\nAcesse: ${link}\n\nCom carinho,\n${estudio}`;
  }, [reactivatedTemplate, gallery, galleryName, settings?.studioName, clientLink, newDeadline]);

  const handleReactivate = async () => {
    const parsed = parseInt(days) || 7;
    if (parsed < 1 || parsed > 90) {
      toast.error('O prazo deve ser entre 1 e 90 dias');
      return;
    }

    setIsLoading(true);
    try {
      await onReactivate(parsed);
      lastDaysRef.current = parsed;
      setShowSuccess(true);
    } catch (error) {
      console.error('Error reactivating gallery:', error);
      toast.error('Erro ao reativar galeria');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (clientLink) {
      navigator.clipboard.writeText(clientLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyMessage = async () => {
    await navigator.clipboard.writeText(fullMessage);
    setMessageCopied(true);
    setTimeout(() => setMessageCopied(false), 2000);
  };

  const handleWhatsApp = () => {
    const phone = gallery?.clienteTelefone?.replace(/\D/g, '');
    const message = encodeURIComponent(fullMessage);
    const url = phone ? `https://wa.me/55${phone}?text=${message}` : `https://wa.me/?text=${message}`;
    window.open(url, '_blank');
  };

  const handleSendEmail = async () => {
    if (!gallery?.id) return;
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
    if (!galleryEmailEnabled) {
      const message = 'Envio de e-mail de galeria está desativado.';
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
      if (error) throw error;
      const result = data as { status?: 'enviado' | 'erro' | 'ignorado'; message?: string } | null;
      const status = result?.status || 'erro';
      const message = result?.message || (status === 'enviado' ? 'E-mail enviado para o cliente.' : 'Não foi possível enviar o e-mail agora.');
      setEmailFeedback({ status, message });
      if (status === 'enviado') toast.success(message);
      else if (status === 'erro') toast.error(message);
      else toast.info(message);
    } catch (e) {
      console.warn('Reactivation email failed:', e);
      const message = 'Não foi possível enviar o e-mail agora.';
      setEmailFeedback({ status: 'erro', message });
      toast.error(message);
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleClose = () => setOpen(false);

  const formattedPhone = formatPhoneDisplay(gallery?.clienteTelefone);
  const hasEmailIntegration = !!gallery && !!settings;
  const isEmailDisabled =
    !hasEmailIntegration ||
    isSendingEmail ||
    !gallery?.clienteEmail ||
    !emailSendingEnabled ||
    !galleryEmailEnabled ||
    emailFeedback?.status === 'enviado';

  const emailStatusMessage = emailFeedback?.message
    || (!gallery?.clienteEmail
      ? 'Cliente não possui e-mail cadastrado. Use Copiar Mensagem ou WhatsApp.'
      : !emailSendingEnabled
        ? 'E-mails automáticos estão desativados nas configurações.'
        : !galleryEmailEnabled
          ? 'O envio de e-mail de galeria está desativado nas configurações.'
          : 'Envie por e-mail para notificar o cliente da reabertura.');

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose(); else setOpen(true); }}>
      {!isControlled && (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <RotateCcw className="h-4 w-4 mr-2" />
            Reativar
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className={showSuccess ? 'sm:max-w-2xl max-h-[90vh] overflow-y-auto' : 'sm:max-w-md'}>
        {!showSuccess ? (
          <>
            <DialogHeader>
              <DialogTitle>Reativar Seleção</DialogTitle>
              <DialogDescription>
                Defina um novo prazo para o cliente fazer a seleção de fotos da galeria "{galleryName}".
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="days">Prazo para seleção (dias)</Label>
                <Input
                  id="days"
                  type="number"
                  min={1}
                  max={90}
                  value={days}
                  onChange={(e) => setDays(e.target.value)}
                  placeholder="7"
                />
                <p className="text-xs text-muted-foreground">
                  O cliente terá {days || '0'} dia{days !== '1' ? 's' : ''} para concluir a seleção.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Cancelar</Button>
              <Button onClick={handleReactivate} disabled={isLoading}>
                {isLoading ? 'Reativando...' : 'Reativar Galeria'}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader className="pb-2">
              <DialogTitle className="flex items-center gap-3 text-lg">
                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                  <RotateCcw className="h-4 w-4 text-primary" />
                </div>
                Galeria Reativada!
              </DialogTitle>
              <DialogDescription>
                Reaberta com prazo de {lastDaysRef.current} dia{lastDaysRef.current !== 1 ? 's' : ''} até {format(newDeadline, "dd/MM/yyyy", { locale: ptBR })}.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5">
              {/* Link */}
              {clientLink ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="text-sm text-muted-foreground truncate flex-1 min-w-0">
                    {clientLink}
                  </div>
                  <Button onClick={handleCopyLink} variant="outline" size="sm" className="gap-2 flex-shrink-0">
                    {copied ? <Check className="h-4 w-4 text-success" /> : <LinkIcon className="h-4 w-4" />}
                    {copied ? 'Copiado!' : 'Copiar Link'}
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  O link estará disponível após publicar a galeria.
                </p>
              )}

              {hasEmailIntegration && clientLink && (
                <>
                  <Separator />

                  {/* Message preview */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Mensagem para o cliente</label>
                    <div className="rounded-lg border border-border bg-muted/30 p-4 max-h-[200px] overflow-y-auto">
                      <p className="text-sm whitespace-pre-line leading-relaxed">{fullMessage}</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <Button onClick={handleCopyMessage} variant="outline" className="justify-center gap-2 h-11">
                        {messageCopied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                        {messageCopied ? 'Copiada!' : 'Copiar Mensagem'}
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
                        {isSendingEmail ? 'Enviando...' : !gallery?.clienteEmail ? 'Sem e-mail' : 'Enviar e-mail'}
                      </Button>
                    </div>

                    <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
                      <div className="flex items-center gap-2">
                        {emailFeedback?.status === 'enviado' ? (
                          <Check className="h-4 w-4 text-success" />
                        ) : emailFeedback?.status === 'erro' ? (
                          <AlertCircle className="h-4 w-4 text-destructive" />
                        ) : (
                          <Mail className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="text-muted-foreground">{emailStatusMessage}</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            <DialogFooter className="mt-4">
              <Button onClick={handleClose}>Fechar</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
