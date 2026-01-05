import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  ArrowRight, 
  User, 
  Image, 
  Settings, 
  Check,
  Upload,
  Calendar,
  MessageSquare,
  Download,
  Droplet,
  Plus,
  Ban,
  CreditCard,
  Receipt,
  Tag,
  Package,
  Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { defaultWelcomeMessage } from '@/data/mockData';
import { DeadlinePreset, WatermarkType, ImageResizeOption, WatermarkDisplay, Client, SaleMode, PricingModel, ChargeType, DiscountPackage, SaleSettings } from '@/types/gallery';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { ClientSelect } from '@/components/ClientSelect';
import { ClientModal } from '@/components/ClientModal';
import { useClients, CreateClientData } from '@/hooks/useClients';
import { useGalleries } from '@/hooks/useGalleries';
import { generateId } from '@/lib/storage';

const steps = [
  { id: 1, name: 'Cliente', icon: User },
  { id: 2, name: 'Venda', icon: Tag },
  { id: 3, name: 'Fotos', icon: Image },
  { id: 4, name: 'Configurações', icon: Settings },
  { id: 5, name: 'Revisão', icon: Check },
];

export default function GalleryCreate() {
  const navigate = useNavigate();
  const { clients, createClient } = useClients();
  const { createGallery } = useGalleries();
  const [currentStep, setCurrentStep] = useState(1);
  
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
  const [deadlinePreset, setDeadlinePreset] = useState<DeadlinePreset>(7);
  const [customDays, setCustomDays] = useState(10);
  const [imageResizeOption, setImageResizeOption] = useState<ImageResizeOption>(800);
  const [watermarkType, setWatermarkType] = useState<WatermarkType>('text');
  const [watermarkText, setWatermarkText] = useState('Studio Lunari');
  const [watermarkOpacity, setWatermarkOpacity] = useState(30);
  const [watermarkDisplay, setWatermarkDisplay] = useState<WatermarkDisplay>('all');
  const [allowComments, setAllowComments] = useState(true);
  const [allowDownload, setAllowDownload] = useState(false);
  const [allowExtraPhotos, setAllowExtraPhotos] = useState(true);

  const getSaleSettings = (): SaleSettings => ({
    mode: saleMode,
    pricingModel,
    chargeType,
    fixedPrice,
    discountPackages,
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
      deadline.setDate(deadline.getDate() + getDaysFromPreset());

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
          deadlinePreset,
          watermark: {
            type: watermarkType,
            text: watermarkText,
            opacity: watermarkOpacity,
            position: 'bottom-right',
          },
          watermarkDisplay,
          imageResizeOption,
          allowComments,
          allowDownload,
          allowExtraPhotos: saleSettings.mode !== 'no_sale' && allowExtraPhotos,
        },
      });

      toast.success('Galeria criada com sucesso!', {
        description: 'Você pode enviar o link para o cliente agora.',
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

  const getDaysFromPreset = () => {
    if (deadlinePreset === 'custom') return customDays;
    return deadlinePreset;
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
    const lastPackage = discountPackages[discountPackages.length - 1];
    const minPhotos = lastPackage ? lastPackage.maxPhotos + 1 : 1;
    setDiscountPackages([
      ...discountPackages,
      {
        id: generateId(),
        minPhotos,
        maxPhotos: minPhotos + 9,
        pricePerPhoto: fixedPrice - (discountPackages.length + 1) * 5,
      },
    ]);
  };

  const updateDiscountPackage = (id: string, field: keyof DiscountPackage, value: number) => {
    setDiscountPackages(
      discountPackages.map(pkg =>
        pkg.id === id ? { ...pkg, [field]: value } : pkg
      )
    );
  };

  const removeDiscountPackage = (id: string) => {
    setDiscountPackages(discountPackages.filter(pkg => pkg.id !== id));
  };

  const getSaleModeLabel = () => {
    switch (saleMode) {
      case 'no_sale': return 'Sem venda';
      case 'sale_with_payment': return 'Venda COM pagamento';
      case 'sale_without_payment': return 'Venda SEM pagamento';
    }
  };

  const getPricingModelLabel = () => {
    switch (pricingModel) {
      case 'fixed': return 'Preço único';
      case 'packages': return 'Pacotes com desconto';
    }
  };

  const getChargeTypeLabel = () => {
    switch (chargeType) {
      case 'only_extras': return 'Apenas extras';
      case 'all_selected': return 'Todas selecionadas';
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6 animate-fade-in">
            <div>
              <h2 className="font-display text-2xl font-semibold mb-2">
                Informações do Cliente
              </h2>
              <p className="text-muted-foreground">
                Dados do cliente e detalhes da sessão
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="flex-1 space-y-2">
                  <Label>Cliente *</Label>
                  <ClientSelect
                    clients={clients}
                    selectedClient={selectedClient}
                    onSelect={handleClientSelect}
                    onCreateNew={() => setIsClientModalOpen(true)}
                  />
                </div>
                <div className="pt-6">
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="icon"
                    onClick={() => setIsClientModalOpen(true)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {selectedClient && (
                <div className="p-4 rounded-lg bg-muted/50 space-y-2 animate-fade-in">
                  <div className="grid gap-2 md:grid-cols-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Email: </span>
                      <span className="font-medium">{selectedClient.email}</span>
                    </div>
                    {selectedClient.phone && (
                      <div>
                        <span className="text-muted-foreground">Telefone: </span>
                        <span className="font-medium">{selectedClient.phone}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="pt-2 space-y-3">
                    <Label className="text-sm">Senha de acesso à galeria *</Label>
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="useExisting" 
                        checked={useExistingPassword}
                        onCheckedChange={(checked) => setUseExistingPassword(checked as boolean)}
                      />
                      <label 
                        htmlFor="useExisting" 
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        Usar senha cadastrada
                      </label>
                    </div>
                    {!useExistingPassword && (
                      <Input
                        placeholder="Nova senha para esta galeria"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="sessionName">Nome da Sessão *</Label>
                <Input
                  id="sessionName"
                  placeholder="Ex: Ensaio Gestante"
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="packageName">Pacote</Label>
                <Input
                  id="packageName"
                  placeholder="Ex: Pacote Premium"
                  value={packageName}
                  onChange={(e) => setPackageName(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="includedPhotos">Fotos Incluídas no Pacote *</Label>
              <Input
                id="includedPhotos"
                type="number"
                min={1}
                value={includedPhotos}
                onChange={(e) => setIncludedPhotos(parseInt(e.target.value) || 0)}
                className="max-w-[200px]"
              />
            </div>

            <ClientModal
              open={isClientModalOpen}
              onOpenChange={setIsClientModalOpen}
              onSave={handleSaveClient}
            />
          </div>
        );

      case 2:
        return (
          <div className="space-y-8 animate-fade-in">
            <div>
              <h2 className="font-display text-2xl font-semibold mb-2">
                Configurar Venda de Fotos
              </h2>
              <p className="text-muted-foreground">
                Defina como será a cobrança por fotos extras
              </p>
            </div>

            {/* Sale Mode Selection */}
            <div className="space-y-4">
              <Label className="text-base font-medium">Configurar venda de fotos?</Label>
              <RadioGroup
                value={saleMode}
                onValueChange={(v) => setSaleMode(v as SaleMode)}
                className="grid gap-4 md:grid-cols-3"
              >
                {/* No Sale */}
                <div>
                  <RadioGroupItem value="no_sale" id="sale-no" className="peer sr-only" />
                  <Label
                    htmlFor="sale-no"
                    className={cn(
                      "flex flex-col items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all h-full",
                      "hover:border-primary/50 hover:bg-muted/50",
                      saleMode === 'no_sale' 
                        ? "border-primary bg-primary/5" 
                        : "border-border"
                    )}
                  >
                    <div className={cn(
                      "w-12 h-12 rounded-full flex items-center justify-center",
                      saleMode === 'no_sale' ? "bg-primary/20" : "bg-muted"
                    )}>
                      <Ban className={cn(
                        "h-6 w-6",
                        saleMode === 'no_sale' ? "text-primary" : "text-muted-foreground"
                      )} />
                    </div>
                    <div className="text-center">
                      <p className="font-medium">Não, sem venda</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        O cliente não será informado sobre os preços das fotos
                      </p>
                    </div>
                  </Label>
                </div>

                {/* Sale with Payment */}
                <div>
                  <RadioGroupItem value="sale_with_payment" id="sale-payment" className="peer sr-only" />
                  <Label
                    htmlFor="sale-payment"
                    className={cn(
                      "flex flex-col items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all h-full relative",
                      "hover:border-primary/50 hover:bg-muted/50",
                      saleMode === 'sale_with_payment' 
                        ? "border-primary bg-primary/5" 
                        : "border-border"
                    )}
                  >
                    <Badge variant="secondary" className="absolute -top-2 right-2 text-xs">
                      Em breve
                    </Badge>
                    <div className={cn(
                      "w-12 h-12 rounded-full flex items-center justify-center",
                      saleMode === 'sale_with_payment' ? "bg-primary/20" : "bg-muted"
                    )}>
                      <CreditCard className={cn(
                        "h-6 w-6",
                        saleMode === 'sale_with_payment' ? "text-primary" : "text-muted-foreground"
                      )} />
                    </div>
                    <div className="text-center">
                      <p className="font-medium">Sim, COM pagamento</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        O cliente será cobrado ao finalizar a seleção
                      </p>
                    </div>
                  </Label>
                </div>

                {/* Sale without Payment */}
                <div>
                  <RadioGroupItem value="sale_without_payment" id="sale-no-payment" className="peer sr-only" />
                  <Label
                    htmlFor="sale-no-payment"
                    className={cn(
                      "flex flex-col items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all h-full",
                      "hover:border-primary/50 hover:bg-muted/50",
                      saleMode === 'sale_without_payment' 
                        ? "border-primary bg-primary/5" 
                        : "border-border"
                    )}
                  >
                    <div className={cn(
                      "w-12 h-12 rounded-full flex items-center justify-center",
                      saleMode === 'sale_without_payment' ? "bg-primary/20" : "bg-muted"
                    )}>
                      <Receipt className={cn(
                        "h-6 w-6",
                        saleMode === 'sale_without_payment' ? "text-primary" : "text-muted-foreground"
                      )} />
                    </div>
                    <div className="text-center">
                      <p className="font-medium">Sim, SEM pagamento</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        O cliente será apenas informado sobre os preços
                      </p>
                    </div>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Pricing Model - Only show if sale is enabled */}
            {saleMode !== 'no_sale' && (
              <>
                <div className="h-px bg-border" />
                
                <div className="space-y-4">
                  <Label className="text-base font-medium">Qual formato de preço deseja usar?</Label>
                  <RadioGroup
                    value={pricingModel}
                    onValueChange={(v) => setPricingModel(v as PricingModel)}
                    className="grid gap-4 md:grid-cols-2"
                  >
                    {/* Fixed Price */}
                    <div>
                      <RadioGroupItem value="fixed" id="pricing-fixed" className="peer sr-only" />
                      <Label
                        htmlFor="pricing-fixed"
                        className={cn(
                          "flex flex-col gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all h-full",
                          "hover:border-primary/50 hover:bg-muted/50",
                          pricingModel === 'fixed' 
                            ? "border-primary bg-primary/5" 
                            : "border-border"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center",
                            pricingModel === 'fixed' ? "bg-primary/20" : "bg-muted"
                          )}>
                            <Tag className={cn(
                              "h-5 w-5",
                              pricingModel === 'fixed' ? "text-primary" : "text-muted-foreground"
                            )} />
                          </div>
                          <div>
                            <p className="font-medium">Preço único por foto</p>
                            <p className="text-xs text-muted-foreground">
                              Defina um valor fixo para cada foto
                            </p>
                          </div>
                        </div>
                        
                        {pricingModel === 'fixed' && (
                          <div className="pt-3 border-t border-border/50">
                            <Label htmlFor="fixedPrice" className="text-sm">Valor por foto (R$)</Label>
                            <Input
                              id="fixedPrice"
                              type="number"
                              min={0}
                              step={0.01}
                              value={fixedPrice}
                              onChange={(e) => setFixedPrice(parseFloat(e.target.value) || 0)}
                              className="mt-2"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        )}
                      </Label>
                    </div>

                    {/* Packages with Discount */}
                    <div>
                      <RadioGroupItem value="packages" id="pricing-packages" className="peer sr-only" />
                      <Label
                        htmlFor="pricing-packages"
                        className={cn(
                          "flex flex-col gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all h-full relative",
                          "hover:border-primary/50 hover:bg-muted/50",
                          pricingModel === 'packages' 
                            ? "border-primary bg-primary/5" 
                            : "border-border"
                        )}
                      >
                        <Badge className="absolute -top-2 right-2 text-xs bg-green-500">
                          Novo
                        </Badge>
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center",
                            pricingModel === 'packages' ? "bg-primary/20" : "bg-muted"
                          )}>
                            <Package className={cn(
                              "h-5 w-5",
                              pricingModel === 'packages' ? "text-primary" : "text-muted-foreground"
                            )} />
                          </div>
                          <div>
                            <p className="font-medium">Pacotes com descontos</p>
                            <p className="text-xs text-muted-foreground">
                              Descontos progressivos por quantidade
                            </p>
                          </div>
                        </div>
                      </Label>
                    </div>
                  </RadioGroup>

                  {/* Discount Packages Configuration */}
                  {pricingModel === 'packages' && (
                    <div className="space-y-4 p-4 rounded-lg bg-muted/30 border border-border/50">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">Configurar pacotes</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={addDiscountPackage}
                          className="gap-1"
                        >
                          <Plus className="h-4 w-4" />
                          Adicionar faixa
                        </Button>
                      </div>

                      {discountPackages.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          Adicione pacotes para definir preços por faixa de quantidade
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {discountPackages.map((pkg, index) => (
                            <div key={pkg.id} className="flex items-center gap-3 p-3 rounded-lg bg-background border border-border/50">
                              <div className="flex-1 grid grid-cols-3 gap-3">
                                <div className="space-y-1">
                                  <Label className="text-xs text-muted-foreground">De (fotos)</Label>
                                  <Input
                                    type="number"
                                    min={1}
                                    value={pkg.minPhotos}
                                    onChange={(e) => updateDiscountPackage(pkg.id, 'minPhotos', parseInt(e.target.value) || 1)}
                                    className="h-9"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs text-muted-foreground">Até (fotos)</Label>
                                  <Input
                                    type="number"
                                    min={pkg.minPhotos}
                                    value={pkg.maxPhotos}
                                    onChange={(e) => updateDiscountPackage(pkg.id, 'maxPhotos', parseInt(e.target.value) || pkg.minPhotos)}
                                    className="h-9"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs text-muted-foreground">Valor (R$)</Label>
                                  <Input
                                    type="number"
                                    min={0}
                                    step={0.01}
                                    value={pkg.pricePerPhoto}
                                    onChange={(e) => updateDiscountPackage(pkg.id, 'pricePerPhoto', parseFloat(e.target.value) || 0)}
                                    className="h-9"
                                  />
                                </div>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeDiscountPackage(pkg.id)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="pt-2 border-t border-border/50">
                        <Label htmlFor="basePrice" className="text-sm">Preço base (para faixas não configuradas)</Label>
                        <Input
                          id="basePrice"
                          type="number"
                          min={0}
                          step={0.01}
                          value={fixedPrice}
                          onChange={(e) => setFixedPrice(parseFloat(e.target.value) || 0)}
                          className="mt-2 max-w-[150px]"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="h-px bg-border" />

                {/* Charge Type */}
                <div className="space-y-3">
                  <Label className="text-base font-medium">Tipo de cobrança</Label>
                  <Select value={chargeType} onValueChange={(v) => setChargeType(v as ChargeType)}>
                    <SelectTrigger className="max-w-md">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="only_extras">Cobrar apenas as fotos extras</SelectItem>
                      <SelectItem value="all_selected">Cobrar todas as fotos selecionadas</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    {chargeType === 'only_extras' 
                      ? `Fotos até o limite do pacote (${includedPhotos}) são gratuitas. Apenas fotos além desse limite serão cobradas.`
                      : `Todas as fotos selecionadas serão cobradas, independente do pacote.`
                    }
                  </p>
                </div>
              </>
            )}
          </div>
        );

      case 3:
        return (
          <div className="space-y-6 animate-fade-in">
            <div>
              <h2 className="font-display text-2xl font-semibold mb-2">
                Upload de Fotos
              </h2>
              <p className="text-muted-foreground">
                Adicione as fotos da sessão para o cliente selecionar
              </p>
            </div>

            <div 
              className="border-2 border-dashed border-border rounded-xl p-12 text-center hover:border-primary/50 transition-colors cursor-pointer"
              onClick={mockUpload}
            >
              <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-2">
                Arraste as fotos aqui ou clique para selecionar
              </p>
              <p className="text-sm text-muted-foreground">
                Suporta JPG, PNG, RAW • Máx. 50MB por arquivo
              </p>
            </div>

            {uploadedCount > 0 && (
              <div className="lunari-card p-4">
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
              </div>
            )}

            <div className="p-4 rounded-lg bg-muted/50 text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">ℹ️ Informação técnica</p>
              <p>
                O upload original gera automaticamente versões derivadas (thumbnail + preview). 
                O arquivo original nunca é servido ao cliente, garantindo proteção das suas fotos.
              </p>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-8 animate-fade-in">
            <div>
              <h2 className="font-display text-2xl font-semibold mb-2">
                Configurações da Galeria
              </h2>
              <p className="text-muted-foreground">
                Personalize a experiência do cliente
              </p>
            </div>

            {/* Welcome Message */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" />
                <Label>Mensagem de Saudação</Label>
              </div>
              <Textarea
                value={welcomeMessage}
                onChange={(e) => setWelcomeMessage(e.target.value)}
                placeholder="Personalize a mensagem de boas-vindas..."
                rows={5}
                className="resize-none"
              />
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
              <RadioGroup 
                value={String(deadlinePreset)} 
                onValueChange={(v) => setDeadlinePreset(v === 'custom' ? 'custom' : parseInt(v) as DeadlinePreset)}
                className="flex flex-wrap gap-3"
              >
                {[7, 10, 15].map((days) => (
                  <div key={days} className="flex items-center">
                    <RadioGroupItem value={String(days)} id={`days-${days}`} className="peer sr-only" />
                    <Label
                      htmlFor={`days-${days}`}
                      className="px-4 py-2 rounded-lg border cursor-pointer peer-data-[state=checked]:bg-primary peer-data-[state=checked]:text-primary-foreground peer-data-[state=checked]:border-primary"
                    >
                      {days} dias
                    </Label>
                  </div>
                ))}
                <div className="flex items-center">
                  <RadioGroupItem value="custom" id="days-custom" className="peer sr-only" />
                  <Label
                    htmlFor="days-custom"
                    className="px-4 py-2 rounded-lg border cursor-pointer peer-data-[state=checked]:bg-primary peer-data-[state=checked]:text-primary-foreground peer-data-[state=checked]:border-primary"
                  >
                    Personalizado
                  </Label>
                </div>
              </RadioGroup>
              {deadlinePreset === 'custom' && (
                <div className="flex items-center gap-2 mt-2">
                  <Input
                    type="number"
                    min={1}
                    max={90}
                    value={customDays}
                    onChange={(e) => setCustomDays(parseInt(e.target.value) || 10)}
                    className="w-24"
                  />
                  <span className="text-muted-foreground">dias</span>
                </div>
              )}
            </div>

            {/* Image Resize */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Image className="h-4 w-4 text-primary" />
                <Label>Tamanho das Imagens</Label>
              </div>
              <p className="text-sm text-muted-foreground">
                Redimensiona as imagens para economia de armazenamento e carregamento mais rápido
              </p>
              <RadioGroup 
                value={String(imageResizeOption)} 
                onValueChange={(v) => setImageResizeOption(parseInt(v) as ImageResizeOption)}
                className="flex flex-wrap gap-3"
              >
                {[640, 800, 1024, 1920].map((size) => (
                  <div key={size} className="flex items-center">
                    <RadioGroupItem value={String(size)} id={`size-${size}`} className="peer sr-only" />
                    <Label
                      htmlFor={`size-${size}`}
                      className={cn(
                        "px-4 py-2 rounded-lg border cursor-pointer peer-data-[state=checked]:bg-primary peer-data-[state=checked]:text-primary-foreground peer-data-[state=checked]:border-primary",
                        size === 800 && "ring-1 ring-primary/30"
                      )}
                    >
                      {size} px
                    </Label>
                  </div>
                ))}
              </RadioGroup>
              <p className="text-xs text-muted-foreground">Lado maior • 800px é o padrão recomendado</p>
            </div>

            {/* Watermark */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Droplet className="h-4 w-4 text-primary" />
                <Label>Marca D'água</Label>
              </div>
              <RadioGroup 
                value={watermarkType} 
                onValueChange={(v) => setWatermarkType(v as WatermarkType)}
                className="flex flex-wrap gap-3"
              >
                <div className="flex items-center">
                  <RadioGroupItem value="none" id="wm-none" className="peer sr-only" />
                  <Label
                    htmlFor="wm-none"
                    className="px-4 py-2 rounded-lg border cursor-pointer peer-data-[state=checked]:bg-primary peer-data-[state=checked]:text-primary-foreground peer-data-[state=checked]:border-primary"
                  >
                    Nenhuma
                  </Label>
                </div>
                <div className="flex items-center">
                  <RadioGroupItem value="text" id="wm-text" className="peer sr-only" />
                  <Label
                    htmlFor="wm-text"
                    className="px-4 py-2 rounded-lg border cursor-pointer peer-data-[state=checked]:bg-primary peer-data-[state=checked]:text-primary-foreground peer-data-[state=checked]:border-primary"
                  >
                    Texto
                  </Label>
                </div>
                <div className="flex items-center">
                  <RadioGroupItem value="logo" id="wm-logo" className="peer sr-only" />
                  <Label
                    htmlFor="wm-logo"
                    className="px-4 py-2 rounded-lg border cursor-pointer peer-data-[state=checked]:bg-primary peer-data-[state=checked]:text-primary-foreground peer-data-[state=checked]:border-primary"
                  >
                    Logo
                  </Label>
                </div>
              </RadioGroup>

              {watermarkType === 'text' && (
                <Input
                  placeholder="Texto da marca d'água"
                  value={watermarkText}
                  onChange={(e) => setWatermarkText(e.target.value)}
                />
              )}

              {watermarkType === 'logo' && (
                <div className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors">
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Clique para fazer upload do logo
                  </p>
                </div>
              )}

              {watermarkType !== 'none' && (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Opacidade</Label>
                      <span className="text-sm text-muted-foreground">{watermarkOpacity}%</span>
                    </div>
                    <Slider
                      value={[watermarkOpacity]}
                      onValueChange={(v) => setWatermarkOpacity(v[0])}
                      min={10}
                      max={100}
                      step={5}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Onde aplicar</Label>
                    <Select value={watermarkDisplay} onValueChange={(v) => setWatermarkDisplay(v as WatermarkDisplay)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Sim, nas fotos ampliadas e miniaturas</SelectItem>
                        <SelectItem value="fullscreen">Sim, somente nas fotos ampliadas</SelectItem>
                        <SelectItem value="none">Não aplicar</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </div>

            {/* Client Interactions */}
            <div className="space-y-4">
              <h3 className="font-medium">Interações do Cliente</h3>
              
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium">Permitir comentários</p>
                  <p className="text-sm text-muted-foreground">
                    Cliente pode deixar um comentário por foto
                  </p>
                </div>
                <Switch checked={allowComments} onCheckedChange={setAllowComments} />
              </div>

              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium">Permitir download</p>
                  <p className="text-sm text-muted-foreground">
                    Cliente poderá baixar as imagens a qualquer momento
                  </p>
                </div>
                <Switch checked={allowDownload} onCheckedChange={setAllowDownload} />
              </div>

              {saleMode !== 'no_sale' && (
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="font-medium">Permitir fotos extras</p>
                    <p className="text-sm text-muted-foreground">
                      Cliente pode selecionar além do limite incluso
                    </p>
                  </div>
                  <Switch checked={allowExtraPhotos} onCheckedChange={setAllowExtraPhotos} />
                </div>
              )}
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-6 animate-fade-in">
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
                  {saleMode !== 'no_sale' && (
                    <>
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
                      {pricingModel === 'packages' && discountPackages.length > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Pacotes de desconto</span>
                          <span className="font-medium">{discountPackages.length} configurados</span>
                        </div>
                      )}
                    </>
                  )}
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
                    <span className="font-medium">{getDaysFromPreset()} dias</span>
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
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
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

          return (
            <div key={step.id} className="flex items-center">
              <div className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-full transition-colors whitespace-nowrap',
                isActive && 'bg-primary text-primary-foreground',
                isCompleted && 'bg-primary/20 text-primary',
                !isActive && !isCompleted && 'text-muted-foreground'
              )}>
                {isCompleted ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
                <span className="text-sm font-medium hidden sm:block">
                  {step.name}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div className={cn(
                  'h-px w-4 md:w-12 mx-1 md:mx-2',
                  isCompleted ? 'bg-primary' : 'bg-border'
                )} />
              )}
            </div>
          );
        })}
      </div>

      {/* Step Content */}
      <div className="lunari-card p-6 md:p-8">
        {renderStep()}
      </div>

      {/* Navigation */}
      <div className="flex justify-between mt-6">
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
  );
}