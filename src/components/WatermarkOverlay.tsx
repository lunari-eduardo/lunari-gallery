/**
 * WatermarkOverlay - Visual protection for gallery images
 * 
 * Supports two modes:
 * - System: Full-size watermark that fits the photo (no repeat)
 * - Custom: Photographer's logo in tiled/mosaic pattern (repeat)
 * 
 * This is a visual deterrent, not a security feature.
 * For true protection, watermarks should be burned into pixels on the server.
 */

import { cn } from '@/lib/utils';

const R2_PUBLIC_URL = import.meta.env.VITE_R2_PUBLIC_URL || 'https://media.lunarihub.com';

export type WatermarkMode = 'system' | 'custom' | 'none';

interface WatermarkOverlayProps {
  /** Watermark mode: system (full image), custom (tiled logo), or none */
  mode?: WatermarkMode;
  /** Photo orientation for system mode - determines which asset to use */
  orientation?: 'horizontal' | 'vertical';
  /** Custom watermark path in R2 (for custom mode, e.g., user-assets/{userId}/watermark.png) */
  customPath?: string | null;
  /** Opacity from 0 to 100 (default: 40) */
  opacity?: number;
  /** Scale for custom mode tile as percentage (10-50%, default: 30) */
  scale?: number;
  /** Additional CSS classes */
  className?: string;
}

export function WatermarkOverlay({ 
  mode = 'system',
  orientation = 'horizontal',
  customPath,
  opacity = 40,
  scale = 30,
  className 
}: WatermarkOverlayProps) {
  // No overlay if mode is none
  if (mode === 'none') return null;

  // Fallback: Inline SVG diagonal pattern (used when R2 assets fail)
  const fallbackSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
      <path d="M0 40L40 0M-10 10L10 -10M30 50L50 30" 
            stroke="rgba(255,255,255,0.6)" 
            stroke-width="1" 
            fill="none"/>
    </svg>
  `.trim();
  const fallbackPattern = `url("data:image/svg+xml,${encodeURIComponent(fallbackSvg)}")`;

  const getBackgroundStyle = (): React.CSSProperties => {
    if (mode === 'system') {
      // System: Full-size watermark that fits the photo
      // Uses orientation-specific assets (h = horizontal, v = vertical)
      const suffix = orientation === 'horizontal' ? 'h' : 'v';
      const url = `${R2_PUBLIC_URL}/system-assets/default-watermark-${suffix}.png`;
      
      return {
        backgroundImage: `url("${url}"), ${fallbackPattern}`,
        backgroundSize: 'contain',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      };
    }
    
    if (mode === 'custom' && customPath) {
      // Custom: Tiled logo pattern (mosaic)
      const url = `${R2_PUBLIC_URL}/${customPath}`;
      
      return {
        backgroundImage: `url("${url}"), ${fallbackPattern}`,
        backgroundSize: `${scale}%`,
        backgroundPosition: 'center',
        backgroundRepeat: 'repeat',
      };
    }
    
    // Fallback: inline SVG diagonal pattern
    return {
      backgroundImage: fallbackPattern,
      backgroundRepeat: 'repeat',
    };
  };

  return (
    <div
      className={cn(
        'absolute inset-0 z-10',
        'pointer-events-none select-none',
        className
      )}
      style={{
        ...getBackgroundStyle(),
        opacity: opacity / 100,
      }}
      aria-hidden="true"
      draggable={false}
    />
  );
}

/**
 * Hook to determine if watermark should display based on gallery settings
 */
export function useWatermarkDisplay(
  watermarkDisplay: 'all' | 'fullscreen' | 'none' = 'all',
  context: 'grid' | 'lightbox'
): boolean {
  if (watermarkDisplay === 'none') return false;
  if (watermarkDisplay === 'all') return true;
  if (watermarkDisplay === 'fullscreen') return context === 'lightbox';
  return false;
}
