import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthContext } from '@/contexts/AuthContext';
import { GlobalSettings, CustomTheme, EmailTemplate, WatermarkSettings, DiscountPreset, ThemeType } from '@/types/gallery';
import { toast } from 'sonner';
import { Json } from '@/integrations/supabase/types';

// Default settings for new users
const defaultSettings: Omit<GlobalSettings, 'customTheme' | 'emailTemplates' | 'discountPresets'> = {
  defaultGalleryPermission: 'private',
  clientTheme: 'system',
  defaultExpirationDays: 10,
  studioName: 'Meu Estúdio',
  studioLogo: undefined,
  themeType: 'system',
  activeThemeId: undefined,
  defaultWatermark: {
    type: 'standard',
    opacity: 40,
    position: 'center',
  },
  faviconUrl: undefined,
};

const defaultEmailTemplates: Omit<EmailTemplate, 'id'>[] = [
  {
    name: 'Galeria Enviada',
    type: 'gallery_sent',
    subject: 'Suas fotos estão prontas! - {galeria}',
    body: 'Olá {cliente}!\n\nSuas fotos da sessão "{galeria}" estão prontas para visualização.\n\nAcesse o link abaixo para ver suas fotos e fazer sua seleção:\n{link}\n\nVocê tem até {prazo} para fazer sua seleção.\n\nCom carinho,\n{estudio}',
  },
  {
    name: 'Lembrete de Prazo',
    type: 'selection_reminder',
    subject: 'Lembrete: Sua seleção expira em breve - {galeria}',
    body: 'Olá {cliente}!\n\nEste é um lembrete amigável de que sua seleção da galeria "{galeria}" expira em {dias_restantes} dias.\n\nNão perca o prazo! Acesse o link abaixo:\n{link}\n\nCom carinho,\n{estudio}',
  },
  {
    name: 'Seleção Confirmada',
    type: 'selection_confirmed',
    subject: 'Seleção confirmada! - {galeria}',
    body: 'Olá {cliente}!\n\nSua seleção da galeria "{galeria}" foi confirmada com sucesso!\n\nTotal de fotos selecionadas: {total_fotos}\nFotos extras: {fotos_extras}\nValor adicional: R$ {valor_extra}\n\nEm breve entraremos em contato com mais informações.\n\nCom carinho,\n{estudio}',
  },
];

// Helper to parse watermark from JSON
function parseWatermark(json: Json | null): WatermarkSettings {
  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    return defaultSettings.defaultWatermark;
  }
  const obj = json as Record<string, unknown>;
  let type = (obj.type as WatermarkSettings['type']) || 'standard';
  if (type !== 'none' && type !== 'standard' && type !== 'custom') {
    type = 'standard';
  }
  
  return {
    type,
    opacity: (obj.opacity as number) || 40,
    position: 'center',
    // Campos opcionais para watermark customizada (futuro)
    customHorizontalUrl: obj.customHorizontalUrl as string | undefined,
    customVerticalUrl: obj.customVerticalUrl as string | undefined,
  };
}

// Convert database rows to GlobalSettings (simplified for single theme)
function rowsToSettings(
  settingsRow: any | null,
  theme: any | null,
  emailTemplates: any[],
  discountPresets: any[]
): GlobalSettings {
  const baseSettings = settingsRow ? {
    defaultGalleryPermission: (settingsRow.default_gallery_permission as 'public' | 'private') ?? 'private',
    clientTheme: (settingsRow.client_theme as 'light' | 'dark' | 'system') ?? 'system',
    defaultExpirationDays: settingsRow.default_expiration_days ?? 10,
    studioName: settingsRow.studio_name ?? 'Meu Estúdio',
    studioLogo: settingsRow.studio_logo_url || undefined,
    themeType: (settingsRow.theme_type as ThemeType) ?? 'system',
    activeThemeId: settingsRow.active_theme_id || undefined,
    defaultWatermark: parseWatermark(settingsRow.default_watermark),
    faviconUrl: settingsRow.favicon_url || undefined,
    lastSessionFont: settingsRow.last_session_font || undefined,
  } : defaultSettings;

  // Single custom theme (if exists)
  const customTheme: CustomTheme | undefined = theme ? {
    id: theme.id,
    name: theme.name,
    backgroundMode: (theme.background_mode as 'light' | 'dark') || 'light',
    primaryColor: theme.primary_color,
    accentColor: theme.accent_color,
    emphasisColor: theme.emphasis_color,
  } : undefined;

  return {
    ...baseSettings,
    customTheme,
    emailTemplates: emailTemplates.map(e => ({
      id: e.id,
      name: e.name,
      type: e.type as EmailTemplate['type'],
      subject: e.subject,
      body: e.body,
    })),
    discountPresets: discountPresets.map(d => ({
      id: d.id,
      name: d.name,
      packages: Array.isArray(d.packages) ? d.packages : [],
      createdAt: new Date(d.created_at),
    })),
  };
}

