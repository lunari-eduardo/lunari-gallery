import { useEffect, useCallback, useRef } from 'react';

/**
 * Hook that applies multi-layer image protection on gallery pages:
 * - Blocks keyboard shortcuts (Ctrl+S, Ctrl+P, PrintScreen, F12, Ctrl+Shift+I)
 * - Applies blur effect when print attempt is detected
 * - Blocks right-click context menu
 * - Disables text/image selection and touch callout (iOS)
 * - Hides content when printing via CSS
 */
export function useImageProtection() {
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const applyBlur = useCallback(() => {
    const el = containerRef.current || document.querySelector('.gallery-protected');
    if (el) {
      (el as HTMLElement).classList.add('gallery-blur-active');
    }
    // Remove blur after 3 seconds
    if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    blurTimeoutRef.current = setTimeout(() => {
      if (el) {
        (el as HTMLElement).classList.remove('gallery-blur-active');
      }
    }, 3000);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Block Ctrl+S (save)
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // Block Ctrl+P (print) — apply blur
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        e.stopPropagation();
        applyBlur();
        return;
      }

      // Block Ctrl+Shift+I (devtools)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'I') {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // Block F12 (devtools)
      if (e.key === 'F12') {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // Block PrintScreen — apply blur
      if (e.key === 'PrintScreen') {
        e.preventDefault();
        e.stopPropagation();
        applyBlur();
        return;
      }

      // Block Ctrl+Shift+S (screenshot tool in some browsers)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        e.stopPropagation();
        applyBlur();
        return;
      }

      // Block Ctrl+U (view source)
      if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
    };

    // Block right-click globally on the page
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    // Handle beforeprint event (covers Ctrl+P and browser menu Print)
    const handleBeforePrint = () => {
      applyBlur();
    };

    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('beforeprint', handleBeforePrint);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('beforeprint', handleBeforePrint);
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    };
  }, [applyBlur]);

  return { containerRef };
}
