import { createContext, useContext, ReactNode, useMemo } from 'react';
import { GalleryTheme } from '@/types/themes';
import { GallerySettings, GlobalSettings } from '@/types/gallery';
import { getSafeTheme, mergeThemeOverrides } from '@/lib/themeUtils';


interface GalleryThemeContextType {
  theme: GalleryTheme;
  cssVars: Record<string, string>;
  footer?: {
    whatsapp?: string;
    maps?: string;
    instagrams?: string[];
  };
}

const GalleryThemeContext = createContext<GalleryThemeContextType | undefined>(undefined);

interface GalleryThemeProviderProps {
  children: ReactNode;
  gallerySettings?: Partial<GallerySettings>;
  globalSettings?: Partial<GlobalSettings>;
  activeThemeId?: string;
  themeOverrides?: Partial<GalleryTheme>;
  footer?: {
    whatsapp?: string;
    maps?: string;
    instagrams?: string[];
  };
}

export function GalleryThemeProvider({
  children,
  gallerySettings,
  globalSettings,
  activeThemeId,
  themeOverrides,
  footer
}: GalleryThemeProviderProps) {
  
  const resolvedTheme = useMemo(() => {
    const themeId = activeThemeId || globalSettings?.defaultThemeId || 'lunari';
    let theme = getSafeTheme(themeId);

    if (globalSettings?.themeOverrides) {
      theme = mergeThemeOverrides(theme, globalSettings.themeOverrides as any);
    }
    
    if (themeOverrides) {
      theme = mergeThemeOverrides(theme, themeOverrides as any);
    }

    // Gap handling: Prefer themeOverrides.layout.gap if it exists
    if ((themeOverrides as any)?.layout?.gap !== undefined) {
      theme.layout.gap = Number((themeOverrides as any).layout.gap);
    } else if (gallerySettings?.photoSpacing !== undefined) {
      theme.layout.gap = Number(gallerySettings.photoSpacing);
    } else if (globalSettings?.defaultPhotoSpacing !== undefined) {
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
      '--gallery-bg': resolvedTheme.surface.background || 'transparent',
      '--gallery-primary': resolvedTheme.surface.primaryColor || 'hsl(var(--primary))',
      '--gallery-primary-foreground': resolvedTheme.surface.primaryForeground || 'hsl(var(--primary-foreground))',
      '--gallery-accent': resolvedTheme.surface.accentColor || 'hsl(var(--accent))',
      '--gallery-gap': `${resolvedTheme.layout.gap}px`,
      '--gallery-cols-m': `${resolvedTheme.layout.columns.mobile}`,
      '--gallery-cols-t': `${resolvedTheme.layout.columns.tablet}`,
      '--gallery-cols-d': `${resolvedTheme.layout.columns.desktop}`,
      '--gallery-hover-scale': `${resolvedTheme.motion?.hoverScale ?? 1.005}`,
      '--gallery-row-unit': `${resolvedTheme.layout.rowUnit || 220}px`,
      '--gallery-radius': resolvedTheme.surface.borderRadius || '0px',
    };
    return vars;
  }, [resolvedTheme]);


  return (
    <GalleryThemeContext.Provider value={{ theme: resolvedTheme, cssVars, footer }}>
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
