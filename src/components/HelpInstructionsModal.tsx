import { Maximize2, MousePointer, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface HelpInstructionsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactEmail?: string | null;
  studioName?: string | null;
}

export function HelpInstructionsModal({
  open,
  onOpenChange,
  contactEmail,
  studioName,
}: HelpInstructionsModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-primary uppercase tracking-wide">
            Instruções de Uso
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Maximize2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h4 className="font-semibold mb-1">Ampliando fotos</h4>
              <p className="text-sm text-muted-foreground">
                Para ver uma foto em tamanho maior, clique sobre a miniatura da mesma.
              </p>
            </div>
          </div>
          
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <MousePointer className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h4 className="font-semibold mb-1">Selecionando fotos</h4>
              <p className="text-sm text-muted-foreground">
                Marque as fotos que mais gostou clicando no ícone de seleção no canto da foto.
              </p>
            </div>
          </div>
          
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h4 className="font-semibold mb-1">Finalizando a seleção</h4>
              <p className="text-sm text-muted-foreground">
                Após selecionar todas as fotos desejadas, clique no botão{' '}
                <strong className="text-primary">"Confirmar"</strong> localizado na parte inferior da tela.
              </p>
            </div>
          </div>
        </div>
        
        <Button 
          onClick={() => onOpenChange(false)}
          className="w-full"
          variant="terracotta"
        >
          OK, ENTENDI
        </Button>
        
        {contactEmail && (
          <p className="text-xs text-center text-muted-foreground pt-2">
            Caso tenha alguma dúvida, entre em contato pelo e-mail
            <br />
            <a href={`mailto:${contactEmail}`} className="text-primary hover:underline">
              {contactEmail}
            </a>
          </p>
        )}
        
        {!contactEmail && studioName && (
          <p className="text-xs text-center text-muted-foreground pt-2">
            Caso tenha alguma dúvida, entre em contato com {studioName}.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
