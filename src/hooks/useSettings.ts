import { useEffect } from 'react';
import { useGallerySettings } from './useGallerySettings';
import { GlobalSettings } from '@/types/gallery';
import { mockGlobalSettings } from '@/data/mockData';

export interface UseSettingsReturn {
  settings: GlobalSettings;
  isLoading: boolean;
  updateSettings: (data: Partial<GlobalSettings>) => void;
  resetSettings: () => void;
}

// This hook provides backward compatibility while using Supabase
export function useSettings(): UseSettingsReturn {
  const {
    settings: dbSettings,
    isLoading,
    initializeSettings,
    updateSettings: updateDbSettings,
  } = useGallerySettings();

  // Initialize settings if user has none
  useEffect(() => {
    if (!isLoading && dbSettings && 
        dbSettings.customThemes.length === 0 && 
        dbSettings.emailTemplates.length === 0) {
      initializeSettings.mutate();
    }
  }, [isLoading, dbSettings, initializeSettings]);

  // Use database settings or fallback to mock
  const settings: GlobalSettings = dbSettings || mockGlobalSettings;

  const updateSettings = (data: Partial<GlobalSettings>) => {
    updateDbSettings(data);
  };

  const resetSettings = () => {
    // Reset to defaults by re-initializing
    initializeSettings.mutate();
  };

  return {
    settings,
    isLoading,
    updateSettings,
    resetSettings,
  };
}
