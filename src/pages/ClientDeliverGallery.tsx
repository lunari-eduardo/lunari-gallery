import { useState, useMemo, useEffect } from 'react';
import { CoverRenderer } from '@/components/deliver/covers/CoverRenderer';
import { resolveCoverId } from '@/components/deliver/covers/registry';
import { DeliverHeader } from '@/components/deliver/DeliverHeader';
import { DeliverPhotoGrid, DeliverPhoto } from '@/components/deliver/DeliverPhotoGrid';
import { DeliverLightbox } from '@/components/deliver/DeliverLightbox';
import { GalleryThemeProvider, useGalleryDisplayTheme } from '@/hooks/useGalleryDisplayTheme';
import { DeliverWelcomeModal } from '@/components/deliver/DeliverWelcomeModal';
import { downloadDeliverPhoto, downloadAllDeliverPhotos } from '@/lib/deliverDownloadUtils';
import { getFontFamilyById } from '@/components/FontSelect';
import { TitleCaseMode } from '@/types/gallery';
import { PhotoPaths, getPhotoUrl as getPhotoUrlLib } from '@/lib/photoUrl';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { sortPhotosByNaturalFilename } from '@/lib/photoOrdering';

interface DeliverGalleryData {
  gallery: {
    id: string;
    sessionName: string;
    clientName?: string;
    welcomeMessage?: string;
    expirationDate?: string | null;
    settings?: {
      sessionFont?: string;
      titleCaseMode?: TitleCaseMode;
      coverPhotoId?: string;
      photoSpacing?: number;
      themeId?: string;
      themeOverrides?: any;
      coverId?: string | null;
      defaultCoverId?: string | null;
    };
  };
  photos: Array<{
    id: string;
    storage_key: string;
    original_path?: string | null;
    original_filename: string;
    filename?: string;
    width?: number;
    height?: number;
    preview_path?: string | null;
    thumb_path?: string | null;
    pasta_id?: string | null;
  }>;
  folders?: Array<{
    id: string;
    nome: string;
    ordem: number;
  }>;
  studioSettings?: {
    studio_name?: string;
    studio_logo_url?: string;
    favicon_url?: string;
  } | null;
  theme?: {
    backgroundMode?: string;
    primaryColor?: string | null;
    accentColor?: string | null;
    emphasisColor?: string | null;
  } | null;
  clientMode?: string;
}

interface Props {
  data: DeliverGalleryData;
}

