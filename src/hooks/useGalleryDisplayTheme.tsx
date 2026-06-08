import { createContext, useContext, ReactNode, useMemo } from 'react';
import { GalleryTheme, DEFAULT_GALLERY_THEME } from '@/types/themes';
import { THEME_REGISTRY } from '@/components/gallery/themes/registry';
import { GallerySettings, GlobalSettings } from '@/types/gallery';
import { getSafeTheme, mergeThemeOverrides } from '@/lib/themeUtils';


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
    // 1. Resolve base theme from ID with safe fallback
    // Hierarchy: Gallery specific themeId > Global defaultThemeId > Lunari
    const themeId = activeThemeId || globalSettings?.defaultThemeId || 'lunari';
    let theme = getSafeTheme(themeId);

    // 2. Apply Global Overrides (Account level)
    if (globalSettings?.themeOverrides) {
      theme = mergeThemeOverrides(theme, globalSettings.themeOverrides as any);
    }
    
    // 3. Apply Gallery specific overrides (Instance level - highest priority)
    if (themeOverrides) {
      theme = mergeThemeOverrides(theme, themeOverrides as any);
    }

    // 4. Backward Compatibility (Legacy fields from configuracoes)
    if (gallerySettings?.photoSpacing !== undefined) {
      theme.layout.gap = Number(gallerySettings.photoSpacing);
    } else if (globalSettings?.defaultPhotoSpacing !== undefined && !themeOverrides) {
      theme.layout.gap = Number(globalSettings.defaultPhotoSpacing);
    }
    
    if (gallerySettings?.sessionFont) {
      theme.typography = { ...theme.typography, sessionFont: gallerySettings.sessionFont };
    }
    
    if (gallerySettings?.titleCaseMode) {
      theme.typography = { ...theme.typography, titleCaseMode: gallerySettings.titleCaseMode };
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
