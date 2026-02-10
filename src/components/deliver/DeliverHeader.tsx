import { Download, Image } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { applyTitleCase } from '@/lib/textTransform';
import { TitleCaseMode } from '@/types/gallery';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DeliverHeaderProps {
  sessionName: string;
  studioName?: string;
  studioLogoUrl?: string;
  photoCount: number;
  expirationDate?: string | null;
  sessionFont?: string;
  titleCaseMode?: TitleCaseMode;
  onDownloadAll: () => void;
  isDownloading?: boolean;
}

export function DeliverHeader({
  sessionName, studioName, studioLogoUrl, photoCount,
  expirationDate, sessionFont, titleCaseMode = 'normal',
  onDownloadAll, isDownloading,
}: DeliverHeaderProps) {
  const displayName = applyTitleCase(sessionName, titleCaseMode);

  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-black/80 border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Left: logo + session name */}
        <div className="flex items-center gap-3 min-w-0">
          {studioLogoUrl ? (
            <img src={studioLogoUrl} alt={studioName || ''} className="h-8 w-auto object-contain" />
          ) : studioName ? (
            <span className="text-white/70 text-sm font-medium tracking-wide">{studioName}</span>
          ) : null}
          <span className="text-white/30 hidden sm:inline">|</span>
          <h2
            className="text-white text-sm md:text-base font-light truncate"
            style={sessionFont ? { fontFamily: sessionFont } : undefined}
          >
            {displayName}
          </h2>
        </div>

        {/* Right: info + download */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="hidden sm:flex items-center gap-3 text-white/50 text-xs">
            <span className="flex items-center gap-1">
              <Image className="w-3.5 h-3.5" />
              {photoCount} fotos
            </span>
            {expirationDate && (
              <span>
                Expira {format(new Date(expirationDate), "dd 'de' MMM", { locale: ptBR })}
              </span>
            )}
          </div>
          <Button
            size="sm"
            onClick={onDownloadAll}
            disabled={isDownloading}
            className="bg-white text-black hover:bg-white/90 text-xs font-medium"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            {isDownloading ? 'Baixando...' : 'Baixar Todas'}
          </Button>
        </div>
      </div>
    </header>
  );
}
