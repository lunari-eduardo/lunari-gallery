/**
 * WatermarkOverlay - CSS-based visual protection for gallery images
 * 
 * This component renders a semi-transparent diagonal pattern over images
 * to discourage unauthorized use. It's a visual deterrent, not a security
 * feature - the underlying image is still accessible.
 * 
 * For true protection, watermarks should be burned into pixels on the server.
 * This approach is chosen for simplicity and cost-effectiveness in the
 * photo selection workflow where clients have already paid for the service.
 */

import { cn } from '@/lib/utils';

interface WatermarkOverlayProps {
  /** Opacity from 0 to 100 (default: 15) */
  opacity?: number;
  /** Additional CSS classes */
  className?: string;
}

export function WatermarkOverlay({ 
  opacity = 15, 
  className 
}: WatermarkOverlayProps) {
  // SVG pattern for diagonal lines - encoded inline for performance
  const patternSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
      <path d="M0 40L40 0M-10 10L10 -10M30 50L50 30" 
            stroke="rgba(255,255,255,0.6)" 
            stroke-width="1" 
            fill="none"/>
    </svg>
  `.trim();
  
  const encodedPattern = `url("data:image/svg+xml,${encodeURIComponent(patternSvg)}")`;

  return (
    <div
      className={cn(
        'absolute inset-0 z-10',
        'pointer-events-none select-none',
        className
      )}
      style={{
        backgroundImage: encodedPattern,
        backgroundRepeat: 'repeat',
        opacity: opacity / 100,
      }}
      aria-hidden="true"
      draggable={false}
    />
  );
}

/**
 * Hook to get watermark display settings from gallery config
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
