import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export type WatermarkMode = 'system' | 'custom' | 'none';

export interface WatermarkSettings {
  mode: WatermarkMode;
  path: string | null;
  opacity: number;
  scale: number;
}

const defaultSettings: WatermarkSettings = {
  mode: 'system',
  path: null,
  opacity: 40,
  scale: 30,
};

export function useWatermarkSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<WatermarkSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch settings on mount
  useEffect(() => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    const fetchSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('photographer_accounts')
          .select('watermark_mode, watermark_path, watermark_opacity, watermark_scale')
          .eq('user_id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Error fetching watermark settings:', error);
          return;
        }

        if (data) {
          setSettings({
            mode: (data.watermark_mode as WatermarkMode) || 'system',
            path: data.watermark_path || null,
            opacity: data.watermark_opacity ?? 40,
            scale: data.watermark_scale ?? 30,
          });
        }
      } catch (error) {
        console.error('Error fetching watermark settings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, [user?.id]);

  // Save settings to database
  const saveSettings = useCallback(async (newSettings: Partial<WatermarkSettings>) => {
    if (!user?.id) return false;

    setIsSaving(true);
    try {
      const updateData: Record<string, unknown> = {};
      
      if (newSettings.mode !== undefined) {
        updateData.watermark_mode = newSettings.mode;
      }
      if (newSettings.path !== undefined) {
        updateData.watermark_path = newSettings.path;
      }
      if (newSettings.opacity !== undefined) {
        updateData.watermark_opacity = newSettings.opacity;
      }
      if (newSettings.scale !== undefined) {
        updateData.watermark_scale = newSettings.scale;
      }

      const { error } = await supabase
        .from('photographer_accounts')
        .update(updateData)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error saving watermark settings:', error);
        toast.error('Erro ao salvar configurações');
        return false;
      }

      setSettings(prev => ({ ...prev, ...newSettings }));
      toast.success('Configurações de marca d\'água salvas');
      return true;
    } catch (error) {
      console.error('Error saving watermark settings:', error);
      toast.error('Erro ao salvar configurações');
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [user?.id]);

  // Upload custom watermark
  const uploadWatermark = useCallback(async (file: File): Promise<string | null> => {
    if (!user?.id) return null;

    // Validate file
    if (!file.type.includes('png')) {
      toast.error('Apenas arquivos PNG são permitidos');
      return null;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Arquivo muito grande (máximo 2MB)');
      return null;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error('Sessão expirada');
        return null;
      }

      const formData = new FormData();
      formData.append('file', file);

      // Get worker URL from environment or use default
      const workerUrl = import.meta.env.VITE_R2_PUBLIC_URL || 'https://media.lunarihub.com';
      
      const response = await fetch(`${workerUrl}/upload-watermark`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro no upload');
      }

      const result = await response.json();
      
      // Save path to database
      await saveSettings({ 
        mode: 'custom', 
        path: result.path 
      });
      
      return result.path;
    } catch (error) {
      console.error('Error uploading watermark:', error);
      toast.error(error instanceof Error ? error.message : 'Erro no upload');
      return null;
    }
  }, [user?.id, saveSettings]);

  // Delete custom watermark
  const deleteWatermark = useCallback(async () => {
    if (!user?.id) return false;

    try {
      await saveSettings({ 
        mode: 'system', 
        path: null 
      });
      
      toast.success('Marca d\'água personalizada removida');
      return true;
    } catch (error) {
      console.error('Error deleting watermark:', error);
      toast.error('Erro ao remover marca d\'água');
      return false;
    }
  }, [user?.id, saveSettings]);

  return {
    settings,
    isLoading,
    isSaving,
    saveSettings,
    uploadWatermark,
    deleteWatermark,
  };
}
