import { useGallerySettings } from '@/hooks/useGallerySettings';
import { LogoUploader } from './LogoUploader';
import { ThemeConfig } from './ThemeConfig';
import { WatermarkSettings } from './WatermarkSettings';
import { EmailTemplates } from './EmailTemplates';
import { FaviconUploader } from './FaviconUploader';

export function PersonalizationSettings() {
  const {
    settings,
    updateSettings,
    saveCustomTheme,
    deleteCustomTheme,
    setThemeType,
  } = useGallerySettings();

  if (!settings) return null;

  return (
    <div className="space-y-8">
      {/* Identity Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-muted-foreground">Identidade Visual</h3>
        
        {/* Logo + Favicon */}
        <div className="lunari-card p-6 space-y-6">
          <LogoUploader
            logo={settings.studioLogo}
            onLogoChange={(logo) => updateSettings({ studioLogo: logo })}
          />
          <div className="border-t border-border" />
          <FaviconUploader
            favicon={settings.faviconUrl}
            onFaviconChange={(favicon) => updateSettings({ faviconUrl: favicon })}
          />
        </div>
      </div>

      {/* Client Gallery Appearance */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-muted-foreground">Aparência da Galeria do Cliente</h3>
        
        {/* Theme Config (simplified) */}
        <div className="lunari-card p-6">
          <ThemeConfig
            themeType={settings.themeType}
            customTheme={settings.customTheme}
            onThemeTypeChange={(type) => setThemeType(type)}
            onSaveCustomTheme={saveCustomTheme}
            onDeleteCustomTheme={deleteCustomTheme}
          />
        </div>

        {/* Watermark */}
        <div className="lunari-card p-6">
          <WatermarkSettings />
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
            }}
          />
        </div>
      </div>
    </div>
  );
}
