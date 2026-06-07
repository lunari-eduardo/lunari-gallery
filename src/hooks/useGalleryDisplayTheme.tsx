import { createContext, useContext, ReactNode, useMemo } from 'react';
import { GalleryTheme, DEFAULT_GALLERY_THEME } from '@/types/themes';
import { THEME_REGISTRY } from '@/components/gallery/themes/registry';
import { GallerySettings, GlobalSettings } from '@/types/gallery';


interface GalleryThemeContextType {
  theme: GalleryTheme;
  cssVars: Record<string, string>;
}

const GalleryThemeContext = createContext<GalleryThemeContextType | undefined>(undefined);

interface GalleryThemeProviderProps {
  children: ReactNode;
  gallerySettings?: Partial<GallerySettings>;
  globalSettings?: Partial<GlobalSettings>;
  activeThemeId?: string;
  themeOverrides?: Partial<GalleryTheme>;
}

export function GalleryThemeProvider({
  children,
  gallerySettings,
  globalSettings,
  activeThemeId,
  themeOverrides
}: GalleryThemeProviderProps) {
  
  const resolvedTheme = useMemo(() => {
    // 1. Resolve base theme from ID
    const themeId = activeThemeId || 'lunari';
    let theme = JSON.parse(JSON.stringify(THEME_REGISTRY[themeId] || THEME_REGISTRY['lunari'] || DEFAULT_GALLERY_THEME));

    
    // 3. Apply global overrides (Studio defaults)
    if (globalSettings?.defaultPhotoSpacing !== undefined) {
      theme.layout.gap = Number(globalSettings.defaultPhotoSpacing);
    }
    
    // 4. Apply gallery specific overrides (The "Single Source of Truth" fix)
    // We prioritize gallerySettings.photoSpacing if it exists
    if (gallerySettings?.photoSpacing !== undefined) {
      theme.layout.gap = Number(gallerySettings.photoSpacing);
    }
    
    if (gallerySettings?.sessionFont) {
      theme.typography = { ...theme.typography, sessionFont: gallerySettings.sessionFont };
    }
    
    if (gallerySettings?.titleCaseMode) {
      theme.typography = { ...theme.typography, titleCaseMode: gallerySettings.titleCaseMode };
    }

    // 5. Apply technical overrides (Deep merge of themeOverrides if exists)
    if (themeOverrides) {
      theme = { 
        ...theme, 
        ...themeOverrides,
        layout: { ...theme.layout, ...(themeOverrides.layout || {}) },
        featured: { ...theme.featured, ...(themeOverrides.featured || {}) },
        header: { ...theme.header, ...(themeOverrides.header || {}) },
        hero: { ...theme.hero, ...(themeOverrides.hero || {}) },
      };
    }

    return theme;
  }, [gallerySettings, globalSettings, activeThemeId, themeOverrides]);

  const cssVars = useMemo(() => {
    const vars: Record<string, string> = {
      '--gallery-gap': `${resolvedTheme.layout.gap}px`,
      '--gallery-cols-m': `${resolvedTheme.layout.columns.mobile}`,
      '--gallery-cols-t': `${resolvedTheme.layout.columns.tablet}`,
      '--gallery-cols-d': `${resolvedTheme.layout.columns.desktop}`,
      '--gallery-hover-scale': `${resolvedTheme.motion?.hoverScale ?? 1.005}`,
      '--gallery-row-unit': `${resolvedTheme.layout.rowUnit || 150}px`,
      '--gallery-bg': resolvedTheme.surface?.background || 'transparent',
    };
    return vars;
  }, [resolvedTheme]);


  return (
    <GalleryThemeContext.Provider value={{ theme: resolvedTheme, cssVars }}>
      <div style={cssVars as any} className="gallery-theme-root contents min-h-screen" id="gallery-root">
        {children}
      </div>
    </GalleryThemeContext.Provider>
  );
}

export function useGalleryDisplayTheme() {
  const context = useContext(GalleryThemeContext);
  if (!context) {
    throw new Error('useGalleryDisplayTheme must be used within a GalleryThemeProvider');
  }
  return context;
}
