/**
 * Device fingerprinting for anti-fraud protection.
 * Generates a deterministic SHA-256 hash from ~10 browser signals.
 * This is NOT a tracking tool — it's used solely to detect duplicate accounts.
 */

async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function getCanvasFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 50;
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'no-canvas';

    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('Lunari fp', 2, 15);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText('Lunari fp', 4, 17);

    return canvas.toDataURL();
  } catch {
    return 'canvas-error';
  }
}

function getWebGLRenderer(): string {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return 'no-webgl';

    const debugInfo = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info');
    if (!debugInfo) return 'no-debug-info';

    const renderer = (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
    const vendor = (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
    return `${vendor}~${renderer}`;
  } catch {
    return 'webgl-error';
  }
}

function collectSignals(): string[] {
  const signals: string[] = [];

  // 1. Screen resolution + color depth
  signals.push(`screen:${screen.width}x${screen.height}x${screen.colorDepth}`);

  // 2. Available screen (excludes taskbar etc)
  signals.push(`avail:${screen.availWidth}x${screen.availHeight}`);

  // 3. Timezone
  signals.push(`tz:${Intl.DateTimeFormat().resolvedOptions().timeZone}`);

  // 4. Language
  signals.push(`lang:${navigator.language}`);

  // 5. Platform
  signals.push(`platform:${navigator.platform}`);

  // 6. Hardware concurrency (CPU cores)
  signals.push(`cores:${navigator.hardwareConcurrency || 'unknown'}`);

  // 7. Device memory (Chrome only)
  signals.push(`memory:${(navigator as any).deviceMemory || 'unknown'}`);

  // 8. Touch support
  signals.push(`touch:${navigator.maxTouchPoints || 0}`);

  // 9. Canvas fingerprint
  signals.push(`canvas:${getCanvasFingerprint()}`);

  // 10. WebGL renderer
  signals.push(`webgl:${getWebGLRenderer()}`);

  // 11. Installed plugins count (legacy but still useful)
  signals.push(`plugins:${navigator.plugins?.length || 0}`);

  // 12. Do Not Track
  signals.push(`dnt:${navigator.doNotTrack || 'unset'}`);

  return signals;
}

/**
 * Generate a device fingerprint hash.
 * Returns a SHA-256 hex string that is deterministic for the same browser/device.
 */
export async function generateDeviceFingerprint(): Promise<string> {
  try {
    const signals = collectSignals();
    const raw = signals.join('|');
    const hash = await sha256(raw);
    console.log('🔒 Device fingerprint generated');
    return hash;
  } catch (error) {
    console.warn('⚠️ Failed to generate device fingerprint:', error);
    // Fallback: use a simpler fingerprint
    const fallback = `${navigator.userAgent}|${screen.width}x${screen.height}|${Intl.DateTimeFormat().resolvedOptions().timeZone}`;
    return sha256(fallback);
  }
}
