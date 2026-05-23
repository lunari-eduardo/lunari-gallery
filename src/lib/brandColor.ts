import { useEffect, useState } from 'react';

export interface BrandColor {
  h: number;
  s: number;
  l: number;
  glowL: number;
  hex: string;
  rgb: { r: number; g: number; b: number };
  isMono: boolean;
}

function hslToRgb(h: number, s: number, l: number) {
  s /= 100; l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return { r: Math.round(f(0) * 255), g: Math.round(f(8) * 255), b: Math.round(f(4) * 255) };
}

function rgbToHex({ r, g, b }: { r: number; g: number; b: number }) {
  const h = (n: number) => n.toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

function read(): BrandColor {
  if (typeof window === 'undefined') {
    return { h: 19, s: 78, l: 30, glowL: 45, hex: '#893806', rgb: { r: 137, g: 56, b: 6 }, isMono: false };
  }
  const cs = getComputedStyle(document.documentElement);
  const parse = (name: string, fallback: number) => {
    const v = cs.getPropertyValue(name).trim().replace('%', '');
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : fallback;
  };
  const h = parse('--brand-h', 19);
  const s = parse('--brand-s', 78);
  const l = parse('--brand-l', 30);
  const glowL = parse('--brand-glow-l', Math.min(l + 15, 90));
  const rgb = hslToRgb(h, s, l);
  return { h, s, l, glowL, hex: rgbToHex(rgb), rgb, isMono: s === 0 };
}

export function useBrandColor(): BrandColor {
  const [color, setColor] = useState<BrandColor>(() => read());

  useEffect(() => {
    const update = () => setColor(read());
    update();
    const obs = new MutationObserver(update);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'class'] });
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', update);
    return () => { obs.disconnect(); mq.removeEventListener('change', update); };
  }, []);

  return color;
}
