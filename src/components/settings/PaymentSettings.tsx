import { useState, useEffect, useRef } from 'react';
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
  const [asaasTaxaAntecipacao, setAsaasTaxaAntecipacao] = useState(false);
  const [asaasTaxaAntecipacaoPercentual, setAsaasTaxaAntecipacaoPercentual] = useState('0');

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
        setAsaasTaxaAntecipacao(asData.taxaAntecipacao ?? false);
        setAsaasTaxaAntecipacaoPercentual(String(asData.taxaAntecipacaoPercentual ?? 0));
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
        taxaAntecipacao: asaasTaxaAntecipacao,
        taxaAntecipacaoPercentual: parseFloat(asaasTaxaAntecipacaoPercentual) || 0,
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
      taxaAntecipacao: asaasTaxaAntecipacao,
      taxaAntecipacaoPercentual: parseFloat(asaasTaxaAntecipacaoPercentual) || 0,
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
    </div>
  );
}
