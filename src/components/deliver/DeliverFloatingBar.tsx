import { Download, Image, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { applyTitleCase } from '@/lib/textTransform';
import { useGalleryDisplayTheme } from '@/hooks/useGalleryDisplayTheme';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface DeliverFloatingBarProps {
  sessionName: string;
  photoCount: number;
  onDownloadAll: () => void;
  isDownloading?: boolean;
  isDark?: boolean;
  primaryColor?: string;
}

export function DeliverFloatingBar({
  sessionName,
  photoCount,
  onDownloadAll,
  isDownloading,
  isDark = true,
  primaryColor,
}: DeliverFloatingBarProps) {
  const { theme } = useGalleryDisplayTheme();
  const [isVisible, setIsVisible] = useState(false);
  const titleCaseMode = theme.typography?.titleCaseMode || 'normal';
  const displayName = applyTitleCase(sessionName, titleCaseMode);

  useEffect(() => {
    const handleScroll = () => {
      // Usamos uma transição mais suave baseada na altura do viewport
      const threshold = window.innerHeight * 0.6; 
      setIsVisible(window.scrollY > threshold);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (theme.header.variant === 'hidden') return null;

  return (
    <div 
      className={cn(
        "fixed top-4 left-1/2 -translate-x-1/2 z-50 transition-all duration-500 w-[95%] max-w-2xl",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-10 pointer-events-none"
      )}
    >
      <div 
        className={cn(
          "flex items-center justify-between px-4 py-2.5 rounded-full backdrop-blur-2xl border shadow-2xl transition-colors duration-300",
          isDark 
            ? "bg-black/40 border-white/10 text-white" 
            : "bg-white/70 border-black/10 text-stone-900"
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div 
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: primaryColor || (isDark ? '#FFF' : '#000'), color: isDark ? '#000' : '#FFF' }}
          >
            <Image className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-medium truncate leading-tight">
              {displayName}
            </h2>
            <p className={cn("text-[10px] opacity-60 leading-tight")}>
              {photoCount} fotografias
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 rounded-full opacity-60 hover:opacity-100"
          >
            <Info className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            onClick={onDownloadAll}
            disabled={isDownloading}
            className="h-8 px-4 rounded-full text-xs font-medium transition-transform active:scale-95"
            style={{
              backgroundColor: primaryColor || (isDark ? '#FFFFFF' : '#1C1917'),
              color: isDark ? '#1C1917' : '#FFFFFF',
            }}
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            {isDownloading ? '...' : 'Download'}
          </Button>
        </div>
      </div>
    </div>
  );
}
