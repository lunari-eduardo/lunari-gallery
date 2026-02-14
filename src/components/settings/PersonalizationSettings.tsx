import { useState, useEffect } from 'react';
import { useGallerySettings } from '@/hooks/useGallerySettings';
import { LogoUploader } from './LogoUploader';
import { ThemeConfig } from './ThemeConfig';
import { WatermarkSettings } from './WatermarkSettings';
import { EmailTemplates } from './EmailTemplates';
import { FaviconUploader } from './FaviconUploader';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { defaultWelcomeMessage } from '@/data/mockData';

export function PersonalizationSettings() {
  const {
    settings,
    updateSettings,
    saveCustomTheme,
    deleteCustomTheme,
    setThemeType,
  } = useGallerySettings();

  const [welcomeEnabled, setWelcomeEnabled] = useState(true);
  const [welcomeTemplate, setWelcomeTemplate] = useState('');

  useEffect(() => {
    if (settings) {
      setWelcomeEnabled(settings.welcomeMessageEnabled ?? true);
      setWelcomeTemplate(settings.defaultWelcomeMessage || defaultWelcomeMessage);
    }
  }, [settings]);

  if (!settings) return null;

  const handleWelcomeEnabledChange = (enabled: boolean) => {
    setWelcomeEnabled(enabled);
    updateSettings({ welcomeMessageEnabled: enabled });
  };

  const handleWelcomeTemplateBlur = () => {
    updateSettings({ defaultWelcomeMessage: welcomeTemplate });
  };

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
        
        {/* Welcome Message Template */}
        <div className="lunari-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base font-medium">Mensagem de Boas-Vindas Padrão</Label>
              <p className="text-sm text-muted-foreground mt-1">
                Modelo pré-preenchido ao criar novas galerias
              </p>
            </div>
            <Switch
              checked={welcomeEnabled}
              onCheckedChange={handleWelcomeEnabledChange}
            />
          </div>

          {welcomeEnabled && (
            <div className="space-y-3">
              <Textarea
                value={welcomeTemplate}
                onChange={(e) => setWelcomeTemplate(e.target.value)}
                onBlur={handleWelcomeTemplateBlur}
                placeholder="Escreva o modelo de mensagem padrão..."
                rows={6}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Slugs disponíveis: <code className="bg-muted px-1 rounded">{'{cliente}'}</code> (primeiro nome), <code className="bg-muted px-1 rounded">{'{sessao}'}</code> (nome da sessão), <code className="bg-muted px-1 rounded">{'{estudio}'}</code> (nome do estúdio)
              </p>
            </div>
          )}
        </div>

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