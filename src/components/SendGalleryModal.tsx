import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Copy, MessageCircle, Mail, Check, Send } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { GlobalSettings, EmailTemplate } from '@/types/gallery';
import { Galeria } from '@/hooks/useSupabaseGalleries';

interface SendGalleryModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  gallery: Galeria;
  settings: GlobalSettings;
  onSendGallery?: () => Promise<void>;
}

export function SendGalleryModal({
  isOpen,
  onOpenChange,
  gallery,
  settings,
  onSendGallery,
}: SendGalleryModalProps) {
  const [isCopied, setIsCopied] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Build the client link
  const clientLink = gallery.publicToken
    ? `${window.location.origin}/g/${gallery.publicToken}`
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

  const handleCopy = async () => {
    await navigator.clipboard.writeText(fullMessage);
    setIsCopied(true);
    toast.success('Mensagem copiada!');
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleWhatsApp = () => {
    const phone = gallery.clienteTelefone?.replace(/\D/g, '');
    const message = encodeURIComponent(fullMessage);
    const url = phone
      ? `https://wa.me/55${phone}?text=${message}`
      : `https://wa.me/?text=${message}`;
    window.open(url, '_blank');
  };

  const handleSendAndShare = async () => {
    if (onSendGallery) {
      setIsSending(true);
      try {
        await onSendGallery();
      } finally {
        setIsSending(false);
      }
    }
  };

  const needsToSend = !gallery.publicToken;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Enviar Galeria para Cliente
          </DialogTitle>
          <DialogDescription>
            {needsToSend 
              ? 'Publique a galeria para gerar o link de compartilhamento'
              : 'Escolha como deseja compartilhar a galeria'}
          </DialogDescription>
        </DialogHeader>

        {needsToSend ? (
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              A galeria ainda não foi publicada. Clique abaixo para publicar e gerar o link.
            </p>
            <Button 
              onClick={handleSendAndShare} 
              disabled={isSending}
              variant="terracotta"
              className="w-full"
            >
              {isSending ? 'Publicando...' : 'Publicar Galeria'}
            </Button>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {/* Message Preview */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Mensagem para o cliente:</label>
              <Textarea
                value={fullMessage}
                readOnly
                className="min-h-[180px] resize-none text-sm bg-muted/50"
              />
            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
              <Button
                onClick={handleCopy}
                variant="outline"
                className="w-full justify-start"
              >
                {isCopied ? (
                  <Check className="h-4 w-4 mr-2 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4 mr-2" />
                )}
                {isCopied ? 'Copiado!' : 'Copiar Link e Mensagem'}
              </Button>

              <Button
                onClick={handleWhatsApp}
                variant="outline"
                className="w-full justify-start"
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                Enviar no WhatsApp
                {!gallery.clienteTelefone && (
                  <span className="ml-auto text-xs text-muted-foreground">
                    (sem número)
                  </span>
                )}
              </Button>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <Button
                        variant="outline"
                        className="w-full justify-start opacity-50 cursor-not-allowed"
                        disabled
                      >
                        <Mail className="h-4 w-4 mr-2" />
                        Enviar por Email
                        <span className="ml-auto text-xs">Em breve</span>
                      </Button>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Funcionalidade em desenvolvimento</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
