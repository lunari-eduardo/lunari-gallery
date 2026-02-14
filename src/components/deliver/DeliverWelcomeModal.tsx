import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface DeliverWelcomeModalProps {
  open: boolean;
  onClose: () => void;
  message: string;
  sessionName?: string;
  clientName?: string;
  studioName?: string;
}

export function DeliverWelcomeModal({ open, onClose, message, sessionName, clientName, studioName }: DeliverWelcomeModalProps) {
  // Replace placeholders
  const formatted = message
    .replace(/\{cliente\}/gi, clientName || 'Cliente')
    .replace(/\{sessao\}/gi, sessionName || 'Sessão')
    .replace(/\{estudio\}/gi, studioName || 'Estúdio');

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-md">
        <div className="text-center space-y-6 py-4">
          <p className="text-white/80 text-base leading-relaxed whitespace-pre-line">
            {formatted}
          </p>
          <Button
            onClick={onClose}
            className="bg-white text-black hover:bg-white/90 px-8"
          >
            Continuar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
