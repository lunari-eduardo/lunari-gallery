/**
 * Theme Utilities
 * Provides safe theme resolution with proper fallbacks
 */

import { THEME_REGISTRY, DEFAULT_THEME_ID } from '@/components/gallery/themes/registry';
import { GalleryTheme } from '@/types/themes';

/**
 * Resolve a theme ID safely with fallback to default
 * @param themeId The requested theme ID
 * @returns A valid GalleryTheme object
 */
export function getSafeTheme(themeId: string | null | undefined): GalleryTheme {
  if (!themeId || typeof themeId !== 'string') {
    return THEME_REGISTRY[DEFAULT_THEME_ID];
  }

  const theme = THEME_REGISTRY[themeId.toLowerCase()];
  if (theme) {
    return theme;
  }

  // Fallback: invalid ID always returns default
  console.warn(`[Theme] Unknown theme ID: ${themeId}, falling back to ${DEFAULT_THEME_ID}`);
  return THEME_REGISTRY[DEFAULT_THEME_ID];
}

/**
 * Deep merge theme with overrides
 * Preserves nested objects and arrays properly
 */
export function mergeThemeOverrides(
  baseTheme: GalleryTheme,
  overrides?: Record<string, any>
): GalleryTheme {
  if (!overrides || Object.keys(overrides).length === 0) {
    return JSON.parse(JSON.stringify(baseTheme));
  }

  const merged = JSON.parse(JSON.stringify(baseTheme));

  // Recursively merge overrides
  function deepMerge(target: any, source: any): any {
    if (!source || typeof source !== 'object' || Array.isArray(source)) {
      return source;
    }

    if (!target || typeof target !== 'object' || Array.isArray(target)) {
      target = {};
    }

    for (const key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        const sourceValue = source[key];
        const targetValue = target[key];

        if (
          sourceValue &&
          typeof sourceValue === 'object' &&
          !Array.isArray(sourceValue) &&
          targetValue &&
          typeof targetValue === 'object' &&
          !Array.isArray(targetValue)
        ) {
          target[key] = deepMerge(targetValue, sourceValue);
        } else if (sourceValue !== undefined) {
          target[key] = sourceValue;
        }
      }
    }

    return target;
  }

  return deepMerge(merged, overrides);
}

/**
 * Validate if a theme ID is registered
 */
export function isValidThemeId(themeId: string): boolean {
  return !!THEME_REGISTRY[themeId];
}

/**
 * Get all available theme IDs
 */
export function getAvailableThemeIds(): string[] {
  return Object.keys(THEME_REGISTRY);
}
