import { Image, Film } from 'lucide-react';
import { isVideoSupported } from './MemoryVideoEngine';

export type MemoryOutputType = 'image' | 'video';

interface Props {
  outputType: MemoryOutputType;
  onOutputTypeChange: (type: MemoryOutputType) => void;
  photoCount: number;
  isDark: boolean;
}

export function MemoryLayoutPicker({ outputType, onOutputTypeChange, photoCount, isDark }: Props) {
  const textColor = isDark ? '#F5F5F4' : '#2D2A26';
  const mutedColor = isDark ? '#78716C' : '#A8A29E';
  const activeBg = isDark ? '#F5F5F4' : '#1C1917';
  const activeText = isDark ? '#1C1917' : '#F5F5F4';
  const inactiveBg = isDark ? '#292524' : '#E7E5E4';

  const videoAvailable = isVideoSupported();

  const getInfoText = () => {
    if (outputType === 'image') {
      return photoCount <= 5
        ? 'Será gerada 1 imagem'
        : 'Serão geradas 2 imagens automaticamente';
    }
    return photoCount <= 5
      ? 'Vídeo slideshow cinematográfico'
      : 'Vídeo colagem animada';
  };

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Output type toggle */}
      <div className="flex flex-col items-center gap-2">
        <p className="text-sm tracking-wide opacity-80" style={{ color: mutedColor }}>
          Formato
        </p>
        <div
          className="flex rounded-md overflow-hidden"
          style={{ border: `1px solid ${isDark ? '#44403C' : '#D6D3D1'}` }}
        >
          <button
            onClick={() => onOutputTypeChange('image')}
            className="flex items-center gap-2 px-5 py-2.5 text-sm tracking-wide transition-all duration-300"
            style={{
              backgroundColor: outputType === 'image' ? activeBg : inactiveBg,
              color: outputType === 'image' ? activeText : textColor,
            }}
          >
            <Image className="w-4 h-4" />
            Imagem
          </button>
          {videoAvailable && (
            <button
              onClick={() => onOutputTypeChange('video')}
              className="flex items-center gap-2 px-5 py-2.5 text-sm tracking-wide transition-all duration-300"
              style={{
                backgroundColor: outputType === 'video' ? activeBg : inactiveBg,
                color: outputType === 'video' ? activeText : textColor,
              }}
            >
              <Film className="w-4 h-4" />
              Vídeo
            </button>
          )}
        </div>
      </div>

      {/* Info text */}
      <p className="text-sm text-center opacity-70 max-w-[280px]" style={{ color: mutedColor }}>
        {getInfoText()}
      </p>
    </div>
  );
}
