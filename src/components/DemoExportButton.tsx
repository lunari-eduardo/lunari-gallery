import { useState } from 'react';
import { Copy, Download, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface DemoExportButtonProps {
  onExport: () => string | null;
  galleryId: string;
  variant?: 'default' | 'subtle';
}

export function DemoExportButton({ onExport, galleryId, variant = 'default' }: DemoExportButtonProps) {
  const [open, setOpen] = useState(false);

  const handleCopy = () => {
    const json = onExport();
    if (json) {
      navigator.clipboard.writeText(json);
      toast.success('JSON copiado!', {
        description: 'Envie ao fotógrafo para ele ver sua seleção.',
      });
      setOpen(false);
    }
  };

  const handleDownload = () => {
    const json = onExport();
    if (json) {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `selecao-${galleryId}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Arquivo baixado!');
      setOpen(false);
    }
  };

  if (variant === 'subtle') {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" className="text-warning hover:text-warning">
            <Package className="h-4 w-4 mr-2" />
            Exportar seleção (demo)
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Exportar seleção</DialogTitle>
            <DialogDescription>
              Como estamos em modo demo (sem banco), exporte sua seleção e envie ao fotógrafo.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Button onClick={handleCopy}>
              <Copy className="h-4 w-4 mr-2" />
              Copiar JSON
            </Button>
            <Button variant="outline" onClick={handleDownload}>
              <Download className="h-4 w-4 mr-2" />
              Baixar arquivo .json
            </Button>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Envie este JSON ao fotógrafo para que ele veja sua seleção.
          </p>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full border-warning/50 text-warning hover:bg-warning/10">
          <Package className="h-4 w-4 mr-2" />
          Exportar seleção para fotógrafo (demo)
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Exportar seleção</DialogTitle>
          <DialogDescription>
            Como estamos em modo demo (sem banco), exporte sua seleção e envie ao fotógrafo por WhatsApp ou email.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Button onClick={handleCopy}>
            <Copy className="h-4 w-4 mr-2" />
            Copiar JSON
          </Button>
          <Button variant="outline" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" />
            Baixar arquivo .json
          </Button>
        </div>
        <p className="text-xs text-muted-foreground text-center">
          Envie este JSON ao fotógrafo para que ele importe e veja os códigos das fotos.
        </p>
      </DialogContent>
    </Dialog>
  );
}