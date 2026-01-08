import { useState } from 'react';
import { Copy, Check, RotateCcw } from 'lucide-react';
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
import { toast } from 'sonner';

interface ReactivateGalleryDialogProps {
  galleryName: string;
  clientLink: string | null;
  onReactivate: (days: number) => Promise<void>;
}

export function ReactivateGalleryDialog({
  galleryName,
  clientLink,
  onReactivate,
}: ReactivateGalleryDialogProps) {
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState(7);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleReactivate = async () => {
    if (days < 1 || days > 90) {
      toast.error('O prazo deve ser entre 1 e 90 dias');
      return;
    }

    setIsLoading(true);
    try {
      await onReactivate(days);
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
      toast.success('Link copiado!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    setOpen(false);
    // Reset state after dialog closes
    setTimeout(() => {
      setShowSuccess(false);
      setDays(7);
      setCopied(false);
    }, 200);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) handleClose();
      else setOpen(true);
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <RotateCcw className="h-4 w-4 mr-2" />
          Reativar
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
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
                  onChange={(e) => setDays(parseInt(e.target.value) || 7)}
                  placeholder="7"
                />
                <p className="text-xs text-muted-foreground">
                  O cliente terá {days} dia{days !== 1 ? 's' : ''} para concluir a seleção.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button onClick={handleReactivate} disabled={isLoading}>
                {isLoading ? 'Reativando...' : 'Reativar Galeria'}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Check className="h-5 w-5 text-green-500" />
                Galeria Reativada!
              </DialogTitle>
              <DialogDescription>
                A seleção foi reaberta com prazo de {days} dias. Envie o link abaixo para o cliente.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {clientLink ? (
                <div className="space-y-2">
                  <Label>Link da galeria</Label>
                  <div className="flex gap-2">
                    <Input
                      value={clientLink}
                      readOnly
                      className="flex-1 bg-muted"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleCopyLink}
                    >
                      {copied ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  O link estará disponível após publicar a galeria.
                </p>
              )}
            </div>
            <DialogFooter>
              <Button onClick={handleClose}>
                Fechar
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
