import { useState, useMemo, useEffect } from 'react';
import { DeliverHero } from '@/components/deliver/DeliverHero';
import { DeliverHeader } from '@/components/deliver/DeliverHeader';
import { DeliverPhotoGrid, DeliverPhoto } from '@/components/deliver/DeliverPhotoGrid';
import { DeliverLightbox } from '@/components/deliver/DeliverLightbox';
import { DeliverWelcomeModal } from '@/components/deliver/DeliverWelcomeModal';
import { downloadDeliverPhoto, downloadAllDeliverPhotos } from '@/lib/deliverDownloadUtils';
import { getFontFamilyById } from '@/components/FontSelect';
import { TitleCaseMode } from '@/types/gallery';
import { PhotoPaths } from '@/lib/photoUrl';
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

  const [showWelcome, setShowWelcome] = useState(() => {
    const key = `deliver_welcome_${gallery.id}`;
    return !sessionStorage.getItem(key) && !!gallery.welcomeMessage;
  });
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [heroEntered, setHeroEntered] = useState(false);

  const sessionFont = gallery.settings?.sessionFont
    ? getFontFamilyById(gallery.settings.sessionFont)
    : undefined;

  // Transform photos
  const photos: DeliverPhoto[] = useMemo(() => {
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
    }));
  }, [data.photos]);

  // Cover photo for hero
  const coverPhoto: PhotoPaths | null = photos.length > 0
    ? { storageKey: photos[0].storageKey, previewPath: photos[0].previewPath, width: photos[0].width, height: photos[0].height }
    : null;

  // Set favicon
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
      await downloadAllDeliverPhotos(gallery.id, downloadable, `${gallery.sessionName}.zip`, (current, total) => {
        if (current === total) toast.success(`${total} fotos baixadas!`);
      });
    } catch {
      toast.error('Erro ao baixar fotos');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Hero cover */}
      <DeliverHero
        coverPhoto={coverPhoto}
        sessionName={gallery.sessionName}
        studioName={studioSettings?.studio_name}
        sessionFont={sessionFont}
        titleCaseMode={gallery.settings?.titleCaseMode}
        onEnter={() => setHeroEntered(true)}
      />

      {/* Gallery section */}
      <div id="deliver-gallery">
        <DeliverHeader
          sessionName={gallery.sessionName}
          studioName={studioSettings?.studio_name}
          studioLogoUrl={studioSettings?.studio_logo_url}
          photoCount={photos.length}
          expirationDate={gallery.expirationDate}
          sessionFont={sessionFont}
          titleCaseMode={gallery.settings?.titleCaseMode}
          onDownloadAll={handleDownloadAll}
          isDownloading={isDownloading}
        />

        <DeliverPhotoGrid
          photos={photos}
          onPhotoClick={(i) => setLightboxIndex(i)}
          onDownload={handleDownloadSingle}
        />
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <DeliverLightbox
          photos={photos}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
          onDownload={handleDownloadSingle}
        />
      )}

      {/* Welcome modal */}
      <DeliverWelcomeModal
        open={showWelcome}
        onClose={handleCloseWelcome}
        message={gallery.welcomeMessage || ''}
        sessionName={gallery.sessionName}
        clientName={gallery.clientName}
      />
    </div>
  );
}
