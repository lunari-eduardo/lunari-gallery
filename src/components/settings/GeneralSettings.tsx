import { Globe, Palette, Calendar, Building2, Shield, Lock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { GlobalSettings, GalleryPermission } from '@/types/gallery';

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

      {/* Gallery Permission Settings */}
      <div className="lunari-card p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-medium">Permissão Padrão de Galerias</h2>
            <p className="text-sm text-muted-foreground">
              Define a permissão padrão para novas galerias
            </p>
          </div>
        </div>

        <RadioGroup 
          value={settings.defaultGalleryPermission} 
          onValueChange={(v) => updateSettings({ defaultGalleryPermission: v as GalleryPermission })}
          className="space-y-3"
        >
          <div className="flex items-center gap-3 p-4 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors">
            <RadioGroupItem value="public" id="perm-public" />
            <Label htmlFor="perm-public" className="flex-1 cursor-pointer">
              <p className="font-medium">Pública</p>
              <p className="text-sm text-muted-foreground">
                Galerias acessíveis sem senha
              </p>
            </Label>
            <Globe className="h-5 w-5 text-muted-foreground" />
          </div>

          <div className="flex items-center gap-3 p-4 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors">
            <RadioGroupItem value="private" id="perm-private" />
            <Label htmlFor="perm-private" className="flex-1 cursor-pointer">
              <p className="font-medium">Privada</p>
              <p className="text-sm text-muted-foreground">
                Requer senha do cliente para acesso
              </p>
            </Label>
            <Lock className="h-5 w-5 text-muted-foreground" />
          </div>
        </RadioGroup>
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
