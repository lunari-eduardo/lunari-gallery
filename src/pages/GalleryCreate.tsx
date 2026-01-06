import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, User, Image, Settings, Check, Upload, Calendar, MessageSquare, Download, Droplet, Plus, Ban, CreditCard, Receipt, Tag, Package, Trash2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { defaultWelcomeMessage } from '@/data/mockData';
import { DeadlinePreset, WatermarkType, ImageResizeOption, WatermarkDisplay, Client, SaleMode, PricingModel, ChargeType, DiscountPackage, SaleSettings, DiscountPreset } from '@/types/gallery';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { ClientSelect } from '@/components/ClientSelect';
import { ClientModal } from '@/components/ClientModal';
import { useClients, CreateClientData } from '@/hooks/useClients';
import { useGalleries } from '@/hooks/useGalleries';
import { useSettings } from '@/hooks/useSettings';
import { generateId } from '@/lib/storage';
const steps = [{
  id: 1,
  name: 'Cliente',
  icon: User
}, {
  id: 2,
  name: 'Venda',
  icon: Tag
}, {
  id: 3,
  name: 'Fotos',
  icon: Image
}, {
  id: 4,
  name: 'Configurações',
  icon: Settings
}, {
  id: 5,
  name: 'Revisão',
  icon: Check
}];
export default function GalleryCreate() {
  const navigate = useNavigate();
  const {
    clients,
    createClient
  } = useClients();
  const {
    createGallery
  } = useGalleries();
  const {
    settings,
    updateSettings
  } = useSettings();
  const [currentStep, setCurrentStep] = useState(1);

  // Preset dialog state
  const [showSavePresetDialog, setShowSavePresetDialog] = useState(false);
  const [presetName, setPresetName] = useState('');

  // Step 1: Client Info
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [useExistingPassword, setUseExistingPassword] = useState(true);
  const [newPassword, setNewPassword] = useState('');
  const [sessionName, setSessionName] = useState('');
  const [packageName, setPackageName] = useState('');
  const [includedPhotos, setIncludedPhotos] = useState(30);

  // Step 2: Sale Settings
  const [saleMode, setSaleMode] = useState<SaleMode>('sale_without_payment');
  const [pricingModel, setPricingModel] = useState<PricingModel>('fixed');
  const [chargeType, setChargeType] = useState<ChargeType>('only_extras');
  const [fixedPrice, setFixedPrice] = useState(25);
  const [discountPackages, setDiscountPackages] = useState<DiscountPackage[]>([]);

  // Step 3: Photos (mock)
  const [uploadedCount, setUploadedCount] = useState(0);

  // Step 4: Settings
  const [welcomeMessage, setWelcomeMessage] = useState(defaultWelcomeMessage);
  const [customDays, setCustomDays] = useState(10);
  const [imageResizeOption, setImageResizeOption] = useState<ImageResizeOption>(800);
  const [watermarkType, setWatermarkType] = useState<WatermarkType>('text');
  const [watermarkText, setWatermarkText] = useState('Studio Lunari');
  const [watermarkOpacity, setWatermarkOpacity] = useState(30);
  const [watermarkDisplay, setWatermarkDisplay] = useState<WatermarkDisplay>('all');
  const [allowComments, setAllowComments] = useState(true);
  const [allowDownload, setAllowDownload] = useState(false);
  const [allowExtraPhotos, setAllowExtraPhotos] = useState(true);

  // Initialize from settings
  useEffect(() => {
    if (settings) {
      setCustomDays(settings.defaultExpirationDays || 10);
      if (settings.defaultWatermark) {
        setWatermarkType(settings.defaultWatermark.type);
        setWatermarkText(settings.defaultWatermark.text || 'Studio Lunari');
        setWatermarkOpacity(settings.defaultWatermark.opacity);
      }
    }
  }, [settings]);
  const getSaleSettings = (): SaleSettings => ({
    mode: saleMode,
    pricingModel,
    chargeType,
    fixedPrice,
    discountPackages
  });
  const handleNext = () => {
    if (currentStep < 5) {
      setCurrentStep(currentStep + 1);
    } else {
      // Create gallery
      if (!selectedClient) {
        toast.error('Selecione um cliente');
        return;
      }
      const deadline = new Date();
      deadline.setDate(deadline.getDate() + customDays);
      const saleSettings = getSaleSettings();
      const newGallery = createGallery({
        clientId: selectedClient.id,
        clientName: selectedClient.name,
        clientEmail: selectedClient.email,
        sessionName,
        packageName,
        includedPhotos,
        extraPhotoPrice: saleSettings.mode !== 'no_sale' ? fixedPrice : 0,
        saleSettings,
        photoCount: uploadedCount || 20,
        settings: {
          welcomeMessage,
          deadline,
          deadlinePreset: 'custom' as DeadlinePreset,
          watermark: {
            type: watermarkType,
            text: watermarkText,
            opacity: watermarkOpacity,
            position: 'bottom-right'
          },
          watermarkDisplay,
          imageResizeOption,
          allowComments,
          allowDownload,
          allowExtraPhotos: saleSettings.mode !== 'no_sale' && allowExtraPhotos
        }
      });
      toast.success('Galeria criada com sucesso!', {
        description: 'Você pode enviar o link para o cliente agora.'
      });
      navigate(`/gallery/${newGallery.id}`);
    }
  };
  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else {
      navigate('/');
    }
  };
  const mockUpload = () => {
    setUploadedCount(prev => prev + Math.floor(Math.random() * 10) + 5);
  };
  const handleSaveClient = (clientData: CreateClientData) => {
    const newClient = createClient(clientData);
    setSelectedClient(newClient);
    setUseExistingPassword(true);
    setIsClientModalOpen(false);
    toast.success('Cliente cadastrado com sucesso!');
  };
  const handleClientSelect = (client: Client | null) => {
    setSelectedClient(client);
    if (client) {
      setUseExistingPassword(true);
      setNewPassword('');
    }
  };
  const addDiscountPackage = () => {
    const updatedPackages = [...discountPackages];

    // Se já existe última faixa com infinito, converter para número
    if (updatedPackages.length > 0) {
      const lastIndex = updatedPackages.length - 1;
      const lastPkg = updatedPackages[lastIndex];
      if (lastPkg.maxPhotos === null) {
        // Definir valor padrão: minPhotos + 9
        updatedPackages[lastIndex] = {
          ...lastPkg,
          maxPhotos: lastPkg.minPhotos + 9
        };
      }
    }
    const lastPackage = updatedPackages[updatedPackages.length - 1];
    const minPhotos = lastPackage ? (lastPackage.maxPhotos as number) + 1 : 1;
    setDiscountPackages([...updatedPackages, {
      id: generateId(),
      minPhotos,
      maxPhotos: null,
      // Infinito por padrão
      pricePerPhoto: Math.max(1, fixedPrice - (discountPackages.length + 1) * 5)
    }]);
  };
  const updateDiscountPackage = (id: string, field: keyof DiscountPackage, value: number | null) => {
    setDiscountPackages(discountPackages.map(pkg => pkg.id === id ? {
      ...pkg,
      [field]: value
    } : pkg));
  };
  const savePreset = () => {
    if (!presetName.trim()) {
      toast.error('Digite um nome para a predefinição');
      return;
    }
    const newPreset: DiscountPreset = {
      id: generateId(),
      name: presetName.trim(),
      packages: discountPackages,
      createdAt: new Date()
    };
    updateSettings({
      discountPresets: [...(settings.discountPresets || []), newPreset]
    });
    setPresetName('');
    setShowSavePresetDialog(false);
    toast.success('Predefinição salva com sucesso!');
  };
  const loadPreset = (presetId: string) => {
    const preset = settings.discountPresets?.find(p => p.id === presetId);
    if (preset) {
      // Clonar os pacotes com novos IDs
      const clonedPackages = preset.packages.map(pkg => ({
        ...pkg,
        id: generateId()
      }));
      setDiscountPackages(clonedPackages);
      toast.success(`Predefinição "${preset.name}" carregada`);
    }
  };
  const removeDiscountPackage = (id: string) => {
    setDiscountPackages(discountPackages.filter(pkg => pkg.id !== id));
  };
  const getSaleModeLabel = () => {
    switch (saleMode) {
      case 'no_sale':
        return 'Sem venda';
      case 'sale_with_payment':
        return 'Venda COM pagamento';
      case 'sale_without_payment':
        return 'Venda SEM pagamento';
    }
  };
  const getPricingModelLabel = () => {
    switch (pricingModel) {
      case 'fixed':
        return 'Preço único';
      case 'packages':
        return 'Pacotes com desconto';
    }
  };
  const getChargeTypeLabel = () => {
    switch (chargeType) {
      case 'only_extras':
        return 'Apenas extras';
      case 'all_selected':
        return 'Todas selecionadas';
    }
  };
  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <div className="space-y-6 animate-fade-in">
            <div>
              
              <p className="text-muted-foreground text-lg font-serif">
                Dados do cliente e detalhes da sessão
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="flex-1 space-y-2">
                  <Label>Cliente *</Label>
                  <ClientSelect clients={clients} selectedClient={selectedClient} onSelect={handleClientSelect} onCreateNew={() => setIsClientModalOpen(true)} />
                </div>
                <div className="pt-6">
                  <Button type="button" variant="outline" size="icon" onClick={() => setIsClientModalOpen(true)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {selectedClient && <div className="p-4 rounded-lg bg-muted/50 space-y-2 animate-fade-in">
                  <div className="grid gap-2 md:grid-cols-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Email: </span>
                      <span className="font-medium">{selectedClient.email}</span>
                    </div>
                    {selectedClient.phone && <div>
                        <span className="text-muted-foreground">Telefone: </span>
                        <span className="font-medium">{selectedClient.phone}</span>
                      </div>}
                  </div>
                  
                  <div className="pt-2 space-y-3">
                    <Label className="text-sm">Senha de acesso à galeria *</Label>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="useExisting" checked={useExistingPassword} onCheckedChange={checked => setUseExistingPassword(checked as boolean)} />
                      <label htmlFor="useExisting" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                        Usar senha cadastrada
                      </label>
                    </div>
                    {!useExistingPassword && <Input placeholder="Nova senha para esta galeria" value={newPassword} onChange={e => setNewPassword(e.target.value)} />}
                  </div>
                </div>}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="sessionName">Nome da Sessão *</Label>
                <Input id="sessionName" placeholder="Ex: Ensaio Gestante" value={sessionName} onChange={e => setSessionName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="packageName">Pacote</Label>
                <Input id="packageName" placeholder="Ex: Pacote Premium" value={packageName} onChange={e => setPackageName(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="includedPhotos">Fotos Incluídas no Pacote *</Label>
              <Input id="includedPhotos" type="number" min={1} value={includedPhotos} onChange={e => setIncludedPhotos(parseInt(e.target.value) || 0)} className="max-w-[200px]" />
            </div>

            <ClientModal open={isClientModalOpen} onOpenChange={setIsClientModalOpen} onSave={handleSaveClient} />
          </div>;
      case 2:
        return <div className="space-y-8 animate-fade-in">
            <div>
              
              <p className="text-muted-foreground text-lg font-serif">
                Defina como será a cobrança por fotos extras
              </p>
            </div>

            {/* Two column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left Block - Sale Mode */}
              <div className="space-y-4">
                <Label className="text-base font-medium">Configurar venda de fotos?</Label>
                <RadioGroup value={saleMode} onValueChange={v => setSaleMode(v as SaleMode)} className="flex flex-col gap-4">
                  {/* No Sale */}
                  <div>
                    <RadioGroupItem value="no_sale" id="sale-no" className="peer sr-only" />
                    <Label htmlFor="sale-no" className={cn("flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all", "hover:border-primary/50 hover:bg-muted/50", saleMode === 'no_sale' ? "border-primary bg-primary/5" : "border-border")}>
                      <div className={cn("w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0", saleMode === 'no_sale' ? "bg-primary/20" : "bg-muted")}>
                        <Ban className={cn("h-5 w-5", saleMode === 'no_sale' ? "text-primary" : "text-muted-foreground")} />
                      </div>
                      <div>
                        <p className="font-medium">Não, sem venda</p>
                        <p className="text-xs text-muted-foreground">
                          O cliente não será informado sobre os preços das fotos
                        </p>
                      </div>
                    </Label>
                  </div>

                  {/* Sale with Payment */}
                  <div>
                    <RadioGroupItem value="sale_with_payment" id="sale-payment" className="peer sr-only" />
                    <Label htmlFor="sale-payment" className={cn("flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all relative", "hover:border-primary/50 hover:bg-muted/50", saleMode === 'sale_with_payment' ? "border-primary bg-primary/5" : "border-border")}>
                      <Badge variant="secondary" className="absolute -top-2 right-2 text-xs">
                        Em breve
                      </Badge>
                      <div className={cn("w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0", saleMode === 'sale_with_payment' ? "bg-primary/20" : "bg-muted")}>
                        <CreditCard className={cn("h-5 w-5", saleMode === 'sale_with_payment' ? "text-primary" : "text-muted-foreground")} />
                      </div>
                      <div>
                        <p className="font-medium">Sim, COM pagamento</p>
                        <p className="text-xs text-muted-foreground">
                          O cliente será cobrado ao finalizar a seleção
                        </p>
                      </div>
                    </Label>
                  </div>

                  {/* Sale without Payment */}
                  <div>
                    <RadioGroupItem value="sale_without_payment" id="sale-no-payment" className="peer sr-only" />
                    <Label htmlFor="sale-no-payment" className={cn("flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all", "hover:border-primary/50 hover:bg-muted/50", saleMode === 'sale_without_payment' ? "border-primary bg-primary/5" : "border-border")}>
                      <div className={cn("w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0", saleMode === 'sale_without_payment' ? "bg-primary/20" : "bg-muted")}>
                        <Receipt className={cn("h-5 w-5", saleMode === 'sale_without_payment' ? "text-primary" : "text-muted-foreground")} />
                      </div>
                      <div>
                        <p className="font-medium">Sim, SEM pagamento</p>
                        <p className="text-xs text-muted-foreground">
                          O cliente será apenas informado sobre os preços
                        </p>
                      </div>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Right Block - Pricing Configuration (conditional) */}
              {saleMode !== 'no_sale' && <div className="space-y-6">
                  {/* Pricing Model */}
                  <div className="space-y-4">
                    <Label className="text-base font-medium">Qual formato de preço?</Label>
                    <RadioGroup value={pricingModel} onValueChange={v => setPricingModel(v as PricingModel)} className="flex flex-col gap-3">
                      {/* Fixed Price */}
                      <div>
                        <RadioGroupItem value="fixed" id="pricing-fixed" className="peer sr-only" />
                        <Label htmlFor="pricing-fixed" className={cn("flex flex-col gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all", "hover:border-primary/50 hover:bg-muted/50", pricingModel === 'fixed' ? "border-primary bg-primary/5" : "border-border")}>
                          <div className="flex items-center gap-3">
                            <div className={cn("w-8 h-8 rounded-full flex items-center justify-center", pricingModel === 'fixed' ? "bg-primary/20" : "bg-muted")}>
                              <Tag className={cn("h-4 w-4", pricingModel === 'fixed' ? "text-primary" : "text-muted-foreground")} />
                            </div>
                            <div>
                              <p className="font-medium">Preço único por foto</p>
                              <p className="text-xs text-muted-foreground">
                                Defina um valor fixo para cada foto
                              </p>
                            </div>
                          </div>
                          
                          {pricingModel === 'fixed' && <div className="pt-3 border-t border-border/50">
                              <Label htmlFor="fixedPrice" className="text-sm">Valor por foto (R$)</Label>
                              <Input id="fixedPrice" type="number" min={0} step={0.01} value={fixedPrice} onChange={e => setFixedPrice(parseFloat(e.target.value) || 0)} className="mt-2" onClick={e => e.stopPropagation()} />
                            </div>}
                        </Label>
                      </div>

                      {/* Packages with Discount */}
                      <div>
                        <RadioGroupItem value="packages" id="pricing-packages" className="peer sr-only" />
                        <Label htmlFor="pricing-packages" className={cn("flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all relative", "hover:border-primary/50 hover:bg-muted/50", pricingModel === 'packages' ? "border-primary bg-primary/5" : "border-border")}>
                          <Badge className="absolute -top-2 right-2 text-xs bg-green-500">
                            Novo
                          </Badge>
                          <div className={cn("w-8 h-8 rounded-full flex items-center justify-center", pricingModel === 'packages' ? "bg-primary/20" : "bg-muted")}>
                            <Package className={cn("h-4 w-4", pricingModel === 'packages' ? "text-primary" : "text-muted-foreground")} />
                          </div>
                          <div>
                            <p className="font-medium">Pacotes com descontos</p>
                            <p className="text-xs text-muted-foreground">
                              Descontos progressivos por quantidade
                            </p>
                          </div>
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {/* Discount Packages Configuration */}
                  {pricingModel === 'packages' && <div className="space-y-4 p-4 rounded-lg bg-muted/30 border border-border/50">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <Label className="text-sm font-medium">Configurar faixas</Label>
                        <div className="flex gap-2 flex-wrap">
                          {/* Select para carregar predefinição */}
                          {settings.discountPresets && settings.discountPresets.length > 0 && <Select onValueChange={loadPreset}>
                              <SelectTrigger className="h-8 w-[140px]">
                                <SelectValue placeholder="Carregar" />
                              </SelectTrigger>
                              <SelectContent>
                                {settings.discountPresets.map(preset => <SelectItem key={preset.id} value={preset.id}>
                                    {preset.name}
                                  </SelectItem>)}
                              </SelectContent>
                            </Select>}
                          
                          {/* Botão salvar predefinição */}
                          {discountPackages.length > 0 && <Button type="button" variant="outline" size="sm" onClick={() => setShowSavePresetDialog(true)} className="gap-1">
                              <Save className="h-4 w-4" />
                              Salvar
                            </Button>}
                          
                          {/* Botão adicionar faixa */}
                          <Button type="button" variant="outline" size="sm" onClick={addDiscountPackage} className="gap-1">
                            <Plus className="h-4 w-4" />
                            Adicionar
                          </Button>
                        </div>
                      </div>

                      {discountPackages.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">
                          Adicione faixas para definir preços por quantidade
                        </p> : <div className="space-y-3">
                          {discountPackages.map((pkg, index) => <div key={pkg.id} className="flex items-center gap-2 p-3 rounded-lg bg-background border border-border/50">
                              <div className="flex-1 grid grid-cols-3 gap-2">
                                <div className="space-y-1">
                                  <Label className="text-xs text-muted-foreground">De</Label>
                                  <Input type="number" min={1} value={pkg.minPhotos} onChange={e => updateDiscountPackage(pkg.id, 'minPhotos', parseInt(e.target.value) || 1)} className="h-8" />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs text-muted-foreground">Até</Label>
                                  {index === discountPackages.length - 1 ? <Input type="text" value={pkg.maxPhotos === null ? '∞' : pkg.maxPhotos} onChange={e => {
                          const val = e.target.value;
                          if (val === '' || val === '∞') {
                            updateDiscountPackage(pkg.id, 'maxPhotos', null);
                          } else {
                            const num = parseInt(val);
                            if (!isNaN(num)) {
                              updateDiscountPackage(pkg.id, 'maxPhotos', num);
                            }
                          }
                        }} placeholder="∞" className="h-8 text-center" /> : <Input type="number" min={pkg.minPhotos} value={pkg.maxPhotos ?? ''} onChange={e => updateDiscountPackage(pkg.id, 'maxPhotos', parseInt(e.target.value) || pkg.minPhotos)} className="h-8" />}
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs text-muted-foreground">R$</Label>
                                  <Input type="number" min={0} step={0.01} value={pkg.pricePerPhoto} onChange={e => updateDiscountPackage(pkg.id, 'pricePerPhoto', parseFloat(e.target.value) || 0)} className="h-8" />
                                </div>
                              </div>
                              <Button type="button" variant="ghost" size="icon" onClick={() => removeDiscountPackage(pkg.id)} className="text-destructive hover:text-destructive h-8 w-8">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>)}
                        </div>}
                    </div>}

                  {/* Charge Type */}
                  <div className="space-y-3">
                    <Label className="text-base font-medium">Tipo de cobrança</Label>
                    <Select value={chargeType} onValueChange={v => setChargeType(v as ChargeType)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="only_extras">Cobrar apenas as fotos extras</SelectItem>
                        <SelectItem value="all_selected">Cobrar todas as fotos selecionadas</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {chargeType === 'only_extras' ? `Fotos até o limite do pacote (${includedPhotos}) são gratuitas.` : `Todas as fotos selecionadas serão cobradas.`}
                    </p>
                  </div>
                </div>}
            </div>
            
            {/* Dialog para salvar predefinição */}
            <Dialog open={showSavePresetDialog} onOpenChange={setShowSavePresetDialog}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Salvar predefinição de faixas</DialogTitle>
                  <DialogDescription>
                    Salve esta configuração de faixas para reutilizar em outras galerias
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="presetName">Nome da predefinição</Label>
                    <Input id="presetName" value={presetName} onChange={e => setPresetName(e.target.value)} placeholder="Ex: Casamentos, Ensaios..." />
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground mb-2">Faixas a salvar:</p>
                    {discountPackages.map(pkg => <p key={pkg.id} className="text-sm">
                        {pkg.minPhotos} - {pkg.maxPhotos === null ? '∞' : pkg.maxPhotos} fotos: R$ {pkg.pricePerPhoto.toFixed(2)}
                      </p>)}
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowSavePresetDialog(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={savePreset}>Salvar predefinição</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>;
      case 3:
        return <div className="space-y-6 animate-fade-in">
            <div>
              
              <p className="text-muted-foreground text-lg font-serif">
                Adicione as fotos da sessão para o cliente selecionar
              </p>
            </div>

            <div className="border-2 border-dashed border-border rounded-xl p-12 text-center hover:border-primary/50 transition-colors cursor-pointer" onClick={mockUpload}>
              <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-2">
                Arraste as fotos aqui ou clique para selecionar
              </p>
              <p className="text-sm text-muted-foreground">
                Suporta JPG, PNG, RAW • Máx. 50MB por arquivo
              </p>
            </div>

            {uploadedCount > 0 && <div className="lunari-card p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Image className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{uploadedCount} fotos carregadas</p>
                      <p className="text-sm text-muted-foreground">
                        Processando derivados (thumbnail + preview)...
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setUploadedCount(0)}>
                    Limpar
                  </Button>
                </div>
              </div>}

            <div className="p-4 rounded-lg bg-muted/50 text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">ℹ️ Informação técnica</p>
              <p>
                O upload original gera automaticamente versões derivadas (thumbnail + preview). 
                O arquivo original nunca é servido ao cliente, garantindo proteção das suas fotos.
              </p>
            </div>
          </div>;
      case 4:
        return <div className="space-y-8 animate-fade-in">
            <div>
              <h2 className="font-display text-2xl font-semibold mb-2">
                Configurações da Galeria
              </h2>
              <p className="text-muted-foreground">
                Personalize a experiência do cliente
              </p>
            </div>

            {/* Two column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left Block - Welcome Message & Deadline */}
              <div className="space-y-6">
                {/* Welcome Message */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    <Label>Mensagem de Saudação</Label>
                  </div>
                  <Textarea value={welcomeMessage} onChange={e => setWelcomeMessage(e.target.value)} placeholder="Personalize a mensagem de boas-vindas..." rows={6} className="resize-none" />
                  <p className="text-xs text-muted-foreground">
                    Use {'{cliente}'}, {'{sessao}'}, {'{estudio}'} para personalização automática.
                  </p>
                </div>

                {/* Deadline */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    <Label>Prazo de Seleção *</Label>
                  </div>
                  <div className="flex items-center gap-3">
                    <Input type="number" min={1} max={90} value={customDays} onChange={e => setCustomDays(parseInt(e.target.value) || 10)} className="w-24" />
                    <span className="text-muted-foreground">dias</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Configuração padrão: {settings.defaultExpirationDays || 10} dias
                  </p>
                </div>
              </div>

              {/* Right Block - Image Settings & Watermark & Interactions */}
              <div className="space-y-6">
                {/* Image Resize */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Image className="h-4 w-4 text-primary" />
                    <Label>Tamanho das Imagens</Label>
                  </div>
                  <Select value={String(imageResizeOption)} onValueChange={v => setImageResizeOption(parseInt(v) as ImageResizeOption)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="640">640 px</SelectItem>
                      <SelectItem value="800">800 px (recomendado)</SelectItem>
                      <SelectItem value="1024">1024 px</SelectItem>
                      <SelectItem value="1920">1920 px</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Lado maior • Redimensiona para economia de armazenamento
                  </p>
                </div>

                {/* Watermark */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Droplet className="h-4 w-4 text-primary" />
                    <Label>Marca D'água</Label>
                  </div>
                  
                  {/* Watermark Type */}
                  <RadioGroup value={watermarkType} onValueChange={v => setWatermarkType(v as WatermarkType)} className="flex gap-2">
                    <div className="flex items-center">
                      <RadioGroupItem value="none" id="wm-none" className="peer sr-only" />
                      <Label htmlFor="wm-none" className="px-3 py-1.5 text-sm rounded-lg border cursor-pointer peer-data-[state=checked]:bg-primary peer-data-[state=checked]:text-primary-foreground peer-data-[state=checked]:border-primary">
                        Nenhuma
                      </Label>
                    </div>
                    <div className="flex items-center">
                      <RadioGroupItem value="text" id="wm-text" className="peer sr-only" />
                      <Label htmlFor="wm-text" className="px-3 py-1.5 text-sm rounded-lg border cursor-pointer peer-data-[state=checked]:bg-primary peer-data-[state=checked]:text-primary-foreground peer-data-[state=checked]:border-primary">
                        Texto
                      </Label>
                    </div>
                    <div className="flex items-center">
                      <RadioGroupItem value="logo" id="wm-logo" className="peer sr-only" />
                      <Label htmlFor="wm-logo" className="px-3 py-1.5 text-sm rounded-lg border cursor-pointer peer-data-[state=checked]:bg-primary peer-data-[state=checked]:text-primary-foreground peer-data-[state=checked]:border-primary">
                        Logo
                      </Label>
                    </div>
                  </RadioGroup>

                  {watermarkType === 'text' && <Input placeholder="Texto da marca d'água" value={watermarkText} onChange={e => setWatermarkText(e.target.value)} />}

                  {watermarkType === 'logo' && <>
                      {settings.defaultWatermark?.logoUrl ? <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                          <img src={settings.defaultWatermark.logoUrl} alt="Logo" className="h-10 object-contain" />
                          <div>
                            <p className="text-sm font-medium">Logo configurado</p>
                            <p className="text-xs text-muted-foreground">
                              Definido nas configurações
                            </p>
                          </div>
                        </div> : <div className="border-2 border-dashed border-amber-500/50 rounded-lg p-4 text-center bg-amber-500/5">
                          <Upload className="h-6 w-6 mx-auto text-amber-500 mb-2" />
                          <p className="text-sm font-medium text-amber-600">
                            Nenhum logo configurado
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Configure o logo nas configurações do estúdio
                          </p>
                        </div>}
                    </>}

                  {watermarkType !== 'none' && <>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm">Opacidade</Label>
                          <span className="text-sm text-muted-foreground">{watermarkOpacity}%</span>
                        </div>
                        <Slider value={[watermarkOpacity]} onValueChange={v => setWatermarkOpacity(v[0])} min={10} max={100} step={5} />
                      </div>
                      
                      <div className="space-y-2">
                        <Label className="text-sm">Onde aplicar</Label>
                        <Select value={watermarkDisplay} onValueChange={v => setWatermarkDisplay(v as WatermarkDisplay)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Fotos ampliadas e miniaturas</SelectItem>
                            <SelectItem value="fullscreen">Somente fotos ampliadas</SelectItem>
                            <SelectItem value="none">Não aplicar</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </>}
                </div>

                {/* Client Interactions */}
                <div className="space-y-3 pt-2">
                  <h3 className="font-medium text-sm">Interações do Cliente</h3>
                  
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-sm font-medium">Permitir comentários</p>
                      <p className="text-xs text-muted-foreground">
                        Cliente pode comentar em cada foto
                      </p>
                    </div>
                    <Switch checked={allowComments} onCheckedChange={setAllowComments} />
                  </div>

                  <div className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-sm font-medium">Permitir download</p>
                      <p className="text-xs text-muted-foreground">
                        Cliente pode baixar as imagens
                      </p>
                    </div>
                    <Switch checked={allowDownload} onCheckedChange={setAllowDownload} />
                  </div>

                  {saleMode !== 'no_sale' && <div className="flex items-center justify-between py-2">
                      <div>
                        <p className="text-sm font-medium">Permitir fotos extras</p>
                        <p className="text-xs text-muted-foreground">
                          Cliente pode selecionar além do limite
                        </p>
                      </div>
                      <Switch checked={allowExtraPhotos} onCheckedChange={setAllowExtraPhotos} />
                    </div>}
                </div>
              </div>
            </div>
          </div>;
      case 5:
        return <div className="space-y-6 animate-fade-in">
            <div>
              <h2 className="font-display text-2xl font-semibold mb-2">
                Revisar e Criar
              </h2>
              <p className="text-muted-foreground">
                Confira as informações antes de criar a galeria
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="lunari-card p-5 space-y-4">
                <h3 className="font-medium flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  Informações do Cliente
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cliente</span>
                    <span className="font-medium">{selectedClient?.name || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Email</span>
                    <span className="font-medium">{selectedClient?.email || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Sessão</span>
                    <span className="font-medium">{sessionName || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pacote</span>
                    <span className="font-medium">{packageName || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Fotos incluídas</span>
                    <span className="font-medium">{includedPhotos}</span>
                  </div>
                </div>
              </div>

              <div className="lunari-card p-5 space-y-4">
                <h3 className="font-medium flex items-center gap-2">
                  <Tag className="h-4 w-4 text-primary" />
                  Configuração de Venda
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Modo de venda</span>
                    <span className="font-medium">{getSaleModeLabel()}</span>
                  </div>
                  {saleMode !== 'no_sale' && <>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Modelo de preço</span>
                        <span className="font-medium">{getPricingModelLabel()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Tipo de cobrança</span>
                        <span className="font-medium">{getChargeTypeLabel()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Valor por foto</span>
                        <span className="font-medium">R$ {fixedPrice.toFixed(2)}</span>
                      </div>
                      {pricingModel === 'packages' && discountPackages.length > 0 && <div className="flex justify-between">
                          <span className="text-muted-foreground">Pacotes de desconto</span>
                          <span className="font-medium">{discountPackages.length} configurados</span>
                        </div>}
                    </>}
                </div>
              </div>

              <div className="lunari-card p-5 space-y-4">
                <h3 className="font-medium flex items-center gap-2">
                  <Settings className="h-4 w-4 text-primary" />
                  Configurações
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Fotos</span>
                    <span className="font-medium">{uploadedCount} arquivos</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Prazo</span>
                    <span className="font-medium">{customDays} dias</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tamanho</span>
                    <span className="font-medium">{imageResizeOption}px</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Marca d'água</span>
                    <span className="font-medium capitalize">{watermarkType === 'none' ? 'Nenhuma' : watermarkType}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Comentários</span>
                    <span className="font-medium">{allowComments ? 'Sim' : 'Não'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Download</span>
                    <span className="font-medium">{allowDownload ? 'Ativado' : 'Desativado'}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-primary/10 text-sm">
              <p className="text-primary font-medium mb-1">
                ✨ Pronto para criar!
              </p>
              <p className="text-muted-foreground">
                Após criar a galeria, você poderá enviar o link de seleção para o cliente.
              </p>
            </div>
          </div>;
      default:
        return null;
    }
  };
  return <div className="max-w-5xl mx-auto animate-fade-in pb-24">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" onClick={handleBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-semibold">
            Nova Galeria
          </h1>
          <p className="text-muted-foreground text-sm">
            Passo {currentStep} de {steps.length}
          </p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-between mb-8 overflow-x-auto pb-2">
        {steps.map((step, index) => {
        const Icon = step.icon;
        const isActive = currentStep === step.id;
        const isCompleted = currentStep > step.id;
        return <div key={step.id} className="flex items-center">
              <div className={cn('flex items-center gap-2 px-3 py-1.5 rounded-full transition-colors whitespace-nowrap', isActive && 'bg-primary text-primary-foreground', isCompleted && 'bg-primary/20 text-primary', !isActive && !isCompleted && 'text-muted-foreground')}>
                {isCompleted ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                <span className="text-sm font-medium hidden sm:block">
                  {step.name}
                </span>
              </div>
              {index < steps.length - 1 && <div className={cn('h-px w-4 md:w-12 mx-1 md:mx-2', isCompleted ? 'bg-primary' : 'bg-border')} />}
            </div>;
      })}
      </div>

      {/* Step Content */}
      <div className="lunari-card p-6 md:p-8">
        {renderStep()}
      </div>

      {/* Fixed Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t border-border z-40">
        <div className="max-w-5xl mx-auto px-4 py-4 flex justify-between">
          <Button variant="outline" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {currentStep === 1 ? 'Cancelar' : 'Voltar'}
          </Button>
          <Button variant="terracotta" onClick={handleNext}>
            {currentStep === 5 ? 'Criar Galeria' : 'Próximo'}
            {currentStep < 5 && <ArrowRight className="h-4 w-4 ml-2" />}
          </Button>
        </div>
      </div>
    </div>;
}