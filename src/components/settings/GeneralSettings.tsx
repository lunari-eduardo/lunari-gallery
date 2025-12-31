import { Globe, Palette, Languages, Calendar, Building2, Upload } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { GlobalSettings } from '@/types/gallery';

interface GeneralSettingsProps {
  settings: GlobalSettings;
  updateSettings: (data: Partial<GlobalSettings>) => void;
}

export function GeneralSettings({ settings, updateSettings }: GeneralSettingsProps) {
  return (
    <div className="space-y-6">
      {/* Studio Info */}
      <div className="lunari-card p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-medium">Informações do Estúdio</h2>
            <p className="text-sm text-muted-foreground">
              Dados exibidos nas galerias e comunicações
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="studioName">Nome do Estúdio</Label>
            <Input
              id="studioName"
              value={settings.studioName}
              onChange={(e) => updateSettings({ studioName: e.target.value })}
              placeholder="Seu estúdio"
            />
          </div>
        </div>
      </div>

      {/* Gallery Settings */}
      <div className="lunari-card p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Globe className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-medium">Galerias Públicas</h2>
            <p className="text-sm text-muted-foreground">
              Controle de acesso às galerias
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Permitir galerias públicas</p>
            <p className="text-sm text-muted-foreground">
              Clientes podem acessar galerias sem autenticação
            </p>
          </div>
          <Switch
            checked={settings.publicGalleryEnabled}
            onCheckedChange={(checked) => updateSettings({ publicGalleryEnabled: checked })}
          />
        </div>
      </div>

      {/* Theme Settings */}
      <div className="lunari-card p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Palette className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-medium">Aparência do Cliente</h2>
            <p className="text-sm text-muted-foreground">
              Tema forçado para visualização do cliente
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Tema do Cliente</Label>
          <Select
            value={settings.clientTheme}
            onValueChange={(value: 'light' | 'dark' | 'system') =>
              updateSettings({ clientTheme: value })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="system">Sistema (respeita preferência)</SelectItem>
              <SelectItem value="light">Claro (forçado)</SelectItem>
              <SelectItem value="dark">Escuro (forçado)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Language Settings */}
      <div className="lunari-card p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Languages className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-medium">Idioma</h2>
            <p className="text-sm text-muted-foreground">
              Idioma padrão das interfaces
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Idioma</Label>
          <Select
            value={settings.language}
            onValueChange={(value) => updateSettings({ language: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pt-BR">Português (Brasil)</SelectItem>
              <SelectItem value="en-US">English (US)</SelectItem>
              <SelectItem value="es-ES">Español</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Default Expiration */}
      <div className="lunari-card p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Calendar className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-medium">Prazo Padrão</h2>
            <p className="text-sm text-muted-foreground">
              Prazo de expiração padrão para novas galerias
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Dias para expiração</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              max={90}
              value={settings.defaultExpirationDays}
              onChange={(e) =>
                updateSettings({
                  defaultExpirationDays: parseInt(e.target.value) || 10,
                })
              }
              className="w-24"
            />
            <span className="text-muted-foreground">dias</span>
          </div>
        </div>
      </div>
    </div>
  );
}
