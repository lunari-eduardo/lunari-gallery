import { useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
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
  /** Recebe o número de dias confirmado. Deve resolver após reabrir e refetch. */
  onReactivate: (days: number) => Promise<void>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Chamado após sucesso da reativação, com o número de dias escolhido. */
  onSuccess?: (days: number) => void;
}

export function ReactivateGalleryDialog({
  galleryName,
  onReactivate,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  onSuccess,
}: ReactivateGalleryDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? (controlledOnOpenChange || (() => {})) : setInternalOpen;

  const [days, setDays] = useState('7');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setDays('7');
        setIsLoading(false);
      }, 200);
    }
  }, [open]);

  const handleReactivate = async () => {
    const parsed = parseInt(days) || 7;
    if (parsed < 1 || parsed > 90) {
      toast.error('O prazo deve ser entre 1 e 90 dias');
      return;
    }

    setIsLoading(true);
    try {
      await onReactivate(parsed);
      // Fecha este modal e dispara modal de sucesso no pai.
      setOpen(false);
      // Pequeno delay para evitar conflito de FocusTrap entre os dois Dialogs.
      setTimeout(() => onSuccess?.(parsed), 150);
    } catch (error) {
      console.error('Error reactivating gallery:', error);
      toast.error('Erro ao reativar galeria');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isControlled && (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <RotateCcw className="h-4 w-4 mr-2" />
            Reativar
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
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
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleReactivate} disabled={isLoading}>
            {isLoading ? 'Reativando...' : 'Reativar Galeria'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