export function useGallerySettings() {
  const { user } = useAuthContext();
  const queryClient = useQueryClient();

  // Fetch all settings data
  const { data: settings, isLoading } = useQuery({
    queryKey: ['gallery-settings', user?.id],
    queryFn: async (): Promise<GlobalSettings> => {
      if (!user?.id) throw new Error('User not authenticated');

      // Fetch all data in parallel (single theme now, not array)
      const [settingsRes, themeRes, templatesRes, presetsRes] = await Promise.all([
        supabase.from('gallery_settings').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('gallery_themes').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('gallery_email_templates').select('*').eq('user_id', user.id).order('type'),
        supabase.from('gallery_discount_presets').select('*').eq('user_id', user.id).order('created_at'),
      ]);

      if (settingsRes.error) throw settingsRes.error;
      if (themeRes.error && themeRes.error.code !== 'PGRST116') throw themeRes.error;
      if (templatesRes.error) throw templatesRes.error;
      if (presetsRes.error) throw presetsRes.error;

      return rowsToSettings(
        settingsRes.data,
        themeRes.data,
        templatesRes.data || [],
        presetsRes.data || []
      );
    },
    enabled: !!user?.id,
  });

  // Initialize settings for new user
  const initializeSettings = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('User not authenticated');

      // Create base settings
      const { error: settingsError } = await supabase
        .from('gallery_settings')
        .upsert({
          user_id: user.id,
          studio_name: defaultSettings.studioName,
          default_gallery_permission: defaultSettings.defaultGalleryPermission,
          client_theme: defaultSettings.clientTheme,
          default_expiration_days: defaultSettings.defaultExpirationDays,
          default_watermark: defaultSettings.defaultWatermark as unknown as Json,
          theme_type: 'system',
        });

      if (settingsError) throw settingsError;

      // Check if templates exist
      const { data: existingTemplates } = await supabase
        .from('gallery_email_templates')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);

      if (!existingTemplates || existingTemplates.length === 0) {
        // Create default email templates
        for (const template of defaultEmailTemplates) {
          await supabase.from('gallery_email_templates').insert({
            user_id: user.id,
            name: template.name,
            type: template.type,
            subject: template.subject,
            body: template.body,
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery-settings', user?.id] });
    },
  });

  // Update base settings - only updates fields that are explicitly provided
  const updateSettings = useMutation({
    mutationFn: async (data: Partial<GlobalSettings>) => {
      if (!user?.id) throw new Error('User not authenticated');

      // First check if record exists
      const { data: existing } = await supabase
        .from('gallery_settings')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle();

      // Build update object only with provided fields (explicit undefined check)
      const updateData: Record<string, unknown> = {};
      
      if (data.studioName !== undefined) {
        updateData.studio_name = data.studioName;
      }
      if (data.studioLogo !== undefined) {
        updateData.studio_logo_url = data.studioLogo || null;
      }
      if (data.faviconUrl !== undefined) {
        updateData.favicon_url = data.faviconUrl || null;
      }
      if (data.defaultGalleryPermission !== undefined) {
        updateData.default_gallery_permission = data.defaultGalleryPermission;
      }
      if (data.clientTheme !== undefined) {
        updateData.client_theme = data.clientTheme;
      }
      if (data.defaultExpirationDays !== undefined) {
        updateData.default_expiration_days = data.defaultExpirationDays;
      }
      if (data.activeThemeId !== undefined) {
        updateData.active_theme_id = data.activeThemeId || null;
      }
      if (data.themeType !== undefined) {
        updateData.theme_type = data.themeType;
      }
      if (data.defaultWatermark !== undefined) {
        updateData.default_watermark = data.defaultWatermark as unknown as Json;
      }
      if (data.lastSessionFont !== undefined) {
        updateData.last_session_font = data.lastSessionFont || null;
      }

      // Nothing to update
      if (Object.keys(updateData).length === 0) return;

      if (existing) {
        const { error } = await supabase
          .from('gallery_settings')
          .update(updateData)
          .eq('user_id', user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('gallery_settings')
          .insert({ user_id: user.id, ...updateData });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery-settings', user?.id] });
    },
    onError: (error) => {
      toast.error('Erro ao salvar configurações');
      console.error('Settings update error:', error);
    },
  });

  // Save or update single custom theme
  const saveCustomTheme = useMutation({
    mutationFn: async (theme: Omit<CustomTheme, 'id'> & { id?: string }) => {
      if (!user?.id) throw new Error('User not authenticated');

      if (theme.id) {
        // Update existing theme
        const { error } = await supabase
          .from('gallery_themes')
          .update({
            name: theme.name,
            background_mode: theme.backgroundMode,
            primary_color: theme.primaryColor,
            accent_color: theme.accentColor,
            emphasis_color: theme.emphasisColor,
          })
          .eq('id', theme.id)
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        // Create new theme (upsert to handle unique constraint)
        const { data, error } = await supabase
          .from('gallery_themes')
          .upsert({
            user_id: user.id,
            name: theme.name,
            background_mode: theme.backgroundMode,
            primary_color: theme.primaryColor,
            accent_color: theme.accentColor,
            emphasis_color: theme.emphasisColor,
          }, { onConflict: 'user_id' })
          .select()
          .single();

        if (error) throw error;

        // Update settings to use custom theme
        await supabase
          .from('gallery_settings')
          .update({ 
            theme_type: 'custom',
            active_theme_id: data.id 
          })
          .eq('user_id', user.id);
      }
    },
    onSuccess: () => {
      toast.success('Tema salvo com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['gallery-settings', user?.id] });
    },
    onError: (error) => {
      toast.error('Erro ao salvar tema');
      console.error('Save theme error:', error);
    },
  });

  // Delete custom theme (revert to system)
  const deleteCustomTheme = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('User not authenticated');

      // Delete theme
      const { error: deleteError } = await supabase
        .from('gallery_themes')
        .delete()
        .eq('user_id', user.id);

      if (deleteError) throw deleteError;

      // Update settings to use system theme
      const { error: updateError } = await supabase
        .from('gallery_settings')
        .update({ 
          theme_type: 'system',
          active_theme_id: null 
        })
        .eq('user_id', user.id);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      toast.success('Tema removido. Usando tema do sistema.');
      queryClient.invalidateQueries({ queryKey: ['gallery-settings', user?.id] });
    },
    onError: (error) => {
      toast.error('Erro ao remover tema');
      console.error('Delete theme error:', error);
    },
  });

  // Set theme type (system or custom)
  const setThemeType = useMutation({
    mutationFn: async (themeType: ThemeType) => {
      if (!user?.id) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('gallery_settings')
        .upsert({
          user_id: user.id,
          theme_type: themeType,
          active_theme_id: themeType === 'system' ? null : settings?.customTheme?.id || null,
        }, { onConflict: 'user_id' });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery-settings', user?.id] });
    },
    onError: (error) => {
      toast.error('Erro ao alterar tipo de tema');
      console.error('Set theme type error:', error);
    },
  });

  // Email template mutations
  const updateEmailTemplate = useMutation({
    mutationFn: async (template: EmailTemplate) => {
      if (!user?.id) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('gallery_email_templates')
        .update({
          name: template.name,
          subject: template.subject,
          body: template.body,
        })
        .eq('id', template.id)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery-settings', user?.id] });
    },
  });

  // Discount preset mutations
  const createDiscountPreset = useMutation({
    mutationFn: async (preset: Omit<DiscountPreset, 'id' | 'createdAt'>) => {
      if (!user?.id) throw new Error('User not authenticated');

      const { error } = await supabase.from('gallery_discount_presets').insert({
        user_id: user.id,
        name: preset.name,
        packages: preset.packages as unknown as Json,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery-settings', user?.id] });
    },
  });

  const updateDiscountPreset = useMutation({
    mutationFn: async (preset: DiscountPreset) => {
      if (!user?.id) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('gallery_discount_presets')
        .update({
          name: preset.name,
          packages: preset.packages as unknown as Json,
        })
        .eq('id', preset.id)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery-settings', user?.id] });
    },
  });

  const deleteDiscountPreset = useMutation({
    mutationFn: async (presetId: string) => {
      if (!user?.id) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('gallery_discount_presets')
        .delete()
        .eq('id', presetId)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery-settings', user?.id] });
    },
  });

  return {
    settings,
    isLoading,
    initializeSettings,
    updateSettings: updateSettings.mutate,
    isUpdating: updateSettings.isPending,
    // Theme operations (simplified)
    saveCustomTheme: saveCustomTheme.mutate,
    deleteCustomTheme: deleteCustomTheme.mutate,
    setThemeType: setThemeType.mutate,
    // Email template operations
    updateEmailTemplate: updateEmailTemplate.mutate,
    // Discount preset operations
    createDiscountPreset: createDiscountPreset.mutate,
    updateDiscountPreset: updateDiscountPreset.mutate,
    deleteDiscountPreset: deleteDiscountPreset.mutate,
  };
}
