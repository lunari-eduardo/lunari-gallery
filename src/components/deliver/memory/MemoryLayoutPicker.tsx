import { Image, Film } from 'lucide-react';
import { isVideoSupported } from './MemoryVideoEngine';

export type MemoryLayout = 'solo' | 'dupla' | 'colagem';
export type MemoryOutputType = 'image' | 'video';

interface Props {
  selected: MemoryLayout;
  onSelect: (layout: MemoryLayout) => void;
  outputType: MemoryOutputType;
  onOutputTypeChange: (type: MemoryOutputType) => void;
  photoCount: number;
  isDark: boolean;
}

const layouts: { id: MemoryLayout; label: string; minPhotos: number }[] = [
  { id: 'solo', label: 'Solo', minPhotos: 1 },
  { id: 'dupla', label: 'Dupla', minPhotos: 2 },
  { id: 'colagem', label: 'Colagem', minPhotos: 3 },
];

function LayoutPreview({ layout, isDark, active }: { layout: MemoryLayout; isDark: boolean; active: boolean }) {
  const bg = isDark ? '#292524' : '#E7E5E4';
  const dim = isDark ? '#44403C' : '#D6D3D1';
  const accent = isDark ? '#F5F5F4' : '#1C1917';
  const border = active ? accent : 'transparent';

  const boxStyle = (w: string, h: string) => ({
    width: w,
    height: h,
    backgroundColor: active ? (isDark ? '#57534E' : '#A8A29E') : dim,
    borderRadius: 1,
  });

  return (
    <div
      className="flex flex-col items-center gap-1 p-3 rounded-md transition-all duration-300 cursor-pointer"
      style={{ backgroundColor: bg, border: `2px solid ${border}` }}
    >
      <div className="w-12 flex flex-col items-center justify-center gap-0.5" style={{ height: 64 }}>
        {layout === 'solo' && (
          <>
            <div style={boxStyle('100%', '70%')} />
            <div style={{ ...boxStyle('60%', '4px'), marginTop: 2 }} />
          </>
        )}
        {layout === 'dupla' && (
          <>
            <div style={boxStyle('100%', '40%')} />
            <div style={boxStyle('100%', '40%')} />
            <div style={{ ...boxStyle('50%', '3px'), marginTop: 1 }} />
          </>
        )}
        {layout === 'colagem' && (
          <div className="w-full h-full grid grid-cols-2 gap-px">
            <div style={{ ...boxStyle('100%', '100%'), gridRow: '1 / 3' }} />
            <div style={boxStyle('100%', '100%')} />
            <div style={boxStyle('100%', '100%')} />
          </div>
        )}
      </div>
    </div>
  );
}

export function MemoryLayoutPicker({ selected, onSelect, outputType, onOutputTypeChange, photoCount, isDark }: Props) {
  const textColor = isDark ? '#F5F5F4' : '#2D2A26';
  const mutedColor = isDark ? '#78716C' : '#A8A29E';
  const activeBg = isDark ? '#F5F5F4' : '#1C1917';
  const activeText = isDark ? '#1C1917' : '#F5F5F4';
  const inactiveBg = isDark ? '#292524' : '#E7E5E4';

  const videoAvailable = isVideoSupported();

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Output type toggle */}
      {videoAvailable && (
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
          </div>
        </div>
      )}

      {/* Layout picker – only for image mode */}
      {outputType === 'image' && (
        <>
          <p className="text-sm tracking-wide opacity-80" style={{ color: mutedColor }}>
            Escolha um layout
          </p>
          <div className="flex gap-3">
            {layouts.map((l) => {
              const disabled = photoCount < l.minPhotos;
              return (
                <button
                  key={l.id}
                  onClick={() => !disabled && onSelect(l.id)}
                  disabled={disabled}
                  className="flex flex-col items-center gap-1.5 transition-opacity duration-300"
                  style={{ opacity: disabled ? 0.3 : 1 }}
                >
                  <LayoutPreview layout={l.id} isDark={isDark} active={selected === l.id} />
                  <span className="text-xs tracking-wide" style={{ color: textColor }}>
                    {l.label}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Video info */}
      {outputType === 'video' && (
        <p className="text-sm text-center opacity-70 max-w-[260px]" style={{ color: mutedColor }}>
          O vídeo será gerado automaticamente com efeitos cinematográficos e até 10 segundos.
        </p>
      )}
    </div>
  );
}
