import { useState } from 'react';
import { Check, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/Logo';
import { MasonryGrid, MasonryItem } from '@/components/MasonryGrid';
import { Lightbox } from '@/components/Lightbox';
import { getOriginalPhotoUrl } from '@/lib/cloudinaryUrl';
import { downloadAllPhotos } from '@/lib/downloadUtils';
import { cn } from '@/lib/utils';
import { TitleCaseMode, GalleryPhoto } from '@/types/gallery';
import { applyTitleCase } from '@/lib/textTransform';
import { toast } from 'sonner';

interface FinalizedPhoto {
  id: string;
  storage_key?: string;
  storageKey?: string;
  original_filename?: string;
  originalFilename?: string;
  filename: string;
}

interface FinalizedPreviewScreenProps {
  photos: FinalizedPhoto[];
  sessionName?: string;
  sessionFont?: string;
  titleCaseMode?: TitleCaseMode;
  studioLogoUrl?: string;
  studioName?: string;
  allowDownload: boolean;
  themeStyles?: React.CSSProperties;
  backgroundMode?: 'light' | 'dark';
}

export function FinalizedPreviewScreen({
  photos,
  sessionName,
  sessionFont,
  titleCaseMode = 'normal',
  studioLogoUrl,
  studioName,
  allowDownload,
  themeStyles,
  backgroundMode = 'light',
}: FinalizedPreviewScreenProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState({ current: 0, total: 0 });

  // Transform photos for display - normalize field names
  const transformedPhotos: GalleryPhoto[] = photos.map((p) => {
    const storageKey = p.storageKey || p.storage_key || '';
    const originalFilename = p.originalFilename || p.original_filename || p.filename;
    const photoUrl = getOriginalPhotoUrl(storageKey);
    
    return {
      id: p.id,
      filename: p.filename,
      originalFilename,
      storageKey,
      // Use original URL (no watermark) for all views
      thumbnailUrl: photoUrl,
      previewUrl: photoUrl,
      originalUrl: photoUrl,
      isSelected: true,
      isFavorite: false,
      comment: '',
      order: 0,
      width: 800,  // Default dimensions (not needed for display)
      height: 600,
    };
  });

  const handleDownloadAll = async () => {
    if (isDownloading || transformedPhotos.length === 0) return;
    
    setIsDownloading(true);
    setDownloadProgress({ current: 0, total: transformedPhotos.length });
    
    try {
      await downloadAllPhotos(
        transformedPhotos.map(p => ({
          storageKey: p.storageKey || '',
          filename: p.originalFilename || p.filename,
        })),
        sessionName || 'fotos-selecionadas',
        (current, total) => setDownloadProgress({ current, total })
      );
      toast.success('Download concluído!');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Erro no download. Tente novamente.');
    } finally {
      setIsDownloading(false);
      setDownloadProgress({ current: 0, total: 0 });
    }
  };

  const progressPercent = downloadProgress.total > 0 
    ? Math.round((downloadProgress.current / downloadProgress.total) * 100) 
    : 0;

  return (
    <div 
      className={cn("min-h-screen bg-background text-foreground", backgroundMode === 'dark' && 'dark')} 
      style={themeStyles}
    >
      {/* Header com logo */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border/50">
        <div className="flex items-center justify-center px-4 py-4">
          {studioLogoUrl ? (
            <img 
              src={studioLogoUrl} 
              alt={studioName || 'Logo do estúdio'} 
              className="h-12 sm:h-14 md:h-16 max-w-[200px] sm:max-w-[280px] object-contain" 
            />
          ) : (
            <Logo size="sm" variant="gallery" />
          )}
        </div>
      </header>

      {/* Banner informativo */}
      <div className="bg-primary/10 border-b border-primary/20 p-4 md:p-6 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
            <Check className="h-4 w-4 text-primary" />
          </div>
          <h2 className="font-display text-lg font-medium text-foreground">
            Seleção Confirmada
          </h2>
        </div>
        
        <p className="text-sm text-muted-foreground mb-4">
          {photos.length} {photos.length === 1 ? 'foto selecionada' : 'fotos selecionadas'}
        </p>
        
        {/* Nome da sessão */}
        {sessionName && (
          <p 
            className="text-base sm:text-lg font-normal text-muted-foreground mb-4"
            style={{ fontFamily: sessionFont || '"Playfair Display", serif' }}
          >
            {applyTitleCase(sessionName, titleCaseMode)}
          </p>
        )}
        
        {/* Botão de download - apenas se permitido */}
        {allowDownload && photos.length > 0 && (
          <Button 
            onClick={handleDownloadAll} 
            disabled={isDownloading}
            size="lg"
            className="gap-2"
          >
            {isDownloading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Baixando... {progressPercent}%
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Baixar Todas (ZIP)
              </>
            )}
          </Button>
        )}
      </div>

      {/* Grid de fotos */}
      <main className="p-4 md:p-6">
        {transformedPhotos.length > 0 ? (
          <MasonryGrid>
            {transformedPhotos.map((photo, index) => (
              <MasonryItem key={photo.id}>
                <div 
                  className="cursor-pointer rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow group"
                  onClick={() => setLightboxIndex(index)}
                >
                  <div className="relative">
                    <img 
                      src={photo.thumbnailUrl} 
                      alt={photo.filename}
                      className="w-full h-auto object-cover transition-transform duration-300 group-hover:scale-105" 
                      loading="lazy"
                    />
                    {/* Overlay com ícone de selecionada */}
                    <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                      <Check className="h-3.5 w-3.5 text-primary-foreground" />
                    </div>
                  </div>
                </div>
              </MasonryItem>
            ))}
          </MasonryGrid>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Nenhuma foto selecionada encontrada.</p>
          </div>
        )}
      </main>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <Lightbox
          photos={transformedPhotos}
          currentIndex={lightboxIndex}
          allowComments={false}
          allowDownload={allowDownload}
          disabled={true}
          isConfirmedMode={true}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
          onSelect={() => {}} // No-op - selection disabled
        />
      )}
    </div>
  );
}
