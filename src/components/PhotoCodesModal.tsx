import { useState } from 'react';
import { Copy, Check, FolderOpen } from 'lucide-react';
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
import { GalleryFolderRow } from '@/hooks/useGalleryFolders';

type CodeFormat = 'windows' | 'mac' | 'lightroom' | 'txt';

function removeExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  return lastDot > 0 ? filename.slice(0, lastDot) : filename;
}

interface PhotoCodesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  photos: GalleryPhoto[];
  clientName: string;
  filter?: 'all' | 'favorites';
  folders?: GalleryFolderRow[];
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
  filter = 'all',
  folders = [],
}: PhotoCodesModalProps) {
  const [format, setFormat] = useState<CodeFormat>('windows');
  const [copied, setCopied] = useState<string | null>(null);

  const selectedPhotos = photos.filter(p => {
    if (!p.isSelected) return false;
    if (filter === 'favorites') return p.isFavorite;
    return true;
  });

  const hasFolders = folders.length > 0;

  // Group photos by folder
  const photosByFolder = hasFolders
    ? folders.map(folder => ({
        folder,
        photos: selectedPhotos.filter(p => p.folderId === folder.id),
      })).filter(g => g.photos.length > 0)
    : [];

  const showFolderSections = hasFolders && photosByFolder.length > 1;
  
  const generateCodeForPhotos = (photoList: GalleryPhoto[]): string => {
    if (photoList.length === 0) return 'Nenhuma foto selecionada';
    
    const filenames = photoList.map(p => removeExtension(p.originalFilename || p.filename));
    
    switch (format) {
      case 'windows':
        return filenames.map(f => `"${f}"`).join(' OR ');
      case 'mac':
        return filenames.join(' OR ');
      case 'lightroom':
        return filenames.join(', ');
      case 'txt':
        return filenames.join('\n');
      default:
        return '';
    }
  };

  const generateAllCode = (): string => {
    if (!hasFolders) return generateCodeForPhotos(selectedPhotos);
    
    return photosByFolder.map(g => generateCodeForPhotos(g.photos)).join('\n\n');
  };

  const handleCopy = (code: string, label: string) => {
    navigator.clipboard.writeText(code);
    setCopied(label);
    toast.success('Código copiado!');
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-semibold">
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

          {/* Per-folder codes */}
          {showFolderSections && (
            <div className="space-y-4">
              {photosByFolder.map(({ folder, photos: folderPhotos }) => {
                const code = generateCodeForPhotos(folderPhotos);
                const copyLabel = `folder-${folder.id}`;
                return (
                  <div key={folder.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-1.5 text-sm font-medium">
                        <FolderOpen className="h-3.5 w-3.5" />
                        {folder.nome}
                        <span className="text-muted-foreground font-normal">
                          ({folderPhotos.length} foto{folderPhotos.length !== 1 ? 's' : ''})
                        </span>
                      </Label>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => handleCopy(code, copyLabel)}
                      >
                        {copied === copyLabel ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        {copied === copyLabel ? 'Copiado' : 'Copiar'}
                      </Button>
                    </div>
                    <Textarea
                      readOnly
                      value={code}
                      className="font-mono text-xs min-h-[60px] resize-none bg-muted/50"
                    />
                  </div>
                );
              })}
            </div>
          )}

          {/* All together (or single block if no folders) */}
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs">
              {showFolderSections ? 'Todos juntos — ' : ''}
              {selectedPhotos.length} foto{selectedPhotos.length !== 1 ? 's' : ''} selecionada{selectedPhotos.length !== 1 ? 's' : ''}
            </Label>
            <Textarea
              readOnly
              value={showFolderSections ? generateAllCode() : generateCodeForPhotos(selectedPhotos)}
              className="font-mono text-sm min-h-[120px] resize-none bg-muted/50"
            />
          </div>

          <Button 
            onClick={() => handleCopy(showFolderSections ? generateAllCode() : generateCodeForPhotos(selectedPhotos), 'all')}
            variant="terracotta"
            className="w-full"
            disabled={selectedPhotos.length === 0}
          >
            {copied === 'all' ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                Copiado!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-2" />
                {showFolderSections ? 'Copiar Todos os Códigos' : 'Copiar Código'}
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
