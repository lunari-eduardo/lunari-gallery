import { useState, useEffect, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CreditCard, AlertTriangle, CheckCircle, ExternalLink, Loader2, Star, Edit2, Power, Plus, Link2, RefreshCw, HelpCircle, QrCode, Zap, Building2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  usePaymentIntegration, 
  PixManualData, 
  InfinitePayData,
  MercadoPagoData,
  AsaasData,
  PixKeyType,
  PaymentProvider,
  getProviderLabel,
  getPixKeyTypeLabel,
} from '@/hooks/usePaymentIntegration';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { pixLogo, infinitepayLogo, mercadopagoLogo, asaasLogo } from '@/assets/payment-logos';
import { calcularAntecipacao } from '@/lib/anticipationUtils';

export function PaymentSettings() {
  const location = useLocation();
  const navigate = useNavigate();
  
  const { 
    data, 
    isLoading, 
    savePixManual, 
    saveInfinitePay, 
    saveAsaas,
    updateAsaasSettings,
    setAsDefault,
    deactivate,
    connectMercadoPago,
    updateMercadoPagoSettings,
    getMercadoPagoOAuthUrl,
    mpAppId,
  } = usePaymentIntegration();

  // Form visibility states
  const [showPixForm, setShowPixForm] = useState(false);
  const [showIpForm, setShowIpForm] = useState(false);
  const [showMpSettings, setShowMpSettings] = useState(false);
  const [showAsaasForm, setShowAsaasForm] = useState(false);
  const [showAsaasSettings, setShowAsaasSettings] = useState(false);
  
  // PIX Manual fields
  const [chavePix, setChavePix] = useState('');
  const [tipoChave, setTipoChave] = useState<PixKeyType>('telefone');
  const [nomeTitular, setNomeTitular] = useState('');

  // InfinitePay fields
  const [handle, setHandle] = useState('');

  // Mercado Pago settings
  const [mpHabilitarPix, setMpHabilitarPix] = useState(true);
  const [mpHabilitarCartao, setMpHabilitarCartao] = useState(true);
  const [mpMaxParcelas, setMpMaxParcelas] = useState('12');
  const [mpAbsorverTaxa, setMpAbsorverTaxa] = useState(false);

  // Asaas fields
  const [asaasApiKey, setAsaasApiKey] = useState('');
  const [asaasShowKey, setAsaasShowKey] = useState(false);
  const [asaasEnvironment, setAsaasEnvironment] = useState<'sandbox' | 'production'>('sandbox');
  const [asaasHabilitarPix, setAsaasHabilitarPix] = useState(true);
  const [asaasHabilitarCartao, setAsaasHabilitarCartao] = useState(true);
  const [asaasHabilitarBoleto, setAsaasHabilitarBoleto] = useState(false);
  const [asaasMaxParcelas, setAsaasMaxParcelas] = useState('12');
  const [asaasAbsorverTaxa, setAsaasAbsorverTaxa] = useState(false);
  
  // Real-time fees from Asaas API
  const [asaasFees, setAsaasFees] = useState<{
    creditCard: {
      operationValue: number;
      detachedMonthlyFeeValue: number;
      installmentMonthlyFeeValue: number;
      tiers: Array<{ min: number; max: number; percentageFee: number }>;
    };
    pix: { fixedFeeValue: number };
  } | null>(null);
  const [asaasFeesLoading, setAsaasFeesLoading] = useState(false);

  // Ref to prevent duplicate OAuth callback processing
  const hasProcessedCallback = useRef(false);
  const connectMercadoPagoRef = useRef(connectMercadoPago);
  const navigateRef = useRef(navigate);
  
  // Keep refs updated
  useEffect(() => {
    connectMercadoPagoRef.current = connectMercadoPago;
    navigateRef.current = navigate;
  });

  // Handle OAuth callback - runs only once per code
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const isCallback = params.get('mp_callback');
    const code = params.get('code');
    
    // Guard against duplicate processing
    if (!isCallback || !code || hasProcessedCallback.current) {
      return;
    }
    
    hasProcessedCallback.current = true;
    
    // Always use production domain for OAuth redirect consistency
    const redirectUri = 'https://gallery.lunarihub.com/settings?mp_callback=true';
    connectMercadoPagoRef.current.mutate({ code, redirect_uri: redirectUri }, {
      onSettled: () => {
        // Clean URL after processing
        navigateRef.current('/settings?tab=payment', { replace: true });
      },
    });
  }, [location.search]);

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

      const mpIntegration = data.allIntegrations.find(i => i.provedor === 'mercadopago');
      if (mpIntegration?.dadosExtras) {
        const mpData = mpIntegration.dadosExtras as MercadoPagoData;
        setMpHabilitarPix(mpData.habilitarPix ?? true);
        setMpHabilitarCartao(mpData.habilitarCartao ?? true);
        setMpMaxParcelas(String(mpData.maxParcelas ?? 12));
        setMpAbsorverTaxa(mpData.absorverTaxa ?? false);
      }

      const asaasIntegration = data.allIntegrations.find(i => i.provedor === 'asaas');
      if (asaasIntegration?.dadosExtras) {
        const asData = asaasIntegration.dadosExtras as AsaasData;
        setAsaasEnvironment(asData.environment || 'sandbox');
        setAsaasHabilitarPix(asData.habilitarPix ?? true);
        setAsaasHabilitarCartao(asData.habilitarCartao ?? true);
        setAsaasHabilitarBoleto(asData.habilitarBoleto ?? false);
        setAsaasMaxParcelas(String(asData.maxParcelas ?? 12));
        setAsaasAbsorverTaxa(asData.absorverTaxa ?? false);
      }
    }
  }, [data?.allIntegrations]);

  const handleSavePix = async () => {
    if (!chavePix.trim() || !nomeTitular.trim()) return;
    
    await savePixManual.mutateAsync({
      chavePix: chavePix.trim(),
      tipoChave,
      nomeTitular: nomeTitular.trim(),
      setAsDefault: !data?.hasPayment,
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

  const handleConnectMercadoPago = () => {
    const url = getMercadoPagoOAuthUrl();
    if (url) {
      window.location.href = url;
    }
  };

  const handleSaveMpSettings = async () => {
    await updateMercadoPagoSettings.mutateAsync({
      habilitarPix: mpHabilitarPix,
      habilitarCartao: mpHabilitarCartao,
      maxParcelas: parseInt(mpMaxParcelas),
      absorverTaxa: mpAbsorverTaxa,
    });
    setShowMpSettings(false);
  };

  const handleSaveAsaas = async () => {
    if (!asaasApiKey.trim()) return;
    
    await saveAsaas.mutateAsync({
      apiKey: asaasApiKey.trim(),
      settings: {
        environment: asaasEnvironment,
        habilitarPix: asaasHabilitarPix,
        habilitarCartao: asaasHabilitarCartao,
        habilitarBoleto: asaasHabilitarBoleto,
        maxParcelas: parseInt(asaasMaxParcelas),
        absorverTaxa: asaasAbsorverTaxa,
      },
      setAsDefault: !data?.hasPayment,
    });
    setShowAsaasForm(false);
  };

  const handleSaveAsaasSettings = async () => {
    await updateAsaasSettings.mutateAsync({
      environment: asaasEnvironment,
      habilitarPix: asaasHabilitarPix,
      habilitarCartao: asaasHabilitarCartao,
      habilitarBoleto: asaasHabilitarBoleto,
      maxParcelas: parseInt(asaasMaxParcelas),
      absorverTaxa: asaasAbsorverTaxa,
    });
    setShowAsaasSettings(false);
  };

  const getProviderLogo = (provedor: PaymentProvider) => {
    const logos: Record<string, string> = {
      pix_manual: pixLogo,
      infinitepay: infinitepayLogo,
      mercadopago: mercadopagoLogo,
      asaas: asaasLogo,
    };
    return (
      <img 
        src={logos[provedor]} 
        alt={getProviderLabel(provedor)}
        className="h-6 w-6 object-contain"
      />
    );
  };

  if (isLoading || connectMercadoPago.isPending) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        {connectMercadoPago.isPending && (
          <p className="text-sm text-muted-foreground">Conectando Mercado Pago...</p>
        )}
      </div>
    );
  }

  const pixIntegration = data?.allIntegrations.find(i => i.provedor === 'pix_manual');
  const ipIntegration = data?.allIntegrations.find(i => i.provedor === 'infinitepay');
  const mpIntegration = data?.allIntegrations.find(i => i.provedor === 'mercadopago');
  const asaasIntegration = data?.allIntegrations.find(i => i.provedor === 'asaas');

  return (
    <div className="space-y-6">
      {/* Active Payment Methods */}
      {data?.allActiveIntegrations && data.allActiveIntegrations.length > 0 && (
        <div className="lunari-card p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <CreditCard className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-medium">Métodos de Pagamento Ativos</h2>
              <p className="text-sm text-muted-foreground">
                Selecione qual será o método padrão para novas galerias
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {data.allActiveIntegrations.map((integration) => (
              <div
                key={integration.id}
                className={cn(
                  "flex items-center justify-between p-4 rounded-lg border",
                  integration.isDefault ? "border-primary bg-primary/5" : "border-border"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-muted/50 flex items-center justify-center p-1.5">
                    {getProviderLogo(integration.provedor)}
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
                      {integration.provedor === 'mercadopago' && integration.mpUserId && `ID: ${integration.mpUserId}`}
                      {integration.provedor === 'asaas' && ((integration.dadosExtras as AsaasData)?.environment === 'production' ? 'Produção' : 'Sandbox')}
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
                      if (integration.provedor === 'mercadopago') setShowMpSettings(true);
                      if (integration.provedor === 'asaas') setShowAsaasSettings(true);
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
          </div>
        </div>
      )}

      {/* Mercado Pago OAuth */}
      <div className="lunari-card p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <CreditCard className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-medium">Mercado Pago</h2>
            <p className="text-sm text-muted-foreground">
              Receba pagamentos via PIX e Cartão de Crédito com confirmação automática
            </p>
          </div>
        </div>

          {showMpSettings && mpIntegration ? (
            <div className="space-y-6">
              <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-green-700 dark:text-green-300">
                      Conta conectada
                    </p>
                    <p className="text-green-600 dark:text-green-400 mt-1">
                      O dinheiro vai direto para sua conta Mercado Pago.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium">Métodos de Pagamento</h4>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>PIX</Label>
                    <p className="text-sm text-muted-foreground">Pagamento instantâneo</p>
                  </div>
                  <Switch
                    checked={mpHabilitarPix}
                    onCheckedChange={setMpHabilitarPix}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Cartão de Crédito</Label>
                    <p className="text-sm text-muted-foreground">Parcelamento disponível</p>
                  </div>
                  <Switch
                    checked={mpHabilitarCartao}
                    onCheckedChange={setMpHabilitarCartao}
                  />
                </div>
              </div>

              {mpHabilitarCartao && (
                <div className="space-y-4 pt-2 border-t">
                  <h4 className="font-medium">Parcelamento</h4>
                  
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Máximo de parcelas</Label>
                      <Select value={mpMaxParcelas} onValueChange={setMpMaxParcelas}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">À vista</SelectItem>
                          <SelectItem value="3">Até 3x</SelectItem>
                          <SelectItem value="6">Até 6x</SelectItem>
                          <SelectItem value="12">Até 12x</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Taxas de parcelamento</Label>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={mpAbsorverTaxa}
                          onCheckedChange={setMpAbsorverTaxa}
                        />
                        <span className="text-sm text-muted-foreground">
                          {mpAbsorverTaxa ? 'Eu absorvo a taxa' : 'Cliente paga juros'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="flex gap-2">
                <Button
                  onClick={handleSaveMpSettings}
                  disabled={updateMercadoPagoSettings.isPending}
                >
                  {updateMercadoPagoSettings.isPending ? 'Salvando...' : 'Salvar Configurações'}
                </Button>
                <Button variant="ghost" onClick={() => setShowMpSettings(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : mpIntegration && mpIntegration.status === 'ativo' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-muted/50 flex items-center justify-center p-1.5">
                    <img src={mercadopagoLogo} alt="Mercado Pago" className="h-full w-full object-contain" />
                  </div>
                  <div>
                    <p className="font-medium">Conta Conectada</p>
                    <p className="text-sm text-muted-foreground">
                      {mpIntegration.conectadoEm && `Conectado em ${format(new Date(mpIntegration.conectadoEm), "dd/MM/yyyy", { locale: ptBR })}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShowMpSettings(true)}>
                    <Edit2 className="h-4 w-4 mr-2" />
                    Configurar
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => deactivate.mutate('mercadopago')}
                    disabled={deactivate.isPending}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Power className="h-4 w-4 mr-2" />
                    Desconectar
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {(mpIntegration.dadosExtras as MercadoPagoData)?.habilitarPix && (
                  <Badge variant="secondary">PIX</Badge>
                )}
                {(mpIntegration.dadosExtras as MercadoPagoData)?.habilitarCartao && (
                  <Badge variant="secondary">
                    Cartão até {(mpIntegration.dadosExtras as MercadoPagoData)?.maxParcelas || 12}x
                  </Badge>
                )}
              </div>
            </div>
          ) : mpIntegration && mpIntegration.status === 'erro_autenticacao' ? (
            <div className="space-y-4">
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800">
                <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-red-700 dark:text-red-300">
                    Reconexão necessária
                  </p>
                  <p className="text-red-600 dark:text-red-400 mt-1">
                    Sua autorização expirou. Por favor, reconecte sua conta.
                  </p>
                </div>
              </div>
              <Button onClick={handleConnectMercadoPago} disabled={!mpAppId}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Reconectar Mercado Pago
              </Button>
            </div>
          ) : (
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
                      O dinheiro vai diretamente para sua conta.
                    </p>
                  </div>
                </div>
              </div>

              {!mpAppId ? (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-800">
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    Integração Mercado Pago não está disponível no momento.
                  </p>
                </div>
              ) : (
                <Button onClick={handleConnectMercadoPago}>
                  <Link2 className="h-4 w-4 mr-2" />
                  Conectar Mercado Pago
                </Button>
              )}
            </div>
          )}
      </div>

      {/* Add PIX Manual */}
      <div className="lunari-card p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <QrCode className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-medium">PIX Manual</h2>
            <p className="text-sm text-muted-foreground">
              Receba pagamentos via PIX com confirmação manual
            </p>
          </div>
        </div>

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
                  "w-10 h-10 rounded-lg flex items-center justify-center p-1.5",
                  pixIntegration.status === 'ativo' ? "bg-muted/50" : "bg-muted"
                )}>
                  <img 
                    src={pixLogo} 
                    alt="PIX" 
                    className={cn(
                      "h-full w-full object-contain",
                      pixIntegration.status !== 'ativo' && "opacity-50"
                    )} 
                  />
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
      </div>

      {/* Add InfinitePay */}
      <div className="lunari-card p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Zap className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-medium">InfinitePay</h2>
            <p className="text-sm text-muted-foreground">
              Receba pagamentos com confirmação automática via checkout
            </p>
          </div>
        </div>

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
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center p-1.5",
                    ipIntegration.status === 'ativo' ? "bg-muted/50" : "bg-muted"
                  )}>
                    <img 
                      src={infinitepayLogo} 
                      alt="InfinitePay" 
                      className={cn(
                        "h-full w-full object-contain",
                        ipIntegration.status !== 'ativo' && "opacity-50"
                      )} 
                    />
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

              {ipIntegration.status === 'ativo' && (
                <div className="space-y-3">
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-800">
                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      Quando as taxas da InfinitePay estiverem configuradas para serem absorvidas pelo fotógrafo, 
                      o sistema exibirá apenas o valor cobrado do cliente. 
                      O valor líquido recebido deve ser consultado diretamente na InfinitePay.
                    </p>
                  </div>
                  <Button variant="outline" size="sm">
                    <HelpCircle className="h-4 w-4 mr-2" />
                    Como configurar
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <Button variant="outline" onClick={() => setShowIpForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Configurar InfinitePay
            </Button>
          )}
      </div>

      {/* Asaas */}
      <div className="lunari-card p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center p-1">
            <img src={asaasLogo} alt="Asaas" className="h-full w-full object-contain" />
          </div>
          <div>
            <h2 className="font-medium">Asaas</h2>
            <p className="text-sm text-muted-foreground">
              Receba via PIX, Cartão e Boleto com checkout transparente
            </p>
          </div>
        </div>

        {showAsaasForm || showAsaasSettings ? (
          <div className="space-y-6">
            {/* API Key */}
            {showAsaasForm && (
              <div className="space-y-2">
                <Label htmlFor="asaas-key">API Key</Label>
                <div className="relative">
                  <Input
                    id="asaas-key"
                    type={asaasShowKey ? 'text' : 'password'}
                    value={asaasApiKey}
                    onChange={(e) => setAsaasApiKey(e.target.value)}
                    placeholder="$aact_..."
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setAsaasShowKey(!asaasShowKey)}
                  >
                    {asaasShowKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Encontre sua API Key em Asaas {'>'} Integrações {'>'} API
                </p>
              </div>
            )}

            {/* Environment */}
            <div className="space-y-2">
              <Label>Ambiente</Label>
              <div className="flex items-center gap-3">
                <Switch
                  checked={asaasEnvironment === 'production'}
                  onCheckedChange={(checked) => setAsaasEnvironment(checked ? 'production' : 'sandbox')}
                />
                <span className="text-sm">
                  {asaasEnvironment === 'production' ? (
                    <span className="text-green-600 dark:text-green-400 font-medium">Produção</span>
                  ) : (
                    <span className="text-amber-600 dark:text-amber-400 font-medium">Sandbox (testes)</span>
                  )}
                </span>
              </div>
            </div>

            {/* Payment Methods */}
            <div className="space-y-4">
              <h4 className="font-medium">Métodos de Pagamento</h4>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>PIX</Label>
                  <p className="text-sm text-muted-foreground">Pagamento instantâneo</p>
                </div>
                <Switch checked={asaasHabilitarPix} onCheckedChange={setAsaasHabilitarPix} />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Cartão de Crédito</Label>
                  <p className="text-sm text-muted-foreground">Parcelamento disponível</p>
                </div>
                <Switch checked={asaasHabilitarCartao} onCheckedChange={setAsaasHabilitarCartao} />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Boleto</Label>
                  <p className="text-sm text-muted-foreground">Vencimento em 3 dias úteis</p>
                </div>
                <Switch checked={asaasHabilitarBoleto} onCheckedChange={setAsaasHabilitarBoleto} />
              </div>
            </div>

            {/* Installments */}
            {asaasHabilitarCartao && (
              <div className="space-y-4 pt-2 border-t">
                <h4 className="font-medium">Parcelamento</h4>
                
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Máximo de parcelas</Label>
                    <Select value={asaasMaxParcelas} onValueChange={setAsaasMaxParcelas}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">À vista</SelectItem>
                        <SelectItem value="2">Até 2x</SelectItem>
                        <SelectItem value="3">Até 3x</SelectItem>
                        <SelectItem value="6">Até 6x</SelectItem>
                        <SelectItem value="10">Até 10x</SelectItem>
                        <SelectItem value="12">Até 12x</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Taxas de parcelamento</Label>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={asaasAbsorverTaxa}
                        onCheckedChange={setAsaasAbsorverTaxa}
                      />
                      <span className="text-sm text-muted-foreground">
                        {asaasAbsorverTaxa ? 'Eu absorvo a taxa' : 'Cliente paga juros'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Fee info - fetched from Asaas API in real-time */}
                {!asaasAbsorverTaxa && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Taxas do Asaas</Label>
                        <p className="text-sm text-muted-foreground">
                          As taxas são buscadas automaticamente da sua conta Asaas no momento do checkout
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={asaasFeesLoading}
                        onClick={async () => {
                          setAsaasFeesLoading(true);
                          try {
                            const userId = user?.id;
                            if (!userId) return;
                            const res = await fetch(`https://tlnjspsywycbudhewsfv.supabase.co/functions/v1/asaas-fetch-fees`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ userId }),
                            });
                            const result = await res.json();
                            if (result.success && result.accountFees) {
                              setAsaasFees(result.accountFees);
                            } else {
                              toast.error(result.error || 'Erro ao buscar taxas');
                            }
                          } catch {
                            toast.error('Erro ao buscar taxas');
                          } finally {
                            setAsaasFeesLoading(false);
                          }
                        }}
                      >
                        {asaasFeesLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                        Ver taxas
                      </Button>
                    </div>

                    {asaasFees && (
                      <div className="rounded-lg border border-border p-4 bg-muted/30 space-y-3">
                        <h5 className="text-sm font-medium">Taxas de Cartão de Crédito</h5>
                        <div className="grid gap-1">
                          {asaasFees.creditCard.tiers.map((tier, idx) => (
                            <div key={idx} className="flex justify-between text-sm text-muted-foreground">
                              <span>{tier.min === tier.max ? `${tier.min}x` : `${tier.min}x - ${tier.max}x`}</span>
                              <span className="font-medium">{tier.percentageFee}% + R$ {asaasFees.creditCard.operationValue.toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                        <div className="pt-2 border-t border-border grid gap-1">
                          <div className="flex justify-between text-sm text-muted-foreground">
                            <span>Antecipação à vista</span>
                            <span className="font-medium">{asaasFees.creditCard.detachedMonthlyFeeValue}%/mês</span>
                          </div>
                          <div className="flex justify-between text-sm text-muted-foreground">
                            <span>Antecipação parcelado</span>
                            <span className="font-medium">{asaasFees.creditCard.installmentMonthlyFeeValue}%/mês</span>
                          </div>
                        </div>
                        {asaasFees.pix && (
                          <div className="pt-2 border-t border-border">
                            <div className="flex justify-between text-sm text-muted-foreground">
                              <span>PIX (taxa fixa)</span>
                              <span className="font-medium">R$ {asaasFees.pix.fixedFeeValue.toFixed(2)}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            
            <div className="flex gap-2">
              <Button
                onClick={showAsaasForm ? handleSaveAsaas : handleSaveAsaasSettings}
                disabled={showAsaasForm ? (!asaasApiKey.trim() || saveAsaas.isPending) : updateAsaasSettings.isPending}
              >
                {(saveAsaas.isPending || updateAsaasSettings.isPending) ? 'Salvando...' : 'Salvar Configurações'}
              </Button>
              <Button variant="ghost" onClick={() => { setShowAsaasForm(false); setShowAsaasSettings(false); }}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : asaasIntegration && asaasIntegration.status === 'ativo' ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted/50 flex items-center justify-center p-1.5">
                  <img src={asaasLogo} alt="Asaas" className="h-full w-full object-contain" />
                </div>
                <div>
                  <p className="font-medium">Conta Conectada</p>
                  <p className="text-sm text-muted-foreground">
                    {(asaasIntegration.dadosExtras as AsaasData)?.environment === 'production' ? 'Produção' : 'Sandbox'}
                    {asaasIntegration.conectadoEm && ` • ${format(new Date(asaasIntegration.conectadoEm), "dd/MM/yyyy", { locale: ptBR })}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowAsaasSettings(true)}>
                  <Edit2 className="h-4 w-4 mr-2" />
                  Configurar
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => deactivate.mutate('asaas')}
                  disabled={deactivate.isPending}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Power className="h-4 w-4 mr-2" />
                  Desconectar
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {(asaasIntegration.dadosExtras as AsaasData)?.habilitarPix && (
                <Badge variant="secondary">PIX</Badge>
              )}
              {(asaasIntegration.dadosExtras as AsaasData)?.habilitarCartao && (
                <Badge variant="secondary">
                  Cartão até {(asaasIntegration.dadosExtras as AsaasData)?.maxParcelas || 12}x
                </Badge>
              )}
              {(asaasIntegration.dadosExtras as AsaasData)?.habilitarBoleto && (
                <Badge variant="secondary">Boleto</Badge>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-green-700 dark:text-green-300">
                    Checkout transparente
                  </p>
                  <p className="text-green-600 dark:text-green-400 mt-1">
                    PIX, Cartão e Boleto com confirmação automática. O dinheiro vai direto para sua conta Asaas.
                  </p>
                </div>
              </div>
            </div>
            <Button variant="outline" onClick={() => setShowAsaasForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Configurar Asaas
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Sub-component: Anticipation rate configuration with inline simulator */
function AnticipationConfig({
  taxaAvista,
  setTaxaAvista,
  taxaParcelado,
  setTaxaParcelado,
  maxParcelas,
}: {
  taxaAvista: string;
  setTaxaAvista: (v: string) => void;
  taxaParcelado: string;
  setTaxaParcelado: (v: string) => void;
  maxParcelas: number;
}) {
  const simulacao = useMemo(() => {
    const valor = 1000;
    const parcelas = Math.min(maxParcelas, 3);
    const taxa = parseFloat(taxaParcelado) || 0;
    if (taxa <= 0 || parcelas <= 0) return null;
    return calcularAntecipacao(valor, parcelas, taxa);
  }, [taxaParcelado, maxParcelas]);

  const simulacaoAvista = useMemo(() => {
    const valor = 1000;
    const taxa = parseFloat(taxaAvista) || 0;
    if (taxa <= 0) return null;
    return calcularAntecipacao(valor, 1, taxa);
  }, [taxaAvista]);

  return (
    <div className="space-y-4 rounded-lg border border-border p-4 bg-muted/30">
      <p className="text-xs text-muted-foreground">
        A taxa é mensal e se acumula proporcionalmente ao número da parcela.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Taxa mensal — Crédito à vista (%)</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            max="10"
            value={taxaAvista}
            onChange={(e) => setTaxaAvista(e.target.value)}
            placeholder="Ex: 1.99"
          />
          {simulacaoAvista && (
            <p className="text-xs text-muted-foreground">
              R$ 1.000 à vista → líquido R$ {simulacaoAvista.valorLiquido.toFixed(2)}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Taxa mensal — Crédito parcelado (%)</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            max="10"
            value={taxaParcelado}
            onChange={(e) => setTaxaParcelado(e.target.value)}
            placeholder="Ex: 1.25"
          />
          {simulacao && (
            <p className="text-xs text-muted-foreground">
              R$ 1.000 em {Math.min(maxParcelas, 3)}x → líquido R$ {simulacao.valorLiquido.toFixed(2)}
            </p>
          )}
        </div>
      </div>

      {/* Detailed simulator */}
      {simulacao && simulacao.detalheParcelas.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-border">
          <p className="text-xs font-medium text-muted-foreground">
            Simulação: R$ 1.000 em {simulacao.detalheParcelas.length}x ({taxaParcelado}% a.m.)
          </p>
          <div className="grid gap-1">
            {simulacao.detalheParcelas.map((p) => (
              <div key={p.parcela} className="flex justify-between text-xs text-muted-foreground">
                <span>Parcela {p.parcela} ({p.meses} {p.meses === 1 ? 'mês' : 'meses'} — {p.taxa}%)</span>
                <span>R$ {p.liquido.toFixed(2)}</span>
              </div>
            ))}
            <div className="flex justify-between text-xs font-medium pt-1 border-t border-border">
              <span>Total líquido</span>
              <span>R$ {simulacao.valorLiquido.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs text-destructive">
              <span>Custo antecipação</span>
              <span>- R$ {simulacao.totalTaxa.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
