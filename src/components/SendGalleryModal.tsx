import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Copy, MessageCircle, Mail, Check, Send, User, Link, Phone, Calendar, Lock } from 'lucide-react';
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

interface SendGalleryModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  gallery: Galeria;
  settings: GlobalSettings;
  onSendGallery?: () => Promise<void>;
}

// Format phone number for display: (51) 99828-7948
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
}: SendGalleryModalProps) {
  const [isCopied, setIsCopied] = useState(false);
  const [isLinkCopied, setIsLinkCopied] = useState(false);

  // Build the client link using production domain
  const clientLink = gallery.publicToken
    ? getGalleryUrl(gallery.publicToken)
    : null;

  // Get the gallery_sent template
  const gallerySentTemplate = useMemo(() => {
    return settings.emailTemplates.find((t) => t.type === 'gallery_sent');
  }, [settings.emailTemplates]);

  // Build the message with template variables
  const fullMessage = useMemo(() => {
    if (!gallerySentTemplate || !clientLink) {
      // Default message if no template
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

    // Replace template variables
    let message = gallerySentTemplate.body
      .replace(/{cliente}/g, gallery.clienteNome || 'Cliente')
      .replace(/{galeria}/g, gallery.nomeSessao || 'Galeria')
      .replace(/{link}/g, clientLink)
      .replace(/{estudio}/g, settings.studioName || 'Estúdio')
      .replace(/{prazo}/g, gallery.prazoSelecao 
        ? format(gallery.prazoSelecao, "dd/MM/yyyy", { locale: ptBR })
        : 'Sem prazo definido'
      );

    // Add password if gallery is private
    if (gallery.permissao === 'private' && gallery.galleryPassword) {
      message += `\n\n🔐 Senha: ${gallery.galleryPassword}`;
    }

    return message;
  }, [gallerySentTemplate, clientLink, gallery, settings.studioName]);

  const handleCopyMessage = async () => {
    await navigator.clipboard.writeText(fullMessage);
    setIsCopied(true);
    toast.success('Mensagem copiada!');
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleCopyLink = async () => {
    if (clientLink) {
      await navigator.clipboard.writeText(clientLink);
      setIsLinkCopied(true);
      toast.success('Link copiado!');
      setTimeout(() => setIsLinkCopied(false), 2000);
    }
  };

  const handleWhatsApp = () => {
    const phone = gallery.clienteTelefone?.replace(/\D/g, '');
    const message = encodeURIComponent(fullMessage);
    const url = phone
      ? `https://wa.me/55${phone}?text=${message}`
      : `https://wa.me/?text=${message}`;
    window.open(url, '_blank');
  };

  const formattedPhone = formatPhoneDisplay(gallery.clienteTelefone);

  // If gallery is not published yet, show a simple message
  if (!clientLink) {
    return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
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
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-4">
          <DialogTitle className="flex items-center gap-3 text-xl">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Send className="h-5 w-5 text-primary" />
            </div>
            Compartilhar Galeria
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Client Info Card */}
          <div className="rounded-xl border border-border bg-muted/30 p-5">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <User className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <div>
                  <h3 className="font-semibold text-lg truncate">
                    {gallery.clienteNome || 'Cliente'}
                  </h3>
                  <p className="text-sm text-muted-foreground truncate">
                    {gallery.nomeSessao || 'Sessão de Fotos'}
                  </p>
                </div>
                
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                  {formattedPhone && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-4 w-4" />
                      <span>{formattedPhone}</span>
                    </div>
                  )}
                  {gallery.prazoSelecao && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>Até {format(gallery.prazoSelecao, "dd 'de' MMM", { locale: ptBR })}</span>
                    </div>
                  )}
                  {gallery.permissao === 'private' && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Lock className="h-4 w-4" />
                      <span>Protegida por senha</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Link Section */}
          <div className="space-y-3">
            <label className="text-sm font-medium flex items-center gap-2">
              <Link className="h-4 w-4" />
              Link da Galeria
            </label>
            <div className="flex gap-2">
              <div className="flex-1 rounded-lg border border-border bg-background px-4 py-3 text-sm font-mono truncate">
                {clientLink}
              </div>
              <Button
                onClick={handleCopyLink}
                variant="outline"
                size="icon"
                className="h-12 w-12 flex-shrink-0"
              >
                {isLinkCopied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <Separator />

          {/* Message Preview */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Mensagem para o cliente</label>
            <div className="rounded-lg border border-border bg-muted/30 p-4 max-h-[200px] overflow-y-auto">
              <p className="text-sm whitespace-pre-line leading-relaxed">
                {fullMessage}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid gap-3 pt-2">
            <Button
              onClick={handleCopyMessage}
              variant="outline"
              size="lg"
              className="w-full justify-center gap-2 h-12"
            >
              {isCopied ? (
                <Check className="h-5 w-5 text-green-500" />
              ) : (
                <Copy className="h-5 w-5" />
              )}
              {isCopied ? 'Mensagem Copiada!' : 'Copiar Mensagem Completa'}
            </Button>

            <Button
              onClick={handleWhatsApp}
              variant="terracotta"
              size="lg"
              className="w-full justify-center gap-2 h-12"
            >
              <MessageCircle className="h-5 w-5" />
              <span>Enviar no WhatsApp</span>
              {formattedPhone && (
                <span className="text-sm opacity-80">→ {formattedPhone}</span>
              )}
            </Button>

            <Button
              variant="outline"
              size="lg"
              className="w-full justify-center gap-2 h-12 opacity-50 cursor-not-allowed"
              disabled
            >
              <Mail className="h-5 w-5" />
              Enviar por Email
              <span className="text-xs bg-muted px-2 py-0.5 rounded">Em breve</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