export default function ClientDeliverGallery({ data }: Props) {
  const { gallery, studioSettings } = data;
  const folders = data.folders || [];
  const hasFolders = folders.length > 0;

  const isDark = data.clientMode === 'dark' || (!data.clientMode);
  // Default values before theme resolution
  const bgColor = isDark ? '#1C1917' : '#FAF9F7';
  const textColor = isDark ? '#F5F5F4' : '#2D2A26';
  const primaryColor = isDark ? '#FFFFFF' : '#1C1917';


  const [showWelcome, setShowWelcome] = useState(() => {
    const key = `deliver_welcome_${gallery.id}`;
    return !sessionStorage.getItem(key) && !!gallery.welcomeMessage;
  });
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [heroEntered, setHeroEntered] = useState(false);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [folderViewMode, setFolderViewMode] = useState<'albums' | 'grid'>(hasFolders ? 'albums' : 'grid');

  const sessionFont = gallery.settings?.sessionFont
    ? getFontFamilyById(gallery.settings.sessionFont)
    : undefined;

  const allPhotos: DeliverPhoto[] = useMemo(() => {
    const mapped = data.photos.map((p) => {
      const peso = Number((p as any).peso_visual ?? (p as any).pesoVisual ?? 0);
      return {
        id: p.id,
        storageKey: p.storage_key,
        originalPath: p.original_path,
        originalFilename: p.original_filename || p.filename || 'photo.jpg',
        filename: p.filename,
        width: p.width || 800,
        height: p.height || 600,
        thumbPath: p.thumb_path,
        previewPath: p.preview_path,
        folderId: p.pasta_id || null,
        mimeType: (p as any).mime_type || null,
        // Canonicaliza ambos os nomes para o motor Editorial.
        peso_visual: peso,
        pesoVisual: peso,
      } as DeliverPhoto;
    });
    // Ordem canônica: alfabética natural pelo nome original.
    return sortPhotosByNaturalFilename(mapped);
  }, [data.photos]);


  const photos = useMemo(() => {
    if (!hasFolders || activeFolderId === null) return allPhotos;
    return allPhotos.filter(p => p.folderId === activeFolderId);
  }, [allPhotos, activeFolderId, hasFolders]);

  const coverPhotoId = gallery.settings?.coverPhotoId;
  const coverPhotoSource = coverPhotoId
    ? allPhotos.find(p => p.id === coverPhotoId) || allPhotos[0]
    : allPhotos[0];

  const coverPhoto: PhotoPaths | null = coverPhotoSource
    ? { storageKey: coverPhotoSource.storageKey, previewPath: coverPhotoSource.previewPath, width: coverPhotoSource.width, height: coverPhotoSource.height }
    : null;

  useEffect(() => {
    if (studioSettings?.favicon_url) {
      const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement || document.createElement('link');
      link.rel = 'icon';
      link.href = studioSettings.favicon_url;
      document.head.appendChild(link);
    }
    document.title = gallery.sessionName || 'Galeria';
  }, [studioSettings, gallery.sessionName]);

  const handleCloseWelcome = () => {
    setShowWelcome(false);
    sessionStorage.setItem(`deliver_welcome_${gallery.id}`, 'true');
  };

  const handleDownloadSingle = async (photo: DeliverPhoto) => {
    try {
      await downloadDeliverPhoto(gallery.id, photo.originalPath || photo.storageKey, photo.originalFilename);
    } catch {
      toast.error('Erro ao baixar foto');
    }
  };

  const handleDownloadAll = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    try {
      const downloadable = photos.map((p) => ({
        storageKey: p.originalPath || p.storageKey,
        filename: p.originalFilename,
      }));
      const zipName = activeFolderId && hasFolders
        ? `${gallery.sessionName} - ${folders.find(f => f.id === activeFolderId)?.nome || 'fotos'}.zip`
        : `${gallery.sessionName}.zip`;
      await downloadAllDeliverPhotos(gallery.id, downloadable, zipName);
    } catch {
      toast.error('Erro ao baixar fotos');
    } finally {
      setIsDownloading(false);
    }
  };

  const resolvedCoverId = resolveCoverId(
    gallery.settings?.coverId ?? gallery.settings?.defaultCoverId ?? null
  );

  // Album view for Transfer galleries
  if (hasFolders && folderViewMode === 'albums') {
    return (
      <div className="min-h-screen" style={{ backgroundColor: bgColor, color: textColor }}>
        <CoverRenderer
          coverId={resolvedCoverId}
          coverPhoto={coverPhoto}
          sessionName={gallery.sessionName}
          studioName={studioSettings?.studio_name}
          sessionFont={sessionFont}
          titleCaseMode={gallery.settings?.titleCaseMode}
          isDark={isDark}
          primaryColor={primaryColor}
          onEnter={() => setHeroEntered(true)}
        />


        <div id="deliver-gallery" className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-normal mb-1" style={{ fontFamily: sessionFont }}>
              {gallery.sessionName}
            </h2>
            <p className="text-sm" style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}>
              {allPhotos.length} fotos
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6 md:gap-8">
            {folders.map(folder => {
              const folderPhotos = allPhotos.filter(p => p.folderId === folder.id);
              const thumb = folderPhotos[0];
              return (
                <button
                  key={folder.id}
                  onClick={() => { setActiveFolderId(folder.id); setFolderViewMode('grid'); }}
                  className="group flex flex-col gap-4 text-left transition-all"
                >
                  <div 
                    className="relative aspect-[4/5] overflow-hidden transition-all duration-500 shadow-sm group-hover:shadow-xl group-hover:-translate-y-1"
                    style={{ borderRadius: 'var(--gallery-radius, 8px)' }}
                  >
                    {thumb ? (
                      <img
                        src={getPhotoUrlLib({ storageKey: thumb.storageKey, thumbPath: thumb.thumbPath, width: thumb.width, height: thumb.height }, 'thumbnail')}
                        alt={folder.nome}
                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                      />
                    ) : (
                      <div className="absolute inset-0" style={{ backgroundColor: isDark ? '#2A2520' : '#EDE9E4' }} />
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-500" />
                  </div>
                  
                  <div className="space-y-1 px-1">
                    <p className="font-medium text-base sm:text-lg tracking-tight leading-tight group-hover:text-primary transition-colors">
                      {folder.nome}
                    </p>
                    <p className="text-[10px] uppercase tracking-[0.2em] opacity-40 font-semibold">
                      {folderPhotos.length} fotografias
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <DeliverWelcomeModal open={showWelcome} onClose={handleCloseWelcome} message={gallery.welcomeMessage || ''} sessionName={gallery.sessionName} clientName={gallery.clientName} studioName={studioSettings?.studio_name} isDark={isDark} />
      </div>
    );
  }
  return (
    <GalleryThemeProvider 
      gallerySettings={gallery.settings} 
      globalSettings={data.studioSettings as any}
      activeThemeId={gallery.settings?.themeId}
      themeOverrides={gallery.settings?.themeOverrides}
      footer={{
        whatsapp: "wa.me/5551998807701",
        maps: "maps.app.goo.gl/XVYSt7E869UvJNBG6?g_st=ic",
        instagrams: ["@parquewiteck", "@meliterranea.cafe"]
      }}
    >
      <ClientDeliverGalleryContent 
        data={data} 
        photos={photos} 
        allPhotos={allPhotos}
        coverPhoto={coverPhoto}
        coverId={resolvedCoverId}
        sessionFont={sessionFont}
        handleDownloadAll={handleDownloadAll}
        isDownloading={isDownloading}
        handleDownloadSingle={handleDownloadSingle}
        showWelcome={showWelcome}
        handleCloseWelcome={handleCloseWelcome}
        lightboxIndex={lightboxIndex}
        setLightboxIndex={setLightboxIndex}
        activeFolderId={activeFolderId}
        setActiveFolderId={setActiveFolderId}
        setFolderViewMode={setFolderViewMode}
      />
    </GalleryThemeProvider>
  );
}


function ClientDeliverGalleryContent({ 
  data, photos, allPhotos, coverPhoto, coverId, sessionFont, handleDownloadAll, 
  isDownloading, handleDownloadSingle, showWelcome, handleCloseWelcome,
  lightboxIndex, setLightboxIndex, activeFolderId, setActiveFolderId, setFolderViewMode
}: any) {
  const { gallery, studioSettings } = data;
  const folders = data.folders || [];
  const hasFolders = folders.length > 0;
  const { theme, cssVars } = useGalleryDisplayTheme();
  const [headerVisible, setHeaderVisible] = useState(false);
  
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const viewportHeight = window.innerHeight;
      setHeaderVisible(scrollY > viewportHeight * 0.85);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const isDark = data.clientMode === 'dark' || (!data.clientMode);
  const bgColor = cssVars['--gallery-bg'] !== 'transparent' ? cssVars['--gallery-bg'] : (isDark ? '#1C1917' : '#FAF9F7');
  const textColor = isDark ? '#F5F5F4' : '#2D2A26';
  const primaryColor = isDark ? '#FFFFFF' : '#1C1917';

  return (
    <div className="min-h-screen" style={{ backgroundColor: bgColor, color: textColor }}>
      {!hasFolders && (
        <CoverRenderer
          coverId={coverId}
          coverPhoto={coverPhoto}
          sessionName={gallery.sessionName}
          studioName={studioSettings?.studio_name}
          sessionFont={sessionFont}
          titleCaseMode={gallery.settings?.titleCaseMode}
          isDark={isDark}
          primaryColor={primaryColor}
          onEnter={() => {
            const gallerySection = document.getElementById('deliver-gallery');
            if (gallerySection) {
              gallerySection.scrollIntoView({ behavior: 'smooth' });
            }
          }}
        />
      )}


      <div id="deliver-gallery">
        <DeliverHeader 
          sessionName={gallery.sessionName} 
          photoCount={photos.length} 
          onDownloadAll={handleDownloadAll} 
          isDownloading={isDownloading} 
          isDark={isDark} 
          primaryColor={primaryColor}
          isVisible={headerVisible}
        />

        {hasFolders && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-10">
            <div className="flex flex-wrap items-center gap-3">
              <button 
                onClick={() => setFolderViewMode('albums')} 
                className="group flex items-center gap-2 px-4 py-2 rounded-full text-xs uppercase tracking-widest font-semibold transition-all border bg-white/5 hover:bg-white/10 active:scale-95" 
                style={{ 
                  color: textColor, 
                  borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', 
                }}
              >
                <span className="opacity-40 group-hover:translate-x-[-2px] transition-transform">←</span> 
                Álbuns
              </button>
              
              <div className="h-4 w-px bg-white/10 mx-1" />

              {folders.map((f: any) => {
                const isActive = f.id === activeFolderId;
                const count = allPhotos.filter((p: any) => p.folderId === f.id).length;
                return (
                  <button 
                    key={f.id} 
                    onClick={() => setActiveFolderId(f.id)}
                    className={cn(
                      "px-4 py-2 rounded-full text-[10px] uppercase tracking-[0.15em] font-bold transition-all border active:scale-95",
                      isActive ? "bg-primary text-primary-foreground border-primary" : "bg-transparent opacity-60 hover:opacity-100"
                    )}
                    style={{ 
                      color: isActive ? 'var(--gallery-primary-foreground)' : textColor, 
                      backgroundColor: isActive ? 'var(--gallery-primary)' : 'transparent',
                      borderColor: isActive ? 'var(--gallery-primary)' : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'), 
                    }}
                  >
                    {f.nome} <span className="opacity-40 ml-1">({count})</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}


        <DeliverPhotoGrid photos={photos} onPhotoClick={(i: number) => setLightboxIndex(i)} onDownload={handleDownloadSingle} bgColor={bgColor} />
      </div>

      {lightboxIndex !== null && (
        <DeliverLightbox photos={photos} currentIndex={lightboxIndex} onClose={() => setLightboxIndex(null)} onNavigate={setLightboxIndex} onDownload={handleDownloadSingle} />
      )}

      <DeliverWelcomeModal open={showWelcome} onClose={handleCloseWelcome} message={gallery.welcomeMessage || ''} sessionName={gallery.sessionName} clientName={gallery.clientName} studioName={studioSettings?.studio_name} isDark={isDark} />
    </div>
  );
}

