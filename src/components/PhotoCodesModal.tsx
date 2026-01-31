import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { GalleryPhoto } from '@/types/gallery';

type CodeFormat = 'windows' | 'mac' | 'lightroom' | 'txt';

interface PhotoCodesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  photos: GalleryPhoto[];
  clientName: string;
  filter?: 'all' | 'favorites';
}

const formatLabels: Record<CodeFormat, string> = {
  windows: 'Código para Windows (Explorer)',
  mac: 'Código para Finder (Mac)',
  lightroom: 'Código para Lightroom',
  txt: 'Lista simples (TXT)',
};

export function PhotoCodesModal({ 
  open, 
  onOpenChange, 
  photos,
  clientName,
  filter = 'all'
}: PhotoCodesModalProps) {
  const [format, setFormat] = useState<CodeFormat>('windows');
  const [copied, setCopied] = useState(false);

  const selectedPhotos = photos.filter(p => {
    if (!p.isSelected) return false;
    if (filter === 'favorites') return p.isFavorite;
    return true;
  });
  
  const generateCode = (): string => {
    if (selectedPhotos.length === 0) return 'Nenhuma foto selecionada';
    
    // Usar nome original para exportação (essencial para fotógrafos)
    const filenames = selectedPhotos.map(p => p.originalFilename || p.filename);
    
    switch (format) {
      case 'windows':
        // Windows Explorer search: "filename1" OR "filename2"
        return filenames.map(f => `"${f.replace('.jpg', '').replace('.jpeg', '').replace('.png', '')}"`).join(' OR ');
      
      case 'mac':
        // Mac Finder: filename1.jpg OR filename2.jpg
        return filenames.join(' OR ');
      
      case 'lightroom':
        // Lightroom filter: filename1.jpg, filename2.jpg
        return filenames.join(', ');
      
      case 'txt':
        // Simple list: one per line
        return filenames.join('\n');
      
      default:
        return '';
    }
  };

  const handleCopy = () => {
    const code = generateCode();
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success('Código copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">
            Códigos para separação das fotos
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 space-y-2">
              <Label>Exibir códigos</Label>
              <Select value={format} onValueChange={(v) => setFormat(v as CodeFormat)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="windows">{formatLabels.windows}</SelectItem>
                  <SelectItem value="mac">{formatLabels.mac}</SelectItem>
                  <SelectItem value="lightroom">{formatLabels.lightroom}</SelectItem>
                  <SelectItem value="txt">{formatLabels.txt}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label className="text-muted-foreground">Cliente</Label>
              <p className="font-medium text-sm pt-2">{clientName}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs">
              {selectedPhotos.length} foto{selectedPhotos.length !== 1 ? 's' : ''} selecionada{selectedPhotos.length !== 1 ? 's' : ''}
            </Label>
            <Textarea
              readOnly
              value={generateCode()}
              className="font-mono text-sm min-h-[120px] resize-none bg-muted/50"
            />
          </div>

          <Button 
            onClick={handleCopy}
            variant="terracotta"
            className="w-full"
            disabled={selectedPhotos.length === 0}
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                Copiado!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-2" />
                Copiar Código
              </>
            )}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            Cole o código na barra de pesquisa do {format === 'windows' ? 'Windows Explorer' : format === 'mac' ? 'Finder' : format === 'lightroom' ? 'Lightroom' : 'arquivo'} para filtrar as fotos selecionadas.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
