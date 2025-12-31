import { useState } from 'react';
import { Copy, Download, Upload, Package, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface DemoModeCardProps {
  galleryId: string;
  galleryName: string;
  onExport: () => string | null;
  onImport: (jsonText: string) => { galleryId: string; mode: 'created' | 'updated' } | { error: string };
}

export function DemoModeCard({ galleryId, galleryName, onExport, onImport }: DemoModeCardProps) {
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  const handleCopyJson = () => {
    const json = onExport();
    if (json) {
      navigator.clipboard.writeText(json);
      toast.success('JSON copiado para área de transferência!', {
        description: 'Cole no dispositivo do cliente para importar.',
      });
    } else {
      toast.error('Erro ao gerar JSON');
    }
  };

  const handleDownloadJson = () => {
    const json = onExport();
    if (json) {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `galeria-${galleryId}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Arquivo JSON baixado!');
    } else {
      toast.error('Erro ao gerar JSON');
    }
  };

  const handleImport = () => {
    if (!importText.trim()) {
      toast.error('Cole o JSON antes de importar');
      return;
    }

    setIsImporting(true);
    const result = onImport(importText);
    setIsImporting(false);

    if ('error' in result) {
      toast.error('Erro ao importar', { description: result.error });
    } else {
      toast.success(result.mode === 'created' ? 'Galeria importada!' : 'Galeria atualizada!', {
        description: 'Os dados foram sincronizados com sucesso.',
      });
      setImportOpen(false);
      setImportText('');
    }
  };

  return (
    <div className="lunari-card p-5 space-y-4 border-dashed border-2 border-warning/30 bg-warning/5">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-warning/10">
          <Package className="h-5 w-5 text-warning" />
        </div>
        <div className="flex-1">
          <h3 className="font-medium flex items-center gap-2">
            Modo Demo
            <span className="text-xs px-2 py-0.5 rounded bg-warning/20 text-warning">Sem banco</span>
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Para testar em outro dispositivo, exporte o JSON da galeria e importe no dispositivo do cliente.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={handleCopyJson}>
          <Copy className="h-4 w-4 mr-2" />
          Copiar JSON
        </Button>
        
        <Button variant="outline" size="sm" onClick={handleDownloadJson}>
          <Download className="h-4 w-4 mr-2" />
          Baixar .json
        </Button>

        <Dialog open={importOpen} onOpenChange={setImportOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Upload className="h-4 w-4 mr-2" />
              Importar seleção
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Importar JSON da seleção</DialogTitle>
              <DialogDescription>
                Cole o JSON que o cliente exportou após fazer a seleção.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <Textarea
                placeholder='{"version": 1, "gallery": {...}}'
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                rows={8}
                className="font-mono text-xs"
              />
              
              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>
                  Ao importar, a galeria será atualizada com os dados do JSON, incluindo fotos selecionadas.
                </span>
              </div>
              
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setImportOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleImport} disabled={isImporting}>
                  {isImporting ? 'Importando...' : 'Importar'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <p className="text-xs text-muted-foreground">
        <strong>Fluxo:</strong> Exporte aqui → Envie para cliente via WhatsApp → Cliente importa → 
        Cliente seleciona e exporta → Você importa de volta para ver os códigos.
      </p>
    </div>
  );
}