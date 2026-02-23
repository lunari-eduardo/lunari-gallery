import { useState, useEffect, useRef } from 'react';
import { Download, Share2, RefreshCw, Loader2 } from 'lucide-react';
import { getPhotoUrl, PhotoPaths } from '@/lib/photoUrl';
import { generateVideo, isVideoSupported } from './MemoryVideoEngine';
import type { MemoryPhoto } from './MemoryPhotoSelector';

interface Props {
  photos: MemoryPhoto[];
  selectedIds: string[];
  text: string;
  isDark: boolean;
  sessionFont?: string;
  sessionName?: string;
}

async function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  const resp = await fetch(url);
  const blob = await resp.blob();
  const objectUrl = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(objectUrl); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Load failed')); };
    img.src = objectUrl;
  });
}

export function MemoryVideoPreview({ photos, selectedIds, text, isDark, sessionFont, sessionName }: Props) {
  const [state, setState] = useState<'generating' | 'ready' | 'error'>('generating');
  const [progress, setProgress] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const blobRef = useRef<Blob | null>(null);
  const hasStarted = useRef(false);

  const textColor = isDark ? '#F5F5F4' : '#2D2A26';
  const mutedColor = isDark ? '#A8A29E' : '#78716C';
  const fontFamily = sessionFont || 'Georgia, serif';

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    const run = async () => {
      try {
        setState('generating');
        setProgress(0);

        // Load images
        const selectedPhotos = selectedIds
          .map(id => photos.find(p => p.id === id))
          .filter(Boolean) as MemoryPhoto[];

        const images: HTMLImageElement[] = [];
        for (const photo of selectedPhotos) {
          const paths: PhotoPaths = {
            storageKey: photo.storageKey,
            previewPath: photo.previewPath,
            width: photo.width,
            height: photo.height,
          };
          try {
            const img = await loadImageFromUrl(getPhotoUrl(paths, 'preview'));
            images.push(img);
          } catch {
            // skip
          }
        }

        if (images.length === 0) {
          setState('error');
          return;
        }

        const blob = await generateVideo({
          images,
          text,
          isDark,
          fontFamily,
          onProgress: setProgress,
        });

        blobRef.current = blob;
        const url = URL.createObjectURL(blob);
        setVideoUrl(url);
        setState('ready');
      } catch (err) {
        console.error('Video generation failed:', err);
        setState('error');
      }
    };

    run();

    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRetry = () => {
    hasStarted.current = false;
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoUrl(null);
    blobRef.current = null;
    setState('generating');
    setProgress(0);
    // Trigger re-run
    hasStarted.current = false;
    const timer = setTimeout(() => {
      hasStarted.current = false;
      // Force a re-mount by toggling state
      setState('generating');
    }, 50);
    return () => clearTimeout(timer);
  };

  const handleDownload = () => {
    if (!blobRef.current) return;
    const url = URL.createObjectURL(blobRef.current);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lembranca.webm';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleShare = async () => {
    if (!blobRef.current) return;
    try {
      const file = new File([blobRef.current], 'lembranca.webm', { type: 'video/webm' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: sessionName || 'Lembrança',
        });
      } else {
        handleDownload();
      }
    } catch {
      handleDownload();
    }
  };

  const canShare = typeof navigator !== 'undefined' && !!navigator.share;

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      {/* Generating state */}
      {state === 'generating' && (
        <div className="flex flex-col items-center gap-4 py-12">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: mutedColor }} />
          <p className="text-sm opacity-80" style={{ color: mutedColor }}>
            Gerando vídeo... {progress}%
          </p>
          <div className="w-48 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: isDark ? '#292524' : '#E7E5E4' }}>
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${progress}%`,
                backgroundColor: isDark ? '#F5F5F4' : '#1C1917',
              }}
            />
          </div>
        </div>
      )}

      {/* Error state */}
      {state === 'error' && (
        <div className="flex flex-col items-center gap-4 py-12">
          <p className="text-sm opacity-80" style={{ color: mutedColor }}>
            Não foi possível gerar o vídeo.
          </p>
          <button
            onClick={handleRetry}
            className="flex items-center gap-2 px-4 py-2 text-sm"
            style={{ color: textColor }}
          >
            <RefreshCw className="w-4 h-4" />
            Tentar novamente
          </button>
        </div>
      )}

      {/* Ready state */}
      {state === 'ready' && videoUrl && (
        <>
          <div className="w-full max-w-xs mx-auto overflow-hidden" style={{ aspectRatio: '9/16', borderRadius: 2 }}>
            <video
              src={videoUrl}
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-5 py-2.5 text-sm tracking-wide transition-all duration-300"
              style={{
                backgroundColor: isDark ? '#F5F5F4' : '#1C1917',
                color: isDark ? '#1C1917' : '#F5F5F4',
              }}
            >
              <Download className="w-4 h-4" />
              Salvar
            </button>

            {canShare && (
              <button
                onClick={handleShare}
                className="flex items-center gap-2 px-5 py-2.5 text-sm tracking-wide transition-all duration-300 border"
                style={{
                  borderColor: isDark ? '#44403C' : '#D6D3D1',
                  color: textColor,
                  backgroundColor: 'transparent',
                }}
              >
                <Share2 className="w-4 h-4" />
                Compartilhar
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
