import { TitleCaseMode } from "./gallery";

export interface GalleryThemeLayout {
  /**
   * Engines de layout disponíveis:
   * - 'editorial-justified': linhas justificadas (zero vazios, ordem fixa)
   * - 'editorial-templates': padrões editoriais pré-definidos (zero vazios, ordem fixa)
   * - 'editorial-grid' / 'masonry-classic': @deprecated — normalizados para 'editorial-justified'
   */
  engine: 'editorial-justified' | 'editorial-templates' | 'editorial-grid' | 'masonry-classic';
  columns: {
    mobile: number;
    tablet: number;
    desktop: number;
  };
  gap?: number;
  rowUnit?: number;
  density?: 'comfortable' | 'compact' | 'airy';
  /** Clean: grade rígida de tiles uniformes. */
  uniformTile?: {
    aspect: number;
    tilesPerRow: { mobile: number; tablet: number; desktop: number };
  };
  /** Lunari: limite máximo de fotos por linha no engine justificado. */
  maxItemsPerRow?: { mobile: number; tablet: number; desktop: number };
  /** Clean: masonry de colunas fixas preservando proporção original (estilo Pinterest). */
  masonryColumns?: { mobile: number; tablet: number; desktop: number };
  /** Editorial Clássico: foto peso_visual=1 ocupa bloco 2 colunas × 2 linhas reais. */
  pairedRowsFeatured?: boolean;
}

export interface GalleryThemeSurface {
  background: string;
  headerStyle: 'glass' | 'solid' | 'transparent';
  buttonStyle: 'outline' | 'solid' | 'ghost';
  borderRadius: string;
  primaryColor?: string;
  primaryForeground?: string;
  accentColor?: string;
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

export type ThemeOverrides = Partial<GalleryTheme>;

export interface GalleryTheme {
  id: string;
  name: string;
  version: string;
  layout: GalleryThemeLayout;
  featured: GalleryThemeFeatured;
  header: GalleryThemeHeader;
  hero: GalleryThemeHero;
  surface: GalleryThemeSurface;
  typography?: {
    sessionFont?: string;
    titleCaseMode?: TitleCaseMode;
    titleFont?: string;
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
    engine: 'editorial-justified',
    columns: {
      mobile: 2,
      tablet: 3,
      desktop: 4
    },
    gap: 6,
    rowUnit: 150,
    density: 'comfortable'
  },
  surface: {
    background: '#FAF9F7',
    headerStyle: 'glass',
    buttonStyle: 'outline',
    borderRadius: '0px'
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
