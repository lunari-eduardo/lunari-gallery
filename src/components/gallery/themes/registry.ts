import { GalleryTheme, DEFAULT_GALLERY_THEME } from '@/types/themes';

export const LUNARI_THEME: GalleryTheme = {
  ...DEFAULT_GALLERY_THEME,
  id: 'lunari',
  name: 'Lunari',
  layout: {
    ...DEFAULT_GALLERY_THEME.layout,
    engine: 'editorial-grid',
    columns: { mobile: 2, tablet: 3, desktop: 4 },
    gap: 8,
    density: 'comfortable'
  }
};

export const CLEAN_THEME: GalleryTheme = {
  ...DEFAULT_GALLERY_THEME,
  id: 'clean',
  name: 'Clean',
  layout: {
    ...DEFAULT_GALLERY_THEME.layout,
    engine: 'masonry-classic',
    columns: { mobile: 2, tablet: 3, desktop: 5 },
    gap: 4,
    density: 'compact'
  }
};

export const EDITORIAL_THEME: GalleryTheme = {
  ...DEFAULT_GALLERY_THEME,
  id: 'editorial',
  name: 'Editorial',
  layout: {
    ...DEFAULT_GALLERY_THEME.layout,
    engine: 'editorial-grid',
    columns: { mobile: 1, tablet: 2, desktop: 3 },
    gap: 24,
    density: 'airy'
  }
};

export const FINE_ART_THEME: GalleryTheme = {
  ...DEFAULT_GALLERY_THEME,
  id: 'fineart',
  name: 'Fine Art',
  layout: {
    ...DEFAULT_GALLERY_THEME.layout,
    engine: 'editorial-grid',
    columns: { mobile: 1, tablet: 1, desktop: 2 },
    gap: 40,
    density: 'airy'
  }
};

export const THEME_REGISTRY: Record<string, GalleryTheme> = {
  lunari: LUNARI_THEME,
  clean: CLEAN_THEME,
  editorial: EDITORIAL_THEME,
  fineart: FINE_ART_THEME,
};

export const DEFAULT_THEME_ID = 'lunari';

