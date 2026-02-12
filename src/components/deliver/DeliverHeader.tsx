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
  isDark?: boolean;
  bgColor?: string;
  primaryColor?: string;
}

export function DeliverHeader({
  sessionName, studioName, studioLogoUrl, photoCount,
  expirationDate, sessionFont, titleCaseMode = 'normal',
  onDownloadAll, isDownloading,
  isDark = true, bgColor, primaryColor,
}: DeliverHeaderProps) {
  const displayName = applyTitleCase(sessionName, titleCaseMode);

  const headerBg = isDark
    ? 'rgba(28, 25, 23, 0.85)'
    : 'rgba(250, 249, 247, 0.85)';
  const headerText = isDark ? '#F5F5F4' : '#2D2A26';
  const mutedText = isDark ? 'rgba(245,245,244,0.5)' : 'rgba(45,42,38,0.5)';
  const borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';

  return (
    <header
      className="sticky top-0 z-40 backdrop-blur-xl"
      style={{
        backgroundColor: headerBg,
        borderBottom: `1px solid ${borderColor}`,
      }}
    >
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Left: logo + session name */}
        <div className="flex items-center gap-3 min-w-0">
          {studioLogoUrl ? (
            <img src={studioLogoUrl} alt={studioName || ''} className="h-8 w-auto object-contain" />
          ) : studioName ? (
            <span className="text-sm font-medium tracking-wide" style={{ color: mutedText }}>{studioName}</span>
          ) : null}
          <span className="hidden sm:inline" style={{ color: mutedText }}>|</span>
          <h2
            className="text-sm md:text-base font-light truncate"
            style={{ color: headerText, ...(sessionFont ? { fontFamily: sessionFont } : {}) }}
          >
            {displayName}
          </h2>
        </div>

        {/* Right: info + download */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="hidden sm:flex items-center gap-3 text-xs" style={{ color: mutedText }}>
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
            className="text-xs font-medium"
            style={{
              backgroundColor: isDark ? '#FFFFFF' : '#1C1917',
              color: isDark ? '#1C1917' : '#FFFFFF',
            }}
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            {isDownloading ? 'Baixando...' : 'Baixar Todas'}
          </Button>
        </div>
      </div>
    </header>
  );
}
