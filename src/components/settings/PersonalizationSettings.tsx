import { GlobalSettings } from '@/types/gallery';
import { LogoUploader } from './LogoUploader';
import { ThemeManager } from './ThemeManager';
import { WatermarkDefaults } from './WatermarkDefaults';
import { EmailTemplates } from './EmailTemplates';
import { FaviconUploader } from './FaviconUploader';
import { Separator } from '@/components/ui/separator';

interface PersonalizationSettingsProps {
  settings: GlobalSettings;
  updateSettings: (data: Partial<GlobalSettings>) => void;
}

export function PersonalizationSettings({ settings, updateSettings }: PersonalizationSettingsProps) {
  return (
    <div className="space-y-8">
      {/* Logo */}
      <div className="lunari-card p-6">
        <LogoUploader
          logo={settings.studioLogo}
          onLogoChange={(logo) => updateSettings({ studioLogo: logo })}
        />
      </div>

      {/* Themes */}
      <div className="lunari-card p-6">
        <ThemeManager
          themes={settings.customThemes}
          activeThemeId={settings.activeThemeId}
          onThemesChange={(themes) => updateSettings({ customThemes: themes })}
          onActiveThemeChange={(themeId) => updateSettings({ activeThemeId: themeId })}
        />
      </div>

      {/* Watermark */}
      <div className="lunari-card p-6">
        <WatermarkDefaults
          watermark={settings.defaultWatermark}
          onWatermarkChange={(watermark) => updateSettings({ defaultWatermark: watermark })}
        />
      </div>

      {/* Email Templates */}
      <div className="lunari-card p-6">
        <EmailTemplates
          templates={settings.emailTemplates}
          onTemplatesChange={(templates) => updateSettings({ emailTemplates: templates })}
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
  );
}
