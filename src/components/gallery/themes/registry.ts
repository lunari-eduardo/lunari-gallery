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
  version: '1.2.0',
  layout: {
    ...DEFAULT_GALLERY_THEME.layout,
    engine: 'editorial-justified',
    columns: { mobile: 2, tablet: 3, desktop: 4 },
    gap: 16,
    rowUnit: 320,
    density: 'airy',
    masonryColumns: { mobile: 2, tablet: 3, desktop: 4 },
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
 * Editorial Clássico — linhas justificadas estilo Pixieset/Pic-Time.
 * Cada linha preenche 100% da largura; última linha respeita altura média.
 * Suporta peso_visual=1 (foto destaque ganha multiplier de largura na linha).
 */
export const EDITORIAL_THEME: GalleryTheme = {
  ...DEFAULT_GALLERY_THEME,
  id: 'editorial',
  name: 'Editorial Clássico',
  version: '2.0.0',
  layout: {
    ...DEFAULT_GALLERY_THEME.layout,
    engine: 'editorial-justified',
    columns: { mobile: 2, tablet: 3, desktop: 4 },
    gap: 8,
    rowUnit: 340,
    density: 'comfortable',
  },
  surface: {
    ...DEFAULT_GALLERY_THEME.surface,
    background: '#F8F6F2',
    borderRadius: '0px',
  },
  featured: {
    enabled: true,
    maxCount: 15,
    spanRules: {
      '0': { colSpan: 1, rowSpan: 1 },
      '1': { colSpan: 2, rowSpan: 2 },
    },
  },
  typography: {
    titleFont: 'Instrument Serif',
  },
};

/**
 * Editorial Revista — sequência cíclica de templates editoriais pré-definidos.
 * Cada template tem altura matematicamente fixa por largura → zero vazios.
 * Destaques (peso_visual=1) caem nos slots grandes dos templates T1/T3/T5/M2/M4.
 */
export const EDITORIAL_MAGAZINE_THEME: GalleryTheme = {
  ...DEFAULT_GALLERY_THEME,
  id: 'editorial-magazine',
  name: 'Editorial Revista',
  version: '1.0.0',
  layout: {
    ...DEFAULT_GALLERY_THEME.layout,
    engine: 'editorial-templates',
    columns: { mobile: 2, tablet: 3, desktop: 4 },
    gap: 8,
    rowUnit: 320,
    density: 'comfortable',
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
  'editorial-magazine': EDITORIAL_MAGAZINE_THEME,
};

export const DEFAULT_THEME_ID = 'lunari';
