export type MemoryLayout = 'solo' | 'dupla' | 'colagem';

interface Props {
  selected: MemoryLayout;
  onSelect: (layout: MemoryLayout) => void;
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
  const accent = isDark ? '#F5F5F4' : '#1C1917';
  const dim = isDark ? '#44403C' : '#D6D3D1';
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
      style={{
        backgroundColor: bg,
        border: `2px solid ${border}`,
      }}
    >
      {/* Mini 9:16 preview */}
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

export function MemoryLayoutPicker({ selected, onSelect, photoCount, isDark }: Props) {
  const textColor = isDark ? '#F5F5F4' : '#2D2A26';
  const mutedColor = isDark ? '#78716C' : '#A8A29E';

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm tracking-wide opacity-60" style={{ color: mutedColor }}>
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
    </div>
  );
}
