import React, { createContext, useContext, useMemo } from 'react';
import { GalleryTheme, ThemeOverrides, GalleryDensity } from './types';
import { THEME_REGISTRY, DEFAULT_THEME_ID } from './registry';

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
    const id = themeId || DEFAULT_THEME_ID;
    return THEME_REGISTRY[id] || THEME_REGISTRY[DEFAULT_THEME_ID];
  }, [themeId]);

  const resolvedConfig = useMemo(() => {
    const density = overrides.density || theme.layout.defaultDensity;
    
    // Density-based gap calculation
    const densityMultipliers = {
      compact: 0.5,
      comfortable: 1,
      airy: 2
    };
    const baseGap = overrides.gap !== undefined ? overrides.gap : theme.layout.baseGap;
    const gap = baseGap * densityMultipliers[density];

    return {
      gap,
      density,
      background: overrides.background || theme.surface.background,
      columns: {
        mobile: overrides.columns?.mobile || theme.layout.columns.mobile,
        tablet: overrides.columns?.tablet || theme.layout.columns.tablet,
        desktop: overrides.columns?.desktop || theme.layout.columns.desktop,
      }
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
