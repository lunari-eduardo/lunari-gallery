import { useState, useEffect, useCallback } from 'react';
import { GlobalSettings } from '@/types/gallery';
import { getStorageItem, setStorageItem, isStorageInitialized } from '@/lib/storage';
import { mockGlobalSettings } from '@/data/mockData';

const STORAGE_KEY = 'settings';

export interface UseSettingsReturn {
  settings: GlobalSettings;
  isLoading: boolean;
  updateSettings: (data: Partial<GlobalSettings>) => void;
  resetSettings: () => void;
}

export function useSettings(): UseSettingsReturn {
  const [settings, setSettings] = useState<GlobalSettings>(mockGlobalSettings);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize from localStorage or mock data
  useEffect(() => {
    const loadSettings = () => {
      if (!isStorageInitialized()) {
        // Will be initialized by useClients hook
        setSettings(mockGlobalSettings);
      } else {
        const stored = getStorageItem<GlobalSettings>(STORAGE_KEY);
        if (stored) {
          setSettings(stored);
        } else {
          // If other data was initialized but settings weren't, save defaults
          setStorageItem(STORAGE_KEY, mockGlobalSettings);
          setSettings(mockGlobalSettings);
        }
      }
      setIsLoading(false);
    };

    loadSettings();
  }, []);

  const updateSettings = useCallback((data: Partial<GlobalSettings>) => {
    const newSettings = { ...settings, ...data };
    setStorageItem(STORAGE_KEY, newSettings);
    setSettings(newSettings);
  }, [settings]);

  const resetSettings = useCallback(() => {
    setStorageItem(STORAGE_KEY, mockGlobalSettings);
    setSettings(mockGlobalSettings);
  }, []);

  return {
    settings,
    isLoading,
    updateSettings,
    resetSettings,
  };
}
