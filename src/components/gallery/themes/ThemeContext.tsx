import React, { createContext, useContext, useMemo } from 'react';
import { GalleryTheme, ThemeOverrides, GalleryDensity } from './types';
import { THEME_REGISTRY, DEFAULT_THEME_ID } from './registry';
import { GalleryTheme as GlobalGalleryTheme } from '@/types/themes';


interface ThemeContextType {
  theme: GalleryTheme;
  overrides: ThemeOverrides;
  resolvedConfig: {
    gap: number;
    columns: { mobile: number; tablet: number; desktop: number };
    background: string;
    density: GalleryDensity;
  };
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  themeId?: string | null;
  overrides?: ThemeOverrides;
  children: React.ReactNode;
}

export const GalleryThemeProvider: React.FC<ThemeProviderProps> = ({ 
  themeId, 
  overrides = {}, 
  children 
}) => {
  const theme = useMemo(() => {
    // 1. Resolve base theme from ID
    const id = themeId || DEFAULT_THEME_ID;
    const basePreset = (THEME_REGISTRY[id] || THEME_REGISTRY[DEFAULT_THEME_ID]) as any;
    
    // Deep clone to avoid mutating registry
    return JSON.parse(JSON.stringify(basePreset));
  }, [themeId]);

  const resolvedConfig = useMemo(() => {
    // 2. Resolve density (Override > Preset)
    const density = (overrides as any).layout?.density || theme.layout?.density || 'comfortable';
    
    // 3. Resolve gap (Override > Preset)
    const gap = (overrides as any).layout?.gap !== undefined 
      ? (overrides as any).layout.gap 
      : (theme.layout?.gap ?? 8);

    // 4. Density-based column logic (Simplified)
    const columns = {
      mobile: (overrides as any).layout?.columns?.mobile || theme.layout?.columns?.mobile || 2,
      tablet: (overrides as any).layout?.columns?.tablet || theme.layout?.columns?.tablet || 3,
      desktop: (overrides as any).layout?.columns?.desktop || theme.layout?.columns?.desktop || 4,
    };

    // If density is Airy, we might want to reduce columns if not explicitly overridden
    if (density === 'airy' && !(overrides as any).layout?.columns) {
      columns.desktop = Math.max(1, columns.desktop - 1);
    }

    return {
      gap,
      density: density as GalleryDensity,
      background: (overrides as any).surface?.background || theme.surface?.background || '#ffffff',
      columns
    };
  }, [theme, overrides]);


  return (
    <ThemeContext.Provider value={{ theme, overrides, resolvedConfig }}>
      <div 
        style={{ 
          backgroundColor: resolvedConfig.background,
          minHeight: '100vh',
          transition: 'background-color 0.3s ease'
        }}
      >
        {children}
      </div>
    </ThemeContext.Provider>
  );
};

export const useGalleryTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useGalleryTheme must be used within a GalleryThemeProvider');
  }
  return context;
};
