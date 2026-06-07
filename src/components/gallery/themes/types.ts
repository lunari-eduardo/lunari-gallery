export type GalleryDensity = 'compact' | 'comfortable' | 'airy';

export interface GalleryThemeLayout {
  engine: 'editorial-grid' | 'masonry' | 'carousel';
  columns: {
    mobile: number;
    tablet: number;
    desktop: number;
  };
  defaultDensity: GalleryDensity;
  baseGap: number;
}

export interface GalleryThemeTypography {
  titleFont: string;
  bodyFont: string;
  caseMode: 'uppercase' | 'normal' | 'capitalize';
}

export interface GalleryThemeSurface {
  background: string;
  headerStyle: 'glass' | 'solid' | 'transparent';
  buttonStyle: 'outline' | 'solid' | 'ghost';
  borderRadius: string;
}

export interface GalleryTheme {
  id: string;
  name: string;
  description: string;
  layout: GalleryThemeLayout;
  typography: GalleryThemeTypography;
  surface: GalleryThemeSurface;
}

export interface ThemeOverrides {
  density?: GalleryDensity;
  gap?: number;
  background?: string;
  primaryColor?: string;
  columns?: {
    mobile?: number;
    tablet?: number;
    desktop?: number;
  };
}
