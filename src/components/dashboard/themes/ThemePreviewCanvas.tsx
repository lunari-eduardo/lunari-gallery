import React, { useState, useEffect, useRef } from 'react';
import { GalleryThemeProvider } from '@/hooks/useGalleryDisplayTheme';
import { DeliverHero } from '@/components/deliver/DeliverHero';
import { DeliverFloatingBar } from '@/components/deliver/DeliverFloatingBar';
import { DeliverPhotoGrid } from '@/components/deliver/DeliverPhotoGrid';
import { DEMO_PHOTOS } from './demoPhotos';
import { cn } from '@/lib/utils';

interface ThemePreviewCanvasProps {
  themeId: string;
  themeOverrides: any;
  viewport: 'mobile' | 'tablet' | 'desktop';
  skipHero?: boolean;
  isBlueprint?: boolean;
  previewPhotos?: any[];
}

export function ThemePreviewCanvas({
  themeId,
  themeOverrides,
  viewport,
  skipHero = false,
  isBlueprint = false,
  previewPhotos
}: ThemePreviewCanvasProps) {
  const [headerVisible, setHeaderVisible] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const viewportWidths = {
    mobile: 'w-[375px]',
    tablet: 'w-[768px]',
    desktop: 'w-full'
  };

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollY = container.scrollTop;
      const height = container.clientHeight;
      setHeaderVisible(scrollY > height * 0.85);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Simular foto de capa (usando a primeira da demo)
  const coverPhoto = {
    storageKey: DEMO_PHOTOS[0].storageKey,
    previewPath: DEMO_PHOTOS[0].previewPath,
    width: DEMO_PHOTOS[0].width,
    height: DEMO_PHOTOS[0].height
  };

  return (
    <div className="flex-1 bg-zinc-200 dark:bg-zinc-900 p-4 md:p-8 flex items-center justify-center overflow-hidden">
      <div 
        ref={scrollContainerRef}
        className={cn(
          "h-full bg-background shadow-2xl border overflow-y-auto transition-all duration-500 ease-in-out relative",
          viewportWidths[viewport]
        )}
      >
        <GalleryThemeProvider 
          activeThemeId={themeId}
          themeOverrides={themeOverrides}
        >
          <div className="flex flex-col min-h-full">
            {!skipHero && (
              <DeliverHero 
                coverPhoto={coverPhoto}
                sessionName="Minha Sessão Demo"
                studioName="Lunari Studio"
                onEnter={() => {
                  const grid = document.getElementById('preview-grid');
                  grid?.scrollIntoView({ behavior: 'smooth' });
                }}
              />
            )}

            <DeliverFloatingBar 
              sessionName="Minha Sessão Demo"
              photoCount={DEMO_PHOTOS.length}
              onDownloadAll={() => {}}
              isVisible={skipHero ? true : headerVisible}
              isDark={true} // Preview default dark para manter estilo premium
            />

            <div id="preview-grid" className="flex-1">
              <DeliverPhotoGrid 
                photos={(previewPhotos || DEMO_PHOTOS) as any}
                onPhotoClick={() => {}}
                onDownload={() => {}}
                galleryId="demo"
              />

            </div>

          </div>
        </GalleryThemeProvider>
      </div>
    </div>
  );
}
