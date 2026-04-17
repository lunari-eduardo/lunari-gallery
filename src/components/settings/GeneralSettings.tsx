import { Globe, Calendar, Building2, Shield, Lock, Tag, Image as ImageIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { GlobalSettings, GalleryPermission, SaleMode, ImageResizeOption } from '@/types/gallery';

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
              value={settings.defaultExpirationDays ?? ''}
              onChange={(e) =>
                updateSettings({
                  defaultExpirationDays: e.target.value === '' ? ('' as any) : (parseInt(e.target.value) || 0),
                })
              }
              onBlur={() => {
                if (!settings.defaultExpirationDays) {
                  updateSettings({ defaultExpirationDays: 10 });
                }
              }}
              className="w-24"
            />
            <span className="text-muted-foreground">dias</span>
          </div>
        </div>
      </div>

      {/* Default Sale Mode */}
      <div className="lunari-card p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Tag className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-medium">Modo de Venda Padrão</h2>
            <p className="text-sm text-muted-foreground">
              Aplicado automaticamente em novas galerias
            </p>
          </div>
        </div>

        <RadioGroup
          value={settings.defaultSaleMode ?? 'sale_without_payment'}
          onValueChange={(v) => updateSettings({ defaultSaleMode: v as SaleMode })}
          className="space-y-3"
        >
          <div className="flex items-start gap-3 p-4 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors">
            <RadioGroupItem value="no_sale" id="sale-no" className="mt-0.5" />
            <Label htmlFor="sale-no" className="flex-1 cursor-pointer">
              <p className="font-medium">Não, sem venda</p>
              <p className="text-sm text-muted-foreground">
                Cliente não vê preços nem pode comprar fotos extras
              </p>
            </Label>
          </div>

          <div className="flex items-start gap-3 p-4 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors">
            <RadioGroupItem value="sale_with_payment" id="sale-with" className="mt-0.5" />
            <Label htmlFor="sale-with" className="flex-1 cursor-pointer">
              <p className="font-medium">Sim, COM pagamento</p>
              <p className="text-sm text-muted-foreground">
                Cliente é cobrado ao finalizar a seleção
              </p>
            </Label>
          </div>

          <div className="flex items-start gap-3 p-4 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors">
            <RadioGroupItem value="sale_without_payment" id="sale-without" className="mt-0.5" />
            <Label htmlFor="sale-without" className="flex-1 cursor-pointer">
              <p className="font-medium">Sim, SEM pagamento</p>
              <p className="text-sm text-muted-foreground">
                Cliente vê os preços, mas o pagamento é tratado fora da plataforma
              </p>
            </Label>
          </div>
        </RadioGroup>
      </div>

      {/* Default Image Resize */}
      <div className="lunari-card p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <ImageIcon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-medium">Tamanho Padrão das Imagens</h2>
            <p className="text-sm text-muted-foreground">
              Resolução do preview aplicada automaticamente em novas galerias
            </p>
          </div>
        </div>

        <RadioGroup
          value={String(settings.defaultImageResize ?? 1920)}
          onValueChange={(v) => updateSettings({ defaultImageResize: Number(v) as ImageResizeOption })}
          className="space-y-3"
        >
          <div className="flex items-start gap-3 p-4 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors">
            <RadioGroupItem value="1024" id="resize-1024" className="mt-0.5" />
            <Label htmlFor="resize-1024" className="flex-1 cursor-pointer">
              <p className="font-medium">1024 px</p>
              <p className="text-sm text-muted-foreground">
                Leve, ideal para web e carregamento rápido
              </p>
            </Label>
          </div>

          <div className="flex items-start gap-3 p-4 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors">
            <RadioGroupItem value="1920" id="resize-1920" className="mt-0.5" />
            <Label htmlFor="resize-1920" className="flex-1 cursor-pointer">
              <p className="font-medium">1920 px <span className="text-xs text-primary ml-1">(recomendado)</span></p>
              <p className="text-sm text-muted-foreground">
                Equilíbrio ideal entre qualidade e peso
              </p>
            </Label>
          </div>

          <div className="flex items-start gap-3 p-4 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors">
            <RadioGroupItem value="2560" id="resize-2560" className="mt-0.5" />
            <Label htmlFor="resize-2560" className="flex-1 cursor-pointer">
              <p className="font-medium">2560 px</p>
              <p className="text-sm text-muted-foreground">
                Alta resolução para visualização em telas grandes
              </p>
            </Label>
          </div>
        </RadioGroup>
      </div>
    </div>
  );
}
