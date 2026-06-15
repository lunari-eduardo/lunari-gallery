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
  /**
   * Clean v2: grade uniforme com span horizontal.
   * Verticais ocupam 1 célula (AR = cellAspect). Horizontais ocupam
   * `landscapeSpan` colunas × 1 linha. Lookahead-swap mínimo evita buracos.
   */
  uniformGridSpan?: {
    cols: { mobile: number; tablet: number; desktop: number };
    /** width/height da célula base. 3/4 = retrato. */
    cellAspect: number;
    landscapeSpan: 1 | 2;
    lookaheadSwap?: boolean;
  };
  /** Editorial Clássico: foto peso_visual=1 ocupa bloco 2 colunas × 2 linhas reais. */
  pairedRowsFeatured?: boolean;
  /** Editorial: largura máxima do container por breakpoint (px). null = sem cap. */
  maxContainerWidth?: {
    /** >=1280 e <1600 */
    desktopSm?: number | null;
    /** >=1600 e <2000 */
    desktopMd?: number | null;
    /** >=2000 */
    desktopLg?: number | null;
  };
  /** Editorial: máximo de fotos por strip (linha de template). */
  maxItemsPerStrip?: { mobile: number; tablet: number; desktop: number };
  /** Editorial: cooldown de destaques — N fotos não-destaque entre dois destaques. */
  featuredCooldown?: number;
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
