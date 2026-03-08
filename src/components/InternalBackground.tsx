export function InternalBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
      {/* Blob 1 — top-right drifting toward center */}
      <div
        className="absolute rounded-full"
        style={{
          width: '40vw',
          height: '40vw',
          background: 'radial-gradient(circle, hsl(var(--primary) / 0.09) 0%, transparent 70%)',
          filter: 'blur(90px)',
          animation: 'blob-drift-1 30s ease-in-out infinite alternate',
        }}
      />
      {/* Blob 2 — bottom-left drifting toward center */}
      <div
        className="absolute rounded-full"
        style={{
          width: '45vw',
          height: '45vw',
          background: 'radial-gradient(circle, hsl(var(--primary) / 0.07) 0%, transparent 70%)',
          filter: 'blur(100px)',
          animation: 'blob-drift-2 30s ease-in-out infinite alternate',
        }}
      />
      {/* Blob 3 — bottom-right drifting toward center */}
      <div
        className="absolute rounded-full"
        style={{
          width: '35vw',
          height: '35vw',
          background: 'radial-gradient(circle, hsl(var(--primary) / 0.08) 0%, transparent 70%)',
          filter: 'blur(80px)',
          animation: 'blob-drift-3 30s ease-in-out infinite alternate',
        }}
      />
      {/* Noise overlay */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.02]">
        <filter id="internal-noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="4" stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter="url(#internal-noise)" />
      </svg>
    </div>
  );
}
