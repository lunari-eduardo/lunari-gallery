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
  version: '1.0.0',
  layout: {
    ...DEFAULT_GALLERY_THEME.layout,
    engine: 'editorial-grid',
    columns: { mobile: 2, tablet: 3, desktop: 4 },
    gap: 4,
    density: 'comfortable'
  },
  surface: {
    ...DEFAULT_GALLERY_THEME.surface,
    background: '#FAF9F7',
    borderRadius: '0px'
  },
  featured: {
    ...DEFAULT_GALLERY_THEME.featured,
    enabled: true,
    maxCount: 10
  }
};

export const CLEAN_THEME: GalleryTheme = {
  ...DEFAULT_GALLERY_THEME,
  id: 'clean',
  name: 'Clean',
  version: '1.0.0',
  layout: {
    ...DEFAULT_GALLERY_THEME.layout,
    engine: 'masonry-classic',
    columns: { mobile: 2, tablet: 3, desktop: 5 },
    gap: 0,
    density: 'compact'
  },
  surface: {
    ...DEFAULT_GALLERY_THEME.surface,
    background: '#FFFFFF',
    borderRadius: '0px'
  },
  featured: {
    ...DEFAULT_GALLERY_THEME.featured,
    enabled: false
  }
};

export const EDITORIAL_THEME: GalleryTheme = {
  ...DEFAULT_GALLERY_THEME,
  id: 'editorial',
  name: 'Editorial',
  version: '1.0.0',
  layout: {
    ...DEFAULT_GALLERY_THEME.layout,
    engine: 'editorial-grid',
    columns: { mobile: 2, tablet: 3, desktop: 4 },
    gap: 4,
    density: 'comfortable'
  },
  surface: {
    ...DEFAULT_GALLERY_THEME.surface,
    background: '#F8F6F2',
    borderRadius: '0px'
  },
  featured: {
    enabled: true,
    maxCount: 15,
    spanRules: {
      "1": { colSpan: 4, rowSpan: 2 }, // Hero interno (desktop)
      "2": { colSpan: 2, rowSpan: 2 }, 
    }
  },
  typography: {
    titleFont: 'Instrument Serif', // Exemplo de tipografia editorial
  }
};

export const FINE_ART_THEME: GalleryTheme = {
  ...DEFAULT_GALLERY_THEME,
  id: 'fineart',
  name: 'Fine Art',
  version: '1.0.0',
  layout: {
    ...DEFAULT_GALLERY_THEME.layout,
    engine: 'editorial-grid',
    columns: { mobile: 2, tablet: 2, desktop: 3 },
    gap: 12,
    density: 'airy'
  },
  surface: {
    ...DEFAULT_GALLERY_THEME.surface,
    background: '#F5F1EA',
    borderRadius: '0px'
  },
  featured: {
    ...DEFAULT_GALLERY_THEME.featured,
    enabled: true,
    maxCount: 5
  }
};

export const THEME_REGISTRY: Record<string, GalleryTheme> = {
  lunari: LUNARI_THEME,
  clean: CLEAN_THEME,
  editorial: EDITORIAL_THEME,
  fineart: FINE_ART_THEME,
};

export const DEFAULT_THEME_ID = 'lunari';
