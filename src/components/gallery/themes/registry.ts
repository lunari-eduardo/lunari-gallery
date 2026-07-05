import { GalleryTheme, DEFAULT_GALLERY_THEME } from '@/types/themes';

/**
 * REGRAS INVIOLÁVEIS DA GALLERY DELIVER:
 * 1. Cantos retos (0px) em todas as fotos.
 * 2. Sem sombras ou bordas decorativas nas fotos.
 * 3. Hero em tela cheia é obrigatório.
 * 4. Header flutuante com blur (glass) após scroll.
 * 5. Foco total na fotografia.
 */

export const LUNARI_THEME: GalleryTheme = {
  ...DEFAULT_GALLERY_THEME,
  id: 'lunari',
  name: 'Lunari',
  version: '1.1.0',
  layout: {
    ...DEFAULT_GALLERY_THEME.layout,
    engine: 'editorial-justified',
    columns: { mobile: 2, tablet: 3, desktop: 4 },
    gap: 8,
    rowUnit: 280,
    density: 'comfortable',
    maxItemsPerRow: { mobile: 3, tablet: 4, desktop: 5 },
  },
  surface: {
    ...DEFAULT_GALLERY_THEME.surface,
    background: '#FAF9F7',
    borderRadius: '0px',
  },
  featured: {
    ...DEFAULT_GALLERY_THEME.featured,
    enabled: false,
  },
};

export const CLEAN_THEME: GalleryTheme = {
  ...DEFAULT_GALLERY_THEME,
  id: 'clean',
  name: 'Clean',
  version: '1.3.0',
  layout: {
    ...DEFAULT_GALLERY_THEME.layout,
    engine: 'editorial-justified',
    columns: { mobile: 2, tablet: 3, desktop: 4 },
    gap: 12,
    rowUnit: 320,
    density: 'airy',
    uniformGridSpan: {
      cols: { mobile: 2, tablet: 3, desktop: 4 },
      cellAspect: 3 / 4, // célula base retrato 3:4 → horizontal span 2 vira AR ≈ 1.5
      landscapeSpan: 2,
      lookaheadSwap: true,
    },
  },
  surface: {
    ...DEFAULT_GALLERY_THEME.surface,
    background: '#FFFFFF',
    borderRadius: '0px',
  },
  featured: {
    ...DEFAULT_GALLERY_THEME.featured,
    enabled: false,
  },
};

/**
 * Editorial — sequência cíclica de templates editoriais pré-definidos.
 * Cada template tem altura matematicamente fixa por largura → zero vazios.
 * Refinamentos v1.1.0:
 *  - Container com largura máxima por breakpoint (telas grandes).
 *  - Máximo de fotos por strip (densidade controlada).
 *  - Cooldown de destaques (1 destaque a cada ~5 fotos).
 *  - Tetos de altura aplicados no engine para evitar fotos gigantes.
 */
export const EDITORIAL_THEME: GalleryTheme = {
  ...DEFAULT_GALLERY_THEME,
  id: 'editorial',
  name: 'Editorial',
  version: '1.1.0',
  layout: {
    ...DEFAULT_GALLERY_THEME.layout,
    engine: 'editorial-templates',
    columns: { mobile: 2, tablet: 3, desktop: 4 },
    gap: 8,
    rowUnit: 320,
    density: 'comfortable',
    maxContainerWidth: {
      desktopSm: 1200,
      desktopMd: 1360,
      desktopLg: 1440,
    },
    maxItemsPerStrip: { mobile: 2, tablet: 3, desktop: 4 },
    featuredCooldown: 0,
  },
  surface: {
    ...DEFAULT_GALLERY_THEME.surface,
    background: '#F4F2EE',
    borderRadius: '0px',
  },
  featured: {
    enabled: true,
    maxCount: 20,
    spanRules: {
      '0': { colSpan: 1, rowSpan: 1 },
      '1': { colSpan: 2, rowSpan: 2 },
    },
  },
  typography: {
    titleFont: 'Instrument Serif',
  },
};

export const THEME_REGISTRY: Record<string, GalleryTheme> = {
  lunari: LUNARI_THEME,
  clean: CLEAN_THEME,
  editorial: EDITORIAL_THEME,
  // Alias retrocompat: galerias antigas salvas com 'editorial-magazine' caem no novo Editorial.
  'editorial-magazine': EDITORIAL_THEME,
};

/**
 * Fonte única de verdade dos temas que aparecem na UI (catálogo, seletores).
 * Aliases retrocompat continuam no THEME_REGISTRY para resolver galerias antigas,
 * mas NÃO devem ser renderizados como cards duplicados.
 */
export const CANONICAL_THEME_IDS = ['lunari', 'clean', 'editorial'] as const;

export const DEFAULT_THEME_ID = 'lunari';

