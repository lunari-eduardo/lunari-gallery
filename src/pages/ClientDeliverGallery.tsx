import { useState, useMemo, useEffect } from 'react';
import { DeliverHero } from '@/components/deliver/DeliverHero';
import { DeliverHeader } from '@/components/deliver/DeliverHeader';
import { DeliverPhotoGrid, DeliverPhoto } from '@/components/deliver/DeliverPhotoGrid';
import { DeliverLightbox } from '@/components/deliver/DeliverLightbox';
import { DeliverWelcomeModal } from '@/components/deliver/DeliverWelcomeModal';
import { downloadDeliverPhoto, downloadAllDeliverPhotos } from '@/lib/deliverDownloadUtils';
import { getFontFamilyById } from '@/components/FontSelect';
import { TitleCaseMode } from '@/types/gallery';
import { PhotoPaths, getPhotoUrl as getPhotoUrlLib } from '@/lib/photoUrl';
import { toast } from 'sonner';

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
    return data.photos.map((p) => ({
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
    }));
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
      await downloadAllDeliverPhotos(gallery.id, downloadable, zipName, (current, total) => {
        if (current === total) toast.success(`${total} fotos baixadas!`);
      });
    } catch {
      toast.error('Erro ao baixar fotos');
    } finally {
      setIsDownloading(false);
    }
  };

  // Album view for Transfer galleries
  if (hasFolders && folderViewMode === 'albums') {
    return (
      <div className="min-h-screen" style={{ backgroundColor: bgColor, color: textColor }}>
        <DeliverHero
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

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {folders.map(folder => {
              const folderPhotos = allPhotos.filter(p => p.folderId === folder.id);
              const thumb = folderPhotos[0];
              return (
                <button
                  key={folder.id}
                  onClick={() => { setActiveFolderId(folder.id); setFolderViewMode('grid'); }}
                  className="group relative aspect-[3/4] rounded-xl overflow-hidden transition-all hover:shadow-lg"
                  style={{ border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}` }}
                >
                  {thumb ? (
                    <img
                      src={getPhotoUrlLib({ storageKey: thumb.storageKey, thumbPath: thumb.thumbPath, width: thumb.width, height: thumb.height }, 'thumbnail')}
                      alt={folder.nome}
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="absolute inset-0" style={{ backgroundColor: isDark ? '#2A2520' : '#EDE9E4' }} />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-3 text-left">
                    <p className="text-white font-medium text-sm sm:text-base leading-tight">{folder.nome}</p>
                    <p className="text-white/70 text-xs mt-0.5">{folderPhotos.length} foto{folderPhotos.length !== 1 ? 's' : ''}</p>
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
    <div className="min-h-screen" style={{ backgroundColor: bgColor, color: textColor }}>
      {!hasFolders && (
        <DeliverHero coverPhoto={coverPhoto} sessionName={gallery.sessionName} studioName={studioSettings?.studio_name} sessionFont={sessionFont} titleCaseMode={gallery.settings?.titleCaseMode} isDark={isDark} primaryColor={primaryColor} onEnter={() => setHeroEntered(true)} />
      )}

      <div id="deliver-gallery">
        <DeliverHeader sessionName={gallery.sessionName} photoCount={photos.length} expirationDate={gallery.expirationDate} sessionFont={sessionFont} titleCaseMode={gallery.settings?.titleCaseMode} onDownloadAll={handleDownloadAll} isDownloading={isDownloading} isDark={isDark} bgColor={bgColor} primaryColor={primaryColor} />

        {hasFolders && (
          <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-4">
            <div className="flex flex-wrap gap-2">
              <button onClick={() => { setActiveFolderId(null); setFolderViewMode('albums'); }} className="px-3 py-1.5 rounded-lg text-sm transition-colors border" style={{ backgroundColor: 'transparent', color: textColor, borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)', opacity: 0.7 }}>
                ← Álbuns
              </button>
              {folders.map(f => {
                const count = allPhotos.filter(p => p.folderId === f.id).length;
                const isActive = activeFolderId === f.id;
                return (
                  <button key={f.id} onClick={() => setActiveFolderId(f.id)} className="px-3 py-1.5 rounded-lg text-sm transition-colors border" style={{ backgroundColor: isActive ? primaryColor : 'transparent', color: isActive ? bgColor : textColor, borderColor: isActive ? primaryColor : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'), opacity: isActive ? 1 : 0.7 }}>
                    {f.nome} ({count})
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <DeliverPhotoGrid photos={photos} onPhotoClick={(i) => setLightboxIndex(i)} onDownload={handleDownloadSingle} bgColor={bgColor} />
      </div>

      {lightboxIndex !== null && (
        <DeliverLightbox photos={photos} currentIndex={lightboxIndex} onClose={() => setLightboxIndex(null)} onNavigate={setLightboxIndex} onDownload={handleDownloadSingle} />
      )}

      <DeliverWelcomeModal open={showWelcome} onClose={handleCloseWelcome} message={gallery.welcomeMessage || ''} sessionName={gallery.sessionName} clientName={gallery.clientName} studioName={studioSettings?.studio_name} isDark={isDark} />
    </div>
  );
}
