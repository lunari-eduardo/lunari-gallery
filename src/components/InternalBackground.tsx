export function InternalBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
      {/* Right sphere (larger) */}
      <div
        className="absolute eclipse-float"
        style={{
          top: '20%',
          right: '-5%',
          width: '50vw',
          height: '50vw',
          maxWidth: '800px',
          maxHeight: '800px',
          borderRadius: '50%',
          background: `
            radial-gradient(circle at 50% 50%,
              rgba(172, 94, 58, 0.35) 0%,
              rgba(194, 120, 60, 0.4) 25%,
              rgba(194, 140, 80, 0.25) 40%,
              rgba(194, 140, 80, 0.1) 55%,
              transparent 65%
            )
          `,
          filter: 'blur(18px)',
        }}
      />
      {/* Right sphere glow */}
      <div
        className="absolute eclipse-float"
        style={{
          top: '15%',
          right: '-10%',
          width: '60vw',
          height: '60vw',
          maxWidth: '950px',
          maxHeight: '950px',
          borderRadius: '50%',
          background: `
            radial-gradient(circle at 50% 50%,
              rgba(194, 120, 60, 0.12) 0%,
              rgba(194, 140, 80, 0.05) 40%,
              transparent 60%
            )
          `,
          filter: 'blur(40px)',
        }}
      />

      {/* Left sphere (smaller) */}
      <div
      className="absolute eclipse-float-reverse"
        style={{
          top: '40%',
          left: '-5%',
          width: '35vw',
          height: '35vw',
          maxWidth: '550px',
          maxHeight: '550px',
          borderRadius: '50%',
          background: `
            radial-gradient(circle at 50% 50%,
              rgba(172, 94, 58, 0.3) 0%,
              rgba(194, 120, 60, 0.35) 25%,
              rgba(194, 140, 80, 0.2) 40%,
              rgba(194, 140, 80, 0.08) 55%,
              transparent 65%
            )
          `,
          filter: 'blur(16px)',
        }}
      />
      {/* Left sphere glow */}
      <div
      className="absolute eclipse-float-reverse"
        style={{
          top: '35%',
          left: '-10%',
          width: '45vw',
          height: '45vw',
          maxWidth: '700px',
          maxHeight: '700px',
          borderRadius: '50%',
          background: `
            radial-gradient(circle at 50% 50%,
              rgba(194, 120, 60, 0.1) 0%,
              rgba(194, 140, 80, 0.04) 40%,
              transparent 60%
            )
          `,
          filter: 'blur(35px)',
        }}
      />

      {/* Dark mode dimmer */}
      <div className="absolute inset-0 bg-background/80 dark:block hidden" />
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
