import { useState, useMemo, useRef, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Copy, MessageCircle, Mail, Check, Send, Link, Phone, Calendar, Lock, Loader2 } from 'lucide-react';
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
import { getGalleryUrl } from '@/lib/galleryUrl';
import { supabase } from '@/integrations/supabase/client';

interface SendGalleryModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  gallery: Galeria;
  settings: GlobalSettings;
  onSendGallery?: () => Promise<void>;
}

function formatPhoneDisplay(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

export function SendGalleryModal({
  isOpen,
  onOpenChange,
  gallery,
  settings,
  onSendGallery,
}: SendGalleryModalProps) {
  const [isCopied, setIsCopied] = useState(false);
  const [isLinkCopied, setIsLinkCopied] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [prepareError, setPrepareError] = useState<string | null>(null);
  const [resolvedToken, setResolvedToken] = useState<string | null>(gallery.publicToken);
  const hasSentRef = useRef(false);

  // When modal opens, always call RPC to ensure gallery is ready for sharing
  useEffect(() => {
    if (!isOpen) {
      hasSentRef.current = false;
      setPrepareError(null);
      setResolvedToken(null);
      return;
    }

    const prepareShare = async () => {
      setIsPreparing(true);
      setPrepareError(null);
      try {
        const { data, error } = await supabase.rpc('prepare_gallery_share', {
          p_gallery_id: gallery.id,
        });

        if (error) throw error;

        const result = data as { token?: string; status?: string; ready?: boolean; error?: string };

        if (!result?.ready) {
          throw new Error(result?.error || 'Erro ao preparar galeria');
        }

        setResolvedToken(result.token!);
      } catch (e: any) {
        console.error('Error preparing gallery share:', e);
        setPrepareError(e.message || 'Erro ao publicar galeria');
      } finally {
        setIsPreparing(false);
      }
    };

    prepareShare();
  }, [isOpen, gallery.id]);

  const clientLink = resolvedToken
    ? getGalleryUrl(resolvedToken)
    : null;

  const gallerySentTemplate = useMemo(() => {
    return settings.emailTemplates.find((t) => t.type === 'gallery_sent');
  }, [settings.emailTemplates]);

  const fullMessage = useMemo(() => {
    if (!gallerySentTemplate || !clientLink) {
      let msg = `Olá${gallery.clienteNome ? ` ${gallery.clienteNome}` : ''}! 🎉\n\nSua galeria de fotos está pronta!\n\n📸 ${gallery.nomeSessao || 'Sessão de Fotos'}\n\n🔗 Link: ${clientLink || '[link]'}`;
      if (gallery.permissao === 'private' && gallery.galleryPassword) {
        msg += `\n\n🔐 Senha: ${gallery.galleryPassword}`;
      }
      if (gallery.prazoSelecao) {
        msg += `\n\n📅 Prazo: ${format(gallery.prazoSelecao, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`;
      }
      msg += `\n\nSelecione suas fotos favoritas com calma! ❤️`;
      return msg;
    }

    let message = gallerySentTemplate.body
      .replace(/{cliente}/g, gallery.clienteNome || 'Cliente')
      .replace(/{galeria}/g, gallery.nomeSessao || 'Galeria')
      .replace(/{link}/g, clientLink)
      .replace(/{estudio}/g, settings.studioName || 'Estúdio')
      .replace(/{prazo}/g, gallery.prazoSelecao
        ? format(gallery.prazoSelecao, "dd/MM/yyyy", { locale: ptBR })
        : 'Sem prazo definido'
      );

    if (gallery.permissao === 'private' && gallery.galleryPassword) {
      message += `\n\n🔐 Senha: ${gallery.galleryPassword}`;
    }

    return message;
  }, [gallerySentTemplate, clientLink, gallery, settings.studioName]);

  // Mark gallery as sent (only once per modal open)
  // prepare_gallery_share RPC already set status to 'enviado', so onSendGallery
  // is only needed if caller wants additional side effects (e.g. toast).
  // We no longer call sendGalleryMutation here to avoid token overwrites.
  const markAsSent = async () => {
    if (hasSentRef.current) return;
    hasSentRef.current = true;
    
    // Only call onSendGallery for side effects if gallery wasn't already sent
    // The RPC already handled status + token atomically
    if (onSendGallery && gallery.status !== 'enviado') {
      try {
        await onSendGallery();
      } catch (e) {
        console.error('Error in onSendGallery callback:', e);
        // Don't reset hasSentRef - the RPC already did the real work
      }
    }
  };

  const handleCopyMessage = async () => {
    await navigator.clipboard.writeText(fullMessage);
    setIsCopied(true);
    toast.success('Mensagem copiada!');
    setTimeout(() => setIsCopied(false), 2000);
    await markAsSent();
  };

  const handleCopyLink = async () => {
    if (clientLink) {
      await navigator.clipboard.writeText(clientLink);
      setIsLinkCopied(true);
      toast.success('Link copiado!');
      setTimeout(() => setIsLinkCopied(false), 2000);
      await markAsSent();
    }
  };

  const handleWhatsApp = async () => {
    const phone = gallery.clienteTelefone?.replace(/\D/g, '');
    const message = encodeURIComponent(fullMessage);
    const url = phone
      ? `https://wa.me/55${phone}?text=${message}`
      : `https://wa.me/?text=${message}`;
    window.open(url, '_blank');
    await markAsSent();
  };

  const formattedPhone = formatPhoneDisplay(gallery.clienteTelefone);

  const handleOpenChange = (open: boolean) => {
    onOpenChange(open);
  };

  // Show loading state while preparing gallery
  if (isPreparing) {
    return (
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="pb-4">
            <DialogTitle className="flex items-center gap-3 text-xl">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Loader2 className="h-5 w-5 text-primary animate-spin" />
              </div>
              Publicando galeria...
            </DialogTitle>
          </DialogHeader>
          <div className="text-center py-6">
            <p className="text-muted-foreground">
              Gerando link de compartilhamento e preparando a galeria para o cliente.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Show error state
  if (prepareError) {
    return (
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="pb-4">
            <DialogTitle className="flex items-center gap-3 text-xl">
              <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <Link className="h-5 w-5 text-destructive" />
              </div>
              Erro ao publicar
            </DialogTitle>
          </DialogHeader>
          <div className="text-center py-6 space-y-4">
            <p className="text-muted-foreground">{prepareError}</p>
            <Button variant="outline" onClick={async () => {
              setPrepareError(null);
              setIsPreparing(true);
              try {
                const { data, error } = await supabase.rpc('prepare_gallery_share', { p_gallery_id: gallery.id });
                if (error) throw error;
                const result = data as { token?: string; ready?: boolean; error?: string };
                if (!result?.ready) throw new Error(result?.error || 'Erro');
                setResolvedToken(result.token!);
              } catch (e: any) {
                setPrepareError(e.message);
              } finally {
                setIsPreparing(false);
              }
            }}>
              Tentar novamente
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!clientLink) {
    return (
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="pb-4">
            <DialogTitle className="flex items-center gap-3 text-xl">
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                <Link className="h-5 w-5 text-muted-foreground" />
              </div>
              Aguardando Publicação
            </DialogTitle>
          </DialogHeader>
          <div className="text-center py-6">
            <p className="text-muted-foreground">
              Esta galeria ainda não foi publicada. Finalize a criação da galeria para gerar o link de compartilhamento.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-4">
          <DialogTitle className="flex items-center gap-3 text-lg">
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
              <Send className="h-4 w-4 text-primary" />
            </div>
            Compartilhar Galeria
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
              {gallery.prazoSelecao && (
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  Até {format(gallery.prazoSelecao, "dd 'de' MMM", { locale: ptBR })}
                </span>
              )}
              {gallery.permissao === 'private' && (
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
              className="gap-2 flex-shrink-0"
            >
              {isLinkCopied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Link className="h-4 w-4" />
              )}
              {isLinkCopied ? 'Copiado!' : 'Copiar Link'}
            </Button>
          </div>

          <Separator />

          {/* Message */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Mensagem para o cliente</label>
            <div className="rounded-lg border border-border bg-muted/30 p-4 max-h-[250px] overflow-y-auto">
              <p className="text-sm whitespace-pre-line leading-relaxed">
                {fullMessage}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button
                onClick={handleCopyMessage}
                variant="outline"
                className="justify-center gap-2 h-11"
              >
                {isCopied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {isCopied ? 'Copiada!' : 'Copiar Mensagem'}
              </Button>

              <Button
                onClick={handleWhatsApp}
                variant="terracotta"
                className="justify-center gap-2 h-11"
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp
                {formattedPhone && (
                  <span className="text-xs opacity-80">→ {formattedPhone}</span>
                )}
              </Button>
            </div>

            <Button
              variant="outline"
              className="w-full justify-center gap-2 h-10 text-sm opacity-50 cursor-not-allowed"
              disabled
            >
              <Mail className="h-4 w-4" />
              Enviar por Email
              <span className="text-xs bg-muted px-2 py-0.5 rounded">Em breve</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
