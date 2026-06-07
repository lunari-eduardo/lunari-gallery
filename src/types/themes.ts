import { TitleCaseMode } from "./gallery";

export interface GalleryThemeLayout {
  engine: 'editorial-grid' | 'masonry-classic';
  columns: {
    mobile: number;
    tablet: number;
    desktop: number;
  };
  gap?: number;
  rowUnit?: number;
  density?: 'comfortable' | 'compact' | 'airy';
}

export interface GalleryThemeFeatured {
  enabled: boolean;
  maxCount: number;
  spanRules: Record<string, { colSpan?: number; rowSpan?: number }>;
}

export interface GalleryThemeHeader {
  variant: 'floating-glass' | 'inline' | 'hidden';
  revealOnScroll: boolean;
}

export interface GalleryThemeHero {
  variant: 'fullscreen' | 'split' | 'none';
  transitionToGrid: 'fade' | 'cut';
}

export interface GalleryTheme {
  id: string;
  name: string;
  version: string;
  layout: GalleryThemeLayout;
  featured: GalleryThemeFeatured;
  header: GalleryThemeHeader;
  hero: GalleryThemeHero;
  typography?: {
    sessionFont?: string;
    titleCaseMode?: TitleCaseMode;
  };
  motion?: {
    hoverScale: number;
    hoverDuration: number;
  };
}

export const DEFAULT_GALLERY_THEME: GalleryTheme = {
  id: 'default',
  name: 'Clássico',
  version: '1.0.0',
  layout: {
    engine: 'editorial-grid',
    columns: {
      mobile: 2,
      tablet: 3,
      desktop: 4
    },
    gap: 6,
    rowUnit: 150,
    density: 'comfortable'
  },
  featured: {
    enabled: true,
    maxCount: 10,
    spanRules: {
      "1": { colSpan: 2, rowSpan: 2 }, // Destaque nível 1
      "2": { colSpan: 2, rowSpan: 3 }, // Futuro: Destaque maior
    }
  },
  header: {
    variant: 'floating-glass',
    revealOnScroll: true
  },
  hero: {
    variant: 'fullscreen',
    transitionToGrid: 'fade'
  },
  motion: {
    hoverScale: 1.005,
    hoverDuration: 0.5
  }
};
