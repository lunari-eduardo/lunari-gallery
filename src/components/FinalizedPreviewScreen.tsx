import { useState } from 'react';
import { Check, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/Logo';
import { MasonryGrid, MasonryItem } from '@/components/MasonryGrid';
import { Lightbox } from '@/components/Lightbox';
import { downloadAllPhotos, DownloadablePhoto } from '@/lib/downloadUtils';
import { cn } from '@/lib/utils';
import { TitleCaseMode, GalleryPhoto } from '@/types/gallery';
import { applyTitleCase } from '@/lib/textTransform';
import { toast } from 'sonner';

interface FinalizedPhoto {
  id: string;
  storage_key?: string;
  storageKey?: string;
  original_path?: string | null; // B2 path for original file (for download)
  originalPath?: string | null;
  original_filename?: string;
  originalFilename?: string;
  filename: string;
}

interface FinalizedPreviewScreenProps {
  photos: FinalizedPhoto[];
  galleryId: string; // Required for signed URL generation
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
  galleryId,
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
  // ARCHITECTURE: R2 (storage_key) = display, B2 (original_path) = download
  const R2_PUBLIC_URL = 'https://media.lunarihub.com';
  
  const transformedPhotos: (GalleryPhoto & { originalPath?: string | null })[] = photos.map((p) => {
    const storageKey = p.storageKey || p.storage_key || '';
    const originalFilename = p.originalFilename || p.original_filename || p.filename;
    const originalPath = p.originalPath || p.original_path || null;
    
    // ALWAYS use R2 for display (never B2 - CORS blocked)
    const displayUrl = storageKey ? `${R2_PUBLIC_URL}/${storageKey}` : '/placeholder.svg';
    
    return {
      id: p.id,
      filename: p.filename,
      originalFilename,
      storageKey,
      originalPath, // B2 path for download only
      // All display URLs point to R2 (watermarked previews)
      thumbnailUrl: displayUrl,
      previewUrl: displayUrl,
      originalUrl: displayUrl,
      isSelected: true,
      isFavorite: false,
      comment: '',
      order: 0,
      width: 800,
      height: 600,
    };
  });

  // Filter photos that have original_path (can be downloaded from B2)
  const downloadablePhotos = transformedPhotos.filter(p => p.originalPath);
  const hasDownloadablePhotos = downloadablePhotos.length > 0;

  const handleDownloadAll = async () => {
    if (isDownloading || downloadablePhotos.length === 0) return;
    
    setIsDownloading(true);
    setDownloadProgress({ current: 0, total: downloadablePhotos.length });
    
    try {
      await downloadAllPhotos(
        galleryId,
        downloadablePhotos.map(p => ({
          // Use originalPath (B2 path) for download, NOT storageKey (R2 path)
          storageKey: p.originalPath || '',
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
          <h2 className="text-lg font-semibold text-foreground">
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
            style={{ fontFamily: sessionFont || '"Inter", sans-serif' }}
          >
            {applyTitleCase(sessionName, titleCaseMode)}
          </p>
        )}
        
        {/* Botão de download - apenas se permitido E há fotos com originalPath */}
        {allowDownload && hasDownloadablePhotos && (
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
                Baixar Todas ({downloadablePhotos.length})
              </>
            )}
          </Button>
        )}
        
        {/* Warning if download is allowed but no originals exist */}
        {allowDownload && !hasDownloadablePhotos && photos.length > 0 && (
          <p className="text-sm text-muted-foreground italic">
            Download não disponível para estas fotos
          </p>
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
          galleryId={galleryId}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
          onSelect={() => {}} // No-op - selection disabled
        />
      )}
    </div>
  );
}
