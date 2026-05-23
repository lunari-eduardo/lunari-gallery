import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  applyTheme,
  clearTheme,
  DEFAULT_THEME,
  loadTheme,
  saveTheme,
  THEME_PRESETS,
  resolveEffectiveMode,
  VisualThemeConfig,
  ThemePresetId,
  VisualThemeMode,
} from '@/lib/visualTheme';
import { useRemoteThemeSync } from '@/hooks/useThemePreference';

interface VisualThemeContextValue {
  theme: VisualThemeConfig;
  setPreset: (id: ThemePresetId) => void;
  setMode: (mode: VisualThemeMode) => void;
  reset: () => void;
  presets: typeof THEME_PRESETS;
}

const VisualThemeContext = createContext<VisualThemeContextValue | null>(null);

export function VisualThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<VisualThemeConfig>(() => loadTheme());

  // Aplica no mount + a cada mudança e persiste em localStorage
  useEffect(() => {
    applyTheme(theme);
    saveTheme(theme);
  }, [theme]);

  // Reagir ao prefers-color-scheme quando modo === system
  useEffect(() => {
    if (theme.mode !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme(theme);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  // Sincroniza com Supabase (compartilhado com o Studio) + realtime
  useRemoteThemeSync(theme, setThemeState);

  const setPreset = useCallback((id: ThemePresetId) => {
    setThemeState((prev) => ({ ...prev, presetId: id }));
  }, []);

  const setMode = useCallback((mode: VisualThemeMode) => {
    setThemeState((prev) => ({ ...prev, mode }));
  }, []);

  const reset = useCallback(() => {
    clearTheme();
    setThemeState(DEFAULT_THEME);
  }, []);

  const value = useMemo<VisualThemeContextValue>(
    () => ({ theme, setPreset, setMode, reset, presets: THEME_PRESETS }),
    [theme, setPreset, setMode, reset],
  );

  return <VisualThemeContext.Provider value={value}>{children}</VisualThemeContext.Provider>;
}

export function useVisualTheme() {
  const ctx = useContext(VisualThemeContext);
  if (!ctx) throw new Error('useVisualTheme deve ser usado dentro de VisualThemeProvider');
  return ctx;
}

/* ───────── Retrocompat com a API antiga (ThemeContext) ───────── */

/** Alias para componentes antigos. Mantém o nome `ThemeProvider` em App.tsx. */
export const ThemeProvider = VisualThemeProvider;

/** API legacy: `{ theme, setTheme, resolvedTheme }`.
 *  Usado por `ThemeToggle` e `sonner` (next-themes-like). */
export function useTheme() {
  const ctx = useContext(VisualThemeContext);
  if (!ctx) throw new Error('useTheme deve ser usado dentro de ThemeProvider');
  const resolvedTheme = resolveEffectiveMode(ctx.theme.mode);
  return {
    theme: ctx.theme.mode,
    setTheme: ctx.setMode,
    resolvedTheme,
  };
}
