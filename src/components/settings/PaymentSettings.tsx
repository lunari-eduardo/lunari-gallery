import { useState, useEffect } from 'react';
import { CreditCard, AlertTriangle, CheckCircle, ExternalLink, Loader2, Star, Edit2, Power, Plus, Smartphone, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { 
  usePaymentIntegration, 
  PixManualData, 
  InfinitePayData,
  PixKeyType,
  PaymentProvider,
  getProviderLabel,
  getPixKeyTypeLabel,
} from '@/hooks/usePaymentIntegration';
import { cn } from '@/lib/utils';

export function PaymentSettings() {
  const { 
    data, 
    isLoading, 
    savePixManual, 
    saveInfinitePay, 
    setAsDefault,
    deactivate,
  } = usePaymentIntegration();

  // Form visibility states
  const [showPixForm, setShowPixForm] = useState(false);
  const [showIpForm, setShowIpForm] = useState(false);
  
  // PIX Manual fields
  const [chavePix, setChavePix] = useState('');
  const [tipoChave, setTipoChave] = useState<PixKeyType>('telefone');
  const [nomeTitular, setNomeTitular] = useState('');

  // InfinitePay fields
  const [handle, setHandle] = useState('');

  // Load existing data when available
  useEffect(() => {
    if (data?.allIntegrations) {
      const pixIntegration = data.allIntegrations.find(i => i.provedor === 'pix_manual');
      if (pixIntegration?.dadosExtras) {
        const pixData = pixIntegration.dadosExtras as PixManualData;
        setChavePix(pixData.chavePix || '');
        setTipoChave(pixData.tipoChave || 'telefone');
        setNomeTitular(pixData.nomeTitular || '');
      }
      
      const ipIntegration = data.allIntegrations.find(i => i.provedor === 'infinitepay');
      if (ipIntegration?.dadosExtras) {
        const ipData = ipIntegration.dadosExtras as InfinitePayData;
        setHandle(ipData.handle || '');
      }
    }
  }, [data?.allIntegrations]);

  const handleSavePix = async () => {
    if (!chavePix.trim() || !nomeTitular.trim()) return;
    
    await savePixManual.mutateAsync({
      chavePix: chavePix.trim(),
      tipoChave,
      nomeTitular: nomeTitular.trim(),
      setAsDefault: !data?.hasPayment, // Only set as default if no other method
    });
    setShowPixForm(false);
  };

  const handleSaveInfinitePay = async () => {
    if (!handle.trim()) return;
    
    await saveInfinitePay.mutateAsync({
      handle: handle.trim().replace('@', ''),
      setAsDefault: !data?.hasPayment,
    });
    setShowIpForm(false);
  };

  const getProviderIcon = (provedor: PaymentProvider) => {
    switch (provedor) {
      case 'pix_manual': return <Smartphone className="h-5 w-5" />;
      case 'infinitepay': return <Zap className="h-5 w-5" />;
      case 'mercadopago': return <CreditCard className="h-5 w-5" />;
    }
  };

  const getProviderColor = (provedor: PaymentProvider) => {
    switch (provedor) {
      case 'pix_manual': return 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400';
      case 'infinitepay': return 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400';
      case 'mercadopago': return 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const pixIntegration = data?.allIntegrations.find(i => i.provedor === 'pix_manual');
  const ipIntegration = data?.allIntegrations.find(i => i.provedor === 'infinitepay');

  return (
    <div className="space-y-6">
      {/* Active Payment Methods */}
      {data?.allActiveIntegrations && data.allActiveIntegrations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Métodos de Pagamento Ativos
            </CardTitle>
            <CardDescription>
              Selecione qual será o método padrão para novas galerias
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.allActiveIntegrations.map((integration) => (
              <div
                key={integration.id}
                className={cn(
                  "flex items-center justify-between p-4 rounded-lg border",
                  integration.isDefault ? "border-primary bg-primary/5" : "border-border"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", getProviderColor(integration.provedor))}>
                    {getProviderIcon(integration.provedor)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{getProviderLabel(integration.provedor)}</span>
                      {integration.isDefault && (
                        <Badge variant="default" className="gap-1 text-xs">
                          <Star className="h-3 w-3" />
                          Padrão
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {integration.provedor === 'pix_manual' && (integration.dadosExtras as PixManualData)?.nomeTitular}
                      {integration.provedor === 'infinitepay' && `@${(integration.dadosExtras as InfinitePayData)?.handle}`}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {!integration.isDefault && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAsDefault.mutate(integration.id)}
                      disabled={setAsDefault.isPending}
                    >
                      <Star className="h-4 w-4 mr-1" />
                      Definir Padrão
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (integration.provedor === 'pix_manual') setShowPixForm(true);
                      if (integration.provedor === 'infinitepay') setShowIpForm(true);
                    }}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deactivate.mutate(integration.provedor)}
                    disabled={deactivate.isPending}
                  >
                    <Power className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            
            {data.allActiveIntegrations.some(i => i.provedor === 'pix_manual') && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-900/50">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  <strong>PIX Manual:</strong> Você precisará confirmar manualmente o recebimento dos pagamentos.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Add PIX Manual */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-green-600" />
            PIX Manual
          </CardTitle>
          <CardDescription>
            Receba pagamentos via PIX com confirmação manual
          </CardDescription>
        </CardHeader>
        <CardContent>
          {showPixForm ? (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-warning/10 border border-warning/30">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-warning-foreground">
                    <p className="font-medium">Confirmação manual necessária</p>
                    <p className="text-muted-foreground mt-1">
                      Você precisará verificar o recebimento e liberar a galeria manualmente.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="pix-tipo">Tipo de Chave</Label>
                  <Select value={tipoChave} onValueChange={(v) => setTipoChave(v as PixKeyType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="telefone">Telefone</SelectItem>
                      <SelectItem value="cpf">CPF</SelectItem>
                      <SelectItem value="cnpj">CNPJ</SelectItem>
                      <SelectItem value="email">E-mail</SelectItem>
                      <SelectItem value="aleatoria">Chave Aleatória</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pix-chave">Chave PIX</Label>
                  <Input
                    id="pix-chave"
                    value={chavePix}
                    onChange={(e) => setChavePix(e.target.value)}
                    placeholder="Sua chave PIX"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="pix-nome">Nome do Titular</Label>
                <Input
                  id="pix-nome"
                  value={nomeTitular}
                  onChange={(e) => setNomeTitular(e.target.value)}
                  placeholder="Nome que aparecerá para o cliente"
                />
              </div>
              
              <div className="flex gap-2">
                <Button
                  onClick={handleSavePix}
                  disabled={!chavePix.trim() || !nomeTitular.trim() || savePixManual.isPending}
                >
                  {savePixManual.isPending ? 'Salvando...' : 'Salvar PIX'}
                </Button>
                <Button variant="ghost" onClick={() => setShowPixForm(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : pixIntegration ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center",
                  pixIntegration.status === 'ativo' ? "bg-green-100 dark:bg-green-900/30" : "bg-muted"
                )}>
                  <Smartphone className={cn(
                    "h-5 w-5",
                    pixIntegration.status === 'ativo' ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
                  )} />
                </div>
                <div>
                  <p className="font-medium">{(pixIntegration.dadosExtras as PixManualData)?.nomeTitular}</p>
                  <p className="text-sm text-muted-foreground">
                    {getPixKeyTypeLabel((pixIntegration.dadosExtras as PixManualData)?.tipoChave)} • {(pixIntegration.dadosExtras as PixManualData)?.chavePix}
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowPixForm(true)}>
                <Edit2 className="h-4 w-4 mr-2" />
                Editar
              </Button>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setShowPixForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Configurar PIX
            </Button>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Add InfinitePay */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-purple-600" />
            InfinitePay
          </CardTitle>
          <CardDescription>
            Receba pagamentos com confirmação automática via checkout
          </CardDescription>
        </CardHeader>
        <CardContent>
          {showIpForm ? (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-green-700 dark:text-green-300">
                      Confirmação automática
                    </p>
                    <p className="text-green-600 dark:text-green-400 mt-1">
                      O sistema libera a galeria automaticamente após o pagamento.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ip-handle">Handle InfinitePay</Label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-muted text-sm text-muted-foreground">
                    @
                  </span>
                  <Input
                    id="ip-handle"
                    value={handle}
                    onChange={(e) => setHandle(e.target.value.replace('@', ''))}
                    placeholder="seu-handle"
                    className="rounded-l-none"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  O handle é o identificador único do seu perfil InfinitePay
                </p>
              </div>

              <a
                href="https://infinitepay.io"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                Não tem conta? Criar conta InfinitePay
                <ExternalLink className="h-3 w-3" />
              </a>
              
              <div className="flex gap-2">
                <Button
                  onClick={handleSaveInfinitePay}
                  disabled={!handle.trim() || saveInfinitePay.isPending}
                >
                  {saveInfinitePay.isPending ? 'Salvando...' : 'Salvar InfinitePay'}
                </Button>
                <Button variant="ghost" onClick={() => setShowIpForm(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : ipIntegration ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center",
                  ipIntegration.status === 'ativo' ? "bg-purple-100 dark:bg-purple-900/30" : "bg-muted"
                )}>
                  <Zap className={cn(
                    "h-5 w-5",
                    ipIntegration.status === 'ativo' ? "text-purple-600 dark:text-purple-400" : "text-muted-foreground"
                  )} />
                </div>
                <div>
                  <p className="font-medium">@{(ipIntegration.dadosExtras as InfinitePayData)?.handle}</p>
                  <p className="text-sm text-muted-foreground">
                    {ipIntegration.status === 'ativo' ? 'Ativo' : 'Inativo'}
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowIpForm(true)}>
                <Edit2 className="h-4 w-4 mr-2" />
                Editar
              </Button>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setShowIpForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Configurar InfinitePay
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
