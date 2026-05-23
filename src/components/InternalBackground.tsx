export function InternalBackground() {
  // Tokens reativos ao preset de tema (Lunari/Sage/Ocean/.../Mono)
  const brand = 'var(--brand-h) var(--brand-s) var(--brand-l)';
  const glow = 'var(--brand-h) var(--brand-s) var(--brand-glow-l)';

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
      {/* Spheres wrapper — dimmed in dark mode to avoid excessive brightness */}
      <div className="absolute inset-0 opacity-60 dark:opacity-25">
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
                hsl(${brand} / 0.35) 0%,
                hsl(${brand} / 0.38) 12%,
                hsl(${glow} / 0.40) 22%,
                hsl(${glow} / 0.33) 32%,
                hsl(${glow} / 0.25) 42%,
                hsl(${glow} / 0.17) 50%,
                hsl(${glow} / 0.10) 58%,
                hsl(${glow} / 0.04) 65%,
                transparent 75%
              )
            `,
            filter: 'blur(22px)',
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
                hsl(${glow} / 0.12) 0%,
                hsl(${glow} / 0.09) 20%,
                hsl(${glow} / 0.05) 40%,
                hsl(${glow} / 0.02) 55%,
                transparent 65%
              )
            `,
            filter: 'blur(45px)',
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
                hsl(${brand} / 0.30) 0%,
                hsl(${brand} / 0.33) 10%,
                hsl(${glow} / 0.35) 22%,
                hsl(${glow} / 0.28) 32%,
                hsl(${glow} / 0.20) 42%,
                hsl(${glow} / 0.13) 50%,
                hsl(${glow} / 0.08) 58%,
                hsl(${glow} / 0.03) 65%,
                transparent 75%
              )
            `,
            filter: 'blur(20px)',
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
                hsl(${glow} / 0.10) 0%,
                hsl(${glow} / 0.07) 20%,
                hsl(${glow} / 0.04) 40%,
                hsl(${glow} / 0.015) 55%,
                transparent 65%
              )
            `,
            filter: 'blur(40px)',
          }}
        />
      </div>

      {/* Noise/dithering overlay */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.045]" style={{ zIndex: 1 }}>
        <filter id="internal-noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="4" stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter="url(#internal-noise)" />
      </svg>
    </div>
  );
}
