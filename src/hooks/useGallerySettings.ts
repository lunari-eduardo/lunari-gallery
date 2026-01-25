import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthContext } from '@/contexts/AuthContext';
import { GlobalSettings, CustomTheme, EmailTemplate, WatermarkSettings, DiscountPreset } from '@/types/gallery';
import { toast } from 'sonner';
import { Json } from '@/integrations/supabase/types';

// Default settings for new users
const defaultSettings: Omit<GlobalSettings, 'customThemes' | 'emailTemplates' | 'discountPresets'> = {
  defaultGalleryPermission: 'private',
  clientTheme: 'system',
  defaultExpirationDays: 10,
  studioName: 'Meu Estúdio',
  studioLogo: undefined,
  activeThemeId: undefined,
  defaultWatermark: {
    type: 'standard',
    opacity: 40,
    position: 'center',
  },
  faviconUrl: undefined,
};

const defaultThemes: Omit<CustomTheme, 'id'>[] = [
  {
    name: 'Padrão',
    primaryColor: '#B87333',
    backgroundColor: '#FAFAF8',
    textColor: '#2D2A26',
    accentColor: '#8B9A7D',
    isDefault: true,
  },
];

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
  // Simplify: only 'none' or 'standard' supported
  let type = (obj.type as WatermarkSettings['type']) || 'standard';
  // Convert legacy types to 'standard'
  if (type !== 'none' && type !== 'standard') {
    type = 'standard';
  }
  
  return {
    type,
    opacity: (obj.opacity as number) || 40,
    position: 'center',
  };
}

