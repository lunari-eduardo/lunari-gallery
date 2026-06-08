import { useEffect, useState } from 'react';
import { Globe, Calendar, Building2, Shield, Lock, Tag, Image as ImageIcon, Receipt, Package, CheckCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { GlobalSettings, GalleryPermission, SaleMode, ImageResizeOption, ChargeType, PricingModel } from '@/types/gallery';
import { UpdateSettingsOptions } from '@/hooks/useGallerySettings';
import { THEME_REGISTRY } from '@/components/gallery/themes/registry';
import { cn } from '@/lib/utils';


interface GeneralSettingsProps {
  settings: GlobalSettings;
  updateSettings: (data: Partial<GlobalSettings>, options?: UpdateSettingsOptions) => void;
}

export function GeneralSettings({ settings, updateSettings }: GeneralSettingsProps) {
  const [studioName, setStudioName] = useState(settings.studioName);
  const [expirationDays, setExpirationDays] = useState(String(settings.defaultExpirationDays ?? 10));

  useEffect(() => {
    setStudioName(settings.studioName);
  }, [settings.studioName]);

  useEffect(() => {
    setExpirationDays(String(settings.defaultExpirationDays ?? 10));
  }, [settings.defaultExpirationDays]);

  const saveStudioName = () => {
    const nextName = studioName.trim() || 'Meu Estúdio';
    if (nextName !== settings.studioName) {
      updateSettings({ studioName: nextName }, { successMessage: 'Nome do estúdio salvo.' });
    }
    setStudioName(nextName);
  };

  const saveExpirationDays = () => {
    const nextDays = Math.min(90, Math.max(1, Number.parseInt(expirationDays, 10) || 10));
    if (nextDays !== settings.defaultExpirationDays) {
      updateSettings({ defaultExpirationDays: nextDays }, { successMessage: 'Prazo padrão salvo.' });
    }
    setExpirationDays(String(nextDays));
  };

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
              value={studioName}
              onChange={(e) => setStudioName(e.target.value)}
              onBlur={saveStudioName}
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
          onValueChange={(v) => updateSettings({ defaultGalleryPermission: v as GalleryPermission }, { successMessage: 'Permissão padrão salva.' })}
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
              value={expirationDays}
              onChange={(e) => setExpirationDays(e.target.value)}
              onBlur={saveExpirationDays}
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
          onValueChange={(v) => updateSettings({ defaultSaleMode: v as SaleMode }, { successMessage: 'Modo de venda salvo.' })}
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
          onValueChange={(v) => updateSettings({ defaultImageResize: Number(v) as ImageResizeOption }, { successMessage: 'Tamanho padrão salvo.' })}
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

      {/* Default Charge Type */}
      <div className="lunari-card p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Receipt className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-medium">Tipo de Cobrança Padrão</h2>
            <p className="text-sm text-muted-foreground">
              Aplicado quando há venda ativa em novas galerias
            </p>
          </div>
        </div>

        <RadioGroup
          value={settings.defaultChargeType ?? 'only_extras'}
          onValueChange={(v) => updateSettings({ defaultChargeType: v as ChargeType }, { successMessage: 'Tipo de cobrança salvo.' })}
          className="space-y-3"
        >
          <div className="flex items-start gap-3 p-4 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors">
            <RadioGroupItem value="only_extras" id="charge-extras" className="mt-0.5" />
            <Label htmlFor="charge-extras" className="flex-1 cursor-pointer">
              <p className="font-medium">Cobrar apenas as fotos extras</p>
              <p className="text-sm text-muted-foreground">
                As fotos incluídas no pacote são gratuitas
              </p>
            </Label>
          </div>

          <div className="flex items-start gap-3 p-4 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors">
            <RadioGroupItem value="all_selected" id="charge-all" className="mt-0.5" />
            <Label htmlFor="charge-all" className="flex-1 cursor-pointer">
              <p className="font-medium">Cobrar todas as fotos selecionadas</p>
              <p className="text-sm text-muted-foreground">
                Todas as fotos selecionadas pelo cliente serão cobradas
              </p>
            </Label>
          </div>
        </RadioGroup>
      </div>

      {/* Default Pricing Model */}
      <div className="lunari-card p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Package className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-medium">Modelo de Preços Padrão</h2>
            <p className="text-sm text-muted-foreground">
              Como as fotos extras serão precificadas em novas galerias
            </p>
          </div>
        </div>

        <RadioGroup
          value={settings.defaultPricingModel ?? 'fixed'}
          onValueChange={(v) => updateSettings({ defaultPricingModel: v as PricingModel }, { successMessage: 'Modelo de preços salvo.' })}
          className="space-y-3"
        >
          <div className="flex items-start gap-3 p-4 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors">
            <RadioGroupItem value="fixed" id="pricing-fixed" className="mt-0.5" />
            <Label htmlFor="pricing-fixed" className="flex-1 cursor-pointer">
              <p className="font-medium">Preço único</p>
              <p className="text-sm text-muted-foreground">
                Mesmo valor por foto extra independentemente da quantidade
              </p>
            </Label>
          </div>

          <div className="flex items-start gap-3 p-4 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors">
            <RadioGroupItem value="packages" id="pricing-packages" className="mt-0.5" />
            <Label htmlFor="pricing-packages" className="flex-1 cursor-pointer">
              <p className="font-medium">Pacotes com desconto</p>
              <p className="text-sm text-muted-foreground">
                Faixas progressivas de preço por quantidade
              </p>
            </Label>
          </div>
        </RadioGroup>
      </div>
    </div>
  );
}
