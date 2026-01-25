import { useGallerySettings } from '@/hooks/useGallerySettings';
import { LogoUploader } from './LogoUploader';
import { ThemeManager } from './ThemeManager';
import { WatermarkDefaults } from './WatermarkDefaults';
import { EmailTemplates } from './EmailTemplates';
import { FaviconUploader } from './FaviconUploader';

export function PersonalizationSettings() {
  const {
    settings,
    updateSettings,
    createTheme,
    updateTheme,
    deleteTheme,
    setDefaultTheme,
  } = useGallerySettings();

  if (!settings) return null;

  // Extract client default mode from clientTheme (light/dark only, not system)
  const clientDefaultMode = settings.clientTheme === 'dark' ? 'dark' : 'light';

  return (
    <div className="space-y-8">
      {/* Identity Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-muted-foreground">Identidade Visual</h3>
        
        {/* Logo */}
        <div className="lunari-card p-6">
          <LogoUploader
            logo={settings.studioLogo}
            onLogoChange={(logo) => updateSettings({ studioLogo: logo })}
          />
        </div>

        {/* Favicon */}
        <div className="lunari-card p-6">
          <FaviconUploader
            favicon={settings.faviconUrl}
            onFaviconChange={(favicon) => updateSettings({ faviconUrl: favicon })}
          />
        </div>
      </div>

      {/* Client Gallery Appearance */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-muted-foreground">Aparência da Galeria do Cliente</h3>
        
        {/* Themes */}
        <div className="lunari-card p-6">
          <ThemeManager
            themes={settings.customThemes}
            activeThemeId={settings.activeThemeId}
            clientDefaultMode={clientDefaultMode}
            onCreateTheme={createTheme}
            onUpdateTheme={updateTheme}
            onDeleteTheme={deleteTheme}
            onSetDefaultTheme={setDefaultTheme}
            onActiveThemeChange={(themeId) => updateSettings({ activeThemeId: themeId })}
            onClientDefaultModeChange={(mode) => updateSettings({ clientTheme: mode })}
          />
        </div>

        {/* Watermark */}
        <div className="lunari-card p-6">
          <WatermarkDefaults
            watermark={settings.defaultWatermark}
            onWatermarkChange={(watermark) => updateSettings({ defaultWatermark: watermark })}
          />
        </div>
      </div>

      {/* Communication */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-muted-foreground">Comunicação</h3>
        
        {/* Email Templates */}
        <div className="lunari-card p-6">
          <EmailTemplates
            templates={settings.emailTemplates}
            onTemplatesChange={(templates) => {
              // For now, email templates still use the old pattern
              // This can be refactored later if needed
            }}
          />
        </div>
      </div>
    </div>
  );
}
