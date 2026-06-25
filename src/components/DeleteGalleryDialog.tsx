import { useState } from 'react';
import { Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

interface DeleteGalleryDialogProps {
  galleryName: string;
  onDelete: () => Promise<any>;
  trigger?: React.ReactNode;
}

export function DeleteGalleryDialog({ galleryName, onDelete, trigger }: DeleteGalleryDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const result: any = await onDelete();
      setIsOpen(false);
      if (result?.r2Failed && result.r2Failed > 0) {
        toast.warning(`Galeria arquivada. ${result.r2Failed} arquivo(s) ficaram pendentes de remoção no storage e entrarão em fila de retry.`);
      } else {
        toast.success('Galeria arquivada com sucesso.');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao arquivar galeria');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger asChild>
        {trigger || (
          <Button variant="destructive" size="sm">
            <Trash2 className="h-4 w-4 mr-2" />
            Excluir Galeria
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir galeria?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm">
              <p>
                Tem certeza que deseja excluir <strong>"{galleryName}"</strong>?
              </p>
              <p className="text-destructive font-medium">
                Esta ação é irreversível. Todas as fotos serão removidas permanentemente do armazenamento.
              </p>
              <p className="text-muted-foreground">
                O histórico financeiro (pagamentos e cobranças) será preservado para sua contabilidade,
                mas a galeria deixará de aparecer no painel.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleDelete();
            }}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Excluindo...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
