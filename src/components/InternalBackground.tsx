export function InternalBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
      {/* Eclipse orb */}
      <div
        className="absolute eclipse-drift"
        style={{
          top: '30%',
          left: '25%',
          width: '45vw',
          height: '45vw',
          maxWidth: '700px',
          maxHeight: '700px',
          borderRadius: '50%',
          background: `
            radial-gradient(circle at 50% 50%,
              rgba(60, 30, 15, 0.55) 0%,
              rgba(140, 70, 30, 0.5) 25%,
              rgba(194, 120, 60, 0.45) 40%,
              rgba(194, 140, 80, 0.15) 55%,
              transparent 65%
            )
          `,
          filter: 'blur(18px)',
        }}
      />
      {/* Outer glow */}
      <div
        className="absolute eclipse-drift"
        style={{
          top: '25%',
          left: '20%',
          width: '55vw',
          height: '55vw',
          maxWidth: '850px',
          maxHeight: '850px',
          borderRadius: '50%',
          background: `
            radial-gradient(circle at 50% 50%,
              rgba(194, 120, 60, 0.18) 0%,
              rgba(194, 140, 80, 0.08) 40%,
              transparent 60%
            )
          `,
          filter: 'blur(40px)',
          animationDelay: '-10s',
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