// Convert database rows to GlobalSettings
function rowsToSettings(
  settingsRow: any | null,
  themes: any[],
  emailTemplates: any[],
  discountPresets: any[]
): GlobalSettings {
  const baseSettings = settingsRow ? {
    defaultGalleryPermission: (settingsRow.default_gallery_permission as 'public' | 'private') ?? 'private',
    clientTheme: (settingsRow.client_theme as 'light' | 'dark' | 'system') ?? 'system',
    defaultExpirationDays: settingsRow.default_expiration_days ?? 10,
    studioName: settingsRow.studio_name ?? 'Meu Estúdio',
    studioLogo: settingsRow.studio_logo_url || undefined,
    activeThemeId: settingsRow.active_theme_id || undefined,
    defaultWatermark: parseWatermark(settingsRow.default_watermark),
    faviconUrl: settingsRow.favicon_url || undefined,
  } : defaultSettings;

  return {
    ...baseSettings,
    customThemes: themes.map(t => ({
      id: t.id,
      name: t.name,
      primaryColor: t.primary_color,
      backgroundColor: t.background_color,
      textColor: t.text_color,
      accentColor: t.accent_color,
      isDefault: t.is_default ?? false,
    })),
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

      // Fetch all data in parallel
      const [settingsRes, themesRes, templatesRes, presetsRes] = await Promise.all([
        supabase.from('gallery_settings').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('gallery_themes').select('*').eq('user_id', user.id).order('created_at'),
        supabase.from('gallery_email_templates').select('*').eq('user_id', user.id).order('type'),
        supabase.from('gallery_discount_presets').select('*').eq('user_id', user.id).order('created_at'),
      ]);

      if (settingsRes.error) throw settingsRes.error;
      if (themesRes.error) throw themesRes.error;
      if (templatesRes.error) throw templatesRes.error;
      if (presetsRes.error) throw presetsRes.error;

      return rowsToSettings(
        settingsRes.data,
        themesRes.data || [],
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
        });

      if (settingsError) throw settingsError;

      // Check if themes exist
      const { data: existingThemes } = await supabase
        .from('gallery_themes')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);

      if (!existingThemes || existingThemes.length === 0) {
        // Create default themes
        for (const theme of defaultThemes) {
          await supabase.from('gallery_themes').insert({
            user_id: user.id,
            name: theme.name,
            primary_color: theme.primaryColor,
            background_color: theme.backgroundColor,
            text_color: theme.textColor,
            accent_color: theme.accentColor,
            is_default: theme.isDefault ?? false,
          });
        }
      }

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

  // Update base settings
  const updateSettings = useMutation({
    mutationFn: async (data: Partial<GlobalSettings>) => {
      if (!user?.id) throw new Error('User not authenticated');

      // First check if record exists
      const { data: existing } = await supabase
        .from('gallery_settings')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle();

      const baseData = {
        studio_name: data.studioName,
        studio_logo_url: data.studioLogo || null,
        favicon_url: data.faviconUrl || null,
        default_gallery_permission: data.defaultGalleryPermission,
        client_theme: data.clientTheme,
        default_expiration_days: data.defaultExpirationDays,
        active_theme_id: data.activeThemeId || null,
        default_watermark: data.defaultWatermark as unknown as Json,
      };

      // Filter out undefined values
      const filteredData = Object.fromEntries(
        Object.entries(baseData).filter(([_, v]) => v !== undefined)
      );

      if (existing) {
        // Update existing record
        const { error } = await supabase
          .from('gallery_settings')
          .update(filteredData)
          .eq('user_id', user.id);
        if (error) throw error;
      } else {
        // Insert new record
        const { error } = await supabase
          .from('gallery_settings')
          .insert({ user_id: user.id, ...filteredData });
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

  // Theme mutations
  const createTheme = useMutation({
    mutationFn: async (theme: Omit<CustomTheme, 'id'>) => {
      if (!user?.id) throw new Error('User not authenticated');

      const { error } = await supabase.from('gallery_themes').insert({
        user_id: user.id,
        name: theme.name,
        primary_color: theme.primaryColor,
        background_color: theme.backgroundColor,
        text_color: theme.textColor,
        accent_color: theme.accentColor,
        is_default: theme.isDefault || false,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Tema criado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['gallery-settings', user?.id] });
    },
    onError: (error) => {
      toast.error('Erro ao criar tema');
      console.error('Create theme error:', error);
    },
  });

  const updateTheme = useMutation({
    mutationFn: async (theme: CustomTheme) => {
      if (!user?.id) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('gallery_themes')
        .update({
          name: theme.name,
          primary_color: theme.primaryColor,
          background_color: theme.backgroundColor,
          text_color: theme.textColor,
          accent_color: theme.accentColor,
          is_default: theme.isDefault || false,
        })
        .eq('id', theme.id)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Tema atualizado!');
      queryClient.invalidateQueries({ queryKey: ['gallery-settings', user?.id] });
    },
    onError: (error) => {
      toast.error('Erro ao atualizar tema');
      console.error('Update theme error:', error);
    },
  });

  const deleteTheme = useMutation({
    mutationFn: async (themeId: string) => {
      if (!user?.id) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('gallery_themes')
        .delete()
        .eq('id', themeId)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Tema excluído!');
      queryClient.invalidateQueries({ queryKey: ['gallery-settings', user?.id] });
    },
    onError: (error) => {
      toast.error('Erro ao excluir tema');
      console.error('Delete theme error:', error);
    },
  });

  // Set theme as default
  const setDefaultTheme = useMutation({
    mutationFn: async (themeId: string) => {
      if (!user?.id) throw new Error('User not authenticated');

      // First, unset all themes as default
      await supabase
        .from('gallery_themes')
        .update({ is_default: false })
        .eq('user_id', user.id);

      // Then set the selected one as default
      const { error } = await supabase
        .from('gallery_themes')
        .update({ is_default: true })
        .eq('id', themeId)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Tema definido como padrão!');
      queryClient.invalidateQueries({ queryKey: ['gallery-settings', user?.id] });
    },
    onError: (error) => {
      toast.error('Erro ao definir tema padrão');
      console.error('Set default theme error:', error);
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
    // Theme operations
    createTheme: createTheme.mutate,
    updateTheme: updateTheme.mutate,
    deleteTheme: deleteTheme.mutate,
    setDefaultTheme: setDefaultTheme.mutate,
    // Email template operations
    updateEmailTemplate: updateEmailTemplate.mutate,
    // Discount preset operations
    createDiscountPreset: createDiscountPreset.mutate,
    updateDiscountPreset: updateDiscountPreset.mutate,
    deleteDiscountPreset: deleteDiscountPreset.mutate,
  };
}
