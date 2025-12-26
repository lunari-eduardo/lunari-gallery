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
  Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { defaultWelcomeMessage } from '@/data/mockData';
import { DeadlinePreset, WatermarkType, PreviewResolution, DownloadOption } from '@/types/gallery';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const steps = [
  { id: 1, name: 'Cliente', icon: User },
  { id: 2, name: 'Fotos', icon: Image },
  { id: 3, name: 'Configurações', icon: Settings },
  { id: 4, name: 'Revisão', icon: Check },
];

export default function GalleryCreate() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  
  // Step 1: Client Info
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [sessionName, setSessionName] = useState('');
  const [packageName, setPackageName] = useState('');
  const [includedPhotos, setIncludedPhotos] = useState(30);
  const [extraPhotoPrice, setExtraPhotoPrice] = useState(25);
  
  // Step 2: Photos (mock)
  const [uploadedCount, setUploadedCount] = useState(0);
  
  // Step 3: Settings
  const [welcomeMessage, setWelcomeMessage] = useState(defaultWelcomeMessage);
  const [deadlinePreset, setDeadlinePreset] = useState<DeadlinePreset>(7);
  const [customDays, setCustomDays] = useState(10);
  const [watermarkType, setWatermarkType] = useState<WatermarkType>('text');
  const [watermarkText, setWatermarkText] = useState('Studio Lunari');
  const [watermarkOpacity, setWatermarkOpacity] = useState(30);
  const [previewResolution, setPreviewResolution] = useState<PreviewResolution>('medium');
  const [allowComments, setAllowComments] = useState(true);
  const [downloadOption, setDownloadOption] = useState<DownloadOption>('after_selection');
  const [allowExtraPhotos, setAllowExtraPhotos] = useState(true);

  const handleNext = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    } else {
      // Create gallery (mock)
      toast.success('Galeria criada com sucesso!', {
        description: 'Você pode enviar o link para o cliente agora.',
      });
      navigate('/');
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

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="clientName">Nome do Cliente *</Label>
                <Input
                  id="clientName"
                  placeholder="Ex: Maria Silva"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clientEmail">Email do Cliente *</Label>
                <Input
                  id="clientEmail"
                  type="email"
                  placeholder="cliente@email.com"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                />
              </div>
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

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="includedPhotos">Fotos Incluídas no Pacote *</Label>
                <Input
                  id="includedPhotos"
                  type="number"
                  min={1}
                  value={includedPhotos}
                  onChange={(e) => setIncludedPhotos(parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="extraPhotoPrice">Valor por Foto Extra (R$)</Label>
                <Input
                  id="extraPhotoPrice"
                  type="number"
                  min={0}
                  step={0.01}
                  value={extraPhotoPrice}
                  onChange={(e) => setExtraPhotoPrice(parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
          </div>
        );

      case 2:
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

      case 3:
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
              )}
            </div>

            {/* Preview Resolution */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-primary" />
                <Label>Resolução de Visualização</Label>
              </div>
              <Select value={previewResolution} onValueChange={(v) => setPreviewResolution(v as PreviewResolution)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixa (mais rápida)</SelectItem>
                  <SelectItem value="medium">Média (recomendada)</SelectItem>
                  <SelectItem value="high">Alta (mais lenta)</SelectItem>
                </SelectContent>
              </Select>
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

              <div className="space-y-2">
                <Label>Opção de Download</Label>
                <Select value={downloadOption} onValueChange={(v) => setDownloadOption(v as DownloadOption)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="disabled">Desativado</SelectItem>
                    <SelectItem value="allowed">Permitido (sem marca d'água)</SelectItem>
                    <SelectItem value="after_selection">Após seleção concluída</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium">Permitir fotos extras</p>
                  <p className="text-sm text-muted-foreground">
                    Cliente pode selecionar além do limite incluso
                  </p>
                </div>
                <Switch checked={allowExtraPhotos} onCheckedChange={setAllowExtraPhotos} />
              </div>
            </div>
          </div>
        );

      case 4:
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
                    <span className="font-medium">{clientName || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Email</span>
                    <span className="font-medium">{clientEmail || '-'}</span>
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
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Valor extra</span>
                    <span className="font-medium">R$ {extraPhotoPrice.toFixed(2)}</span>
                  </div>
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
                    <span className="text-muted-foreground">Marca d'água</span>
                    <span className="font-medium capitalize">{watermarkType === 'none' ? 'Nenhuma' : watermarkType}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Resolução</span>
                    <span className="font-medium capitalize">{previewResolution}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Comentários</span>
                    <span className="font-medium">{allowComments ? 'Sim' : 'Não'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Download</span>
                    <span className="font-medium capitalize">
                      {downloadOption === 'disabled' ? 'Desativado' : 
                       downloadOption === 'allowed' ? 'Permitido' : 'Após seleção'}
                    </span>
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
      <div className="flex items-center justify-between mb-8">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isActive = currentStep === step.id;
          const isCompleted = currentStep > step.id;

          return (
            <div key={step.id} className="flex items-center">
              <div className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-full transition-colors',
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
                  'h-px w-8 md:w-16 mx-2',
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
          {currentStep === 4 ? 'Criar Galeria' : 'Próximo'}
          {currentStep < 4 && <ArrowRight className="h-4 w-4 ml-2" />}
        </Button>
      </div>
    </div>
  );
}
