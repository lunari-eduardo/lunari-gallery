import { useState } from 'react';
import { Download, PartyPopper, AlertTriangle, Loader2, Image, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { GalleryPhoto } from '@/types/gallery';
import { downloadAllPhotos, downloadPhoto, DownloadablePhoto } from '@/lib/downloadUtils';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface DownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  photos: GalleryPhoto[];
  sessionName: string;
  galleryId: string; // Required for signed URL generation
  onViewIndividual?: () => void; // Optional - not available on finalized galleries
}

export function DownloadModal({
  isOpen,
  onClose,
  photos,
  sessionName,
  galleryId,
  onViewIndividual,
}: DownloadModalProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState({ current: 0, total: 0 });

  const handleDownloadAll = async () => {
    if (photos.length === 0) return;

    setIsDownloading(true);
    setDownloadProgress({ current: 0, total: photos.length });

    try {
      const downloadablePhotos: DownloadablePhoto[] = photos
        .filter(p => p.originalPath)
        .map(p => ({
          storageKey: p.originalPath!,
          filename: p.originalFilename || p.filename,
        }));

      if (downloadablePhotos.length === 0) {
        toast.error('Nenhuma foto disponível para download');
        return;
      }

      const sanitizedSessionName = sessionName
        .replace(/[^a-zA-Z0-9\s-]/g, '')
        .replace(/\s+/g, '_')
        .slice(0, 50);

      await downloadAllPhotos(
        galleryId,
        downloadablePhotos,
        `${sanitizedSessionName}_fotos`,
        (current, total) => setDownloadProgress({ current, total })
      );

      toast.success('Download concluído!', {
        description: `${downloadablePhotos.length} fotos salvas com sucesso.`,
      });
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Erro no download', {
        description: 'Tente novamente ou baixe as fotos individualmente.',
      });
    } finally {
      setIsDownloading(false);
      setDownloadProgress({ current: 0, total: 0 });
    }
  };

  const progressPercent = downloadProgress.total > 0
    ? Math.round((downloadProgress.current / downloadProgress.total) * 100)
    : 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-center gap-2 text-center">
            <PartyPopper className="h-6 w-6 text-primary" />
            <span>Suas fotos estão prontas!</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Warning */}
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <div className="flex gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                  Importante
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Este é o momento para baixar suas fotos em alta resolução sem marca d'água. 
                  Guarde-as com carinho!
                </p>
              </div>
            </div>
          </div>

          {/* Photo count */}
          <div className="flex items-center justify-center gap-2 py-2">
            <Image className="h-5 w-5 text-muted-foreground" />
            <span className="text-lg font-medium">
              {photos.length} {photos.length === 1 ? 'foto selecionada' : 'fotos selecionadas'}
            </span>
          </div>

          {/* Download progress */}
          {isDownloading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Preparando download...</span>
                <span>{downloadProgress.current} / {downloadProgress.total}</span>
              </div>
              <Progress value={progressPercent} className="h-2" />
            </div>
          )}

          {/* Download All button */}
          <Button
            onClick={handleDownloadAll}
            disabled={isDownloading || photos.length === 0}
            className="w-full h-14 text-base gap-3"
            size="lg"
          >
            {isDownloading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Baixando... {progressPercent}%
              </>
            ) : (
              <>
                <Download className="h-5 w-5" />
                Baixar Todas ({photos.length} fotos)
              </>
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            As fotos serão baixadas em um arquivo ZIP
          </p>

          {/* Divider - only show if individual view is available */}
          {onViewIndividual && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">ou</span>
                </div>
              </div>

              {/* View individually */}
              <Button
                variant="outline"
                onClick={() => {
                  onClose();
                  onViewIndividual();
                }}
                className="w-full gap-2"
                disabled={isDownloading}
              >
                Ver fotos e baixar individualmente
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
