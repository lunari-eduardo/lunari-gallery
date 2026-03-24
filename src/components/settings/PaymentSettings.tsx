import { useState, useEffect, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Loader2, Star, Settings, Power, Plus, MoreVertical, CheckCircle, AlertTriangle, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { pixLogo, infinitepayLogo, mercadopagoLogo, asaasLogo } from '@/assets/payment-logos';
import { useAuthContext } from '@/contexts/AuthContext';
import { PaymentConfigDrawer } from './PaymentConfigDrawer';

const providerLogos: Record<PaymentProvider, string> = {
  pix_manual: pixLogo,
  infinitepay: infinitepayLogo,
  mercadopago: mercadopagoLogo,
  asaas: asaasLogo,
};

const providerDescriptions: Record<PaymentProvider, string> = {
  pix_manual: 'Confirmação manual',
  infinitepay: 'Checkout automático',
  mercadopago: 'Checkout automático',
  asaas: 'Checkout transparente',
};

const allProviders: PaymentProvider[] = ['asaas', 'mercadopago', 'infinitepay', 'pix_manual'];

function getIntegrationSummary(provider: PaymentProvider, dadosExtras: any): string {
  if (provider === 'pix_manual') {
    const d = dadosExtras as PixManualData;
    return d?.tipoChave ? `${getPixKeyTypeLabel(d.tipoChave)}` : 'Manual';
  }
  if (provider === 'infinitepay') {
    const d = dadosExtras as InfinitePayData;
    return d?.handle ? `@${d.handle}` : '';
  }
  if (provider === 'mercadopago') {
    const d = dadosExtras as MercadoPagoData;
    const parts: string[] = [];
    if (d?.habilitarPix) parts.push('PIX');
    if (d?.habilitarCartao) parts.push(`Cartão ${d?.maxParcelas || 12}x`);
    return parts.join(' • ') || 'Configurado';
  }
  if (provider === 'asaas') {
    const d = dadosExtras as AsaasData;
    const parts: string[] = [];
    if (d?.habilitarPix) parts.push('PIX');
    if (d?.habilitarCartao) parts.push(`Cartão ${d?.maxParcelas || 12}x`);
    if (d?.habilitarBoleto) parts.push('Boleto');
    return parts.join(' • ') || 'Configurado';
  }
  return '';
}

export function PaymentSettings() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuthContext();

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

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerProvider, setDrawerProvider] = useState<PaymentProvider | null>(null);

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
  const [asaasEnvironment, setAsaasEnvironment] = useState<'sandbox' | 'production'>('sandbox');
  const [asaasHabilitarPix, setAsaasHabilitarPix] = useState(true);
  const [asaasHabilitarCartao, setAsaasHabilitarCartao] = useState(true);
  const [asaasHabilitarBoleto, setAsaasHabilitarBoleto] = useState(false);
  const [asaasMaxParcelas, setAsaasMaxParcelas] = useState('12');
  const [asaasAbsorverTaxa, setAsaasAbsorverTaxa] = useState(false);
  const [asaasIreiAntecipar, setAsaasIreiAntecipar] = useState(false);
  const [asaasRepassarAntecipacao, setAsaasRepassarAntecipacao] = useState(false);

  const [asaasFees, setAsaasFees] = useState<any>(null);

  // OAuth callback
  const hasProcessedCallback = useRef(false);
  const connectMercadoPagoRef = useRef(connectMercadoPago);
  const navigateRef = useRef(navigate);

  useEffect(() => {
    connectMercadoPagoRef.current = connectMercadoPago;
    navigateRef.current = navigate;
  });

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const isCallback = params.get('mp_callback');
    const code = params.get('code');
    if (!isCallback || !code || hasProcessedCallback.current) return;
    hasProcessedCallback.current = true;
    const redirectUri = 'https://gallery.lunarihub.com/settings?mp_callback=true';
    connectMercadoPagoRef.current.mutate(
      { code, redirect_uri: redirectUri },
      { onSettled: () => navigateRef.current('/settings?tab=payment', { replace: true }) }
    );
  }, [location.search]);

  // Sync form state from data
  useEffect(() => {
    if (!data?.allIntegrations) return;

    const pix = data.allIntegrations.find(i => i.provedor === 'pix_manual');
    if (pix?.dadosExtras) {
      const d = pix.dadosExtras as PixManualData;
      setChavePix(d.chavePix || '');
      setTipoChave(d.tipoChave || 'telefone');
      setNomeTitular(d.nomeTitular || '');
    }

    const ip = data.allIntegrations.find(i => i.provedor === 'infinitepay');
    if (ip?.dadosExtras) {
      setHandle((ip.dadosExtras as InfinitePayData).handle || '');
    }

    const mp = data.allIntegrations.find(i => i.provedor === 'mercadopago');
    if (mp?.dadosExtras) {
      const d = mp.dadosExtras as MercadoPagoData;
      setMpHabilitarPix(d.habilitarPix ?? true);
      setMpHabilitarCartao(d.habilitarCartao ?? true);
      setMpMaxParcelas(String(d.maxParcelas ?? 12));
      setMpAbsorverTaxa(d.absorverTaxa ?? false);
    }

    const asaas = data.allIntegrations.find(i => i.provedor === 'asaas');
    if (asaas?.dadosExtras) {
      const d = asaas.dadosExtras as AsaasData;
      setAsaasEnvironment(d.environment || 'sandbox');
      setAsaasHabilitarPix(d.habilitarPix ?? true);
      setAsaasHabilitarCartao(d.habilitarCartao ?? true);
      setAsaasHabilitarBoleto(d.habilitarBoleto ?? false);
      setAsaasMaxParcelas(String(d.maxParcelas ?? 12));
      setAsaasAbsorverTaxa(d.absorverTaxa ?? false);
      setAsaasIreiAntecipar(d.ireiAntecipar ?? d.incluirTaxaAntecipacao ?? false);
      setAsaasRepassarAntecipacao(d.repassarTaxaAntecipacao ?? d.incluirTaxaAntecipacao ?? false);
    }
  }, [data?.allIntegrations]);

  // Handlers
  const openDrawer = (provider: PaymentProvider) => {
    setDrawerProvider(provider);
    setDrawerOpen(true);
  };

  const handleSavePix = async () => {
    if (!chavePix.trim() || !nomeTitular.trim()) return;
    await savePixManual.mutateAsync({
      chavePix: chavePix.trim(), tipoChave, nomeTitular: nomeTitular.trim(),
      setAsDefault: !data?.hasPayment,
    });
    setDrawerOpen(false);
  };

  const handleSaveInfinitePay = async () => {
    if (!handle.trim()) return;
    await saveInfinitePay.mutateAsync({
      handle: handle.trim().replace('@', ''),
      setAsDefault: !data?.hasPayment,
    });
    setDrawerOpen(false);
  };

  const handleConnectMercadoPago = () => {
    const url = getMercadoPagoOAuthUrl();
    if (url) window.location.href = url;
  };

  const handleSaveMpSettings = async () => {
    await updateMercadoPagoSettings.mutateAsync({
      habilitarPix: mpHabilitarPix, habilitarCartao: mpHabilitarCartao,
      maxParcelas: parseInt(mpMaxParcelas), absorverTaxa: mpAbsorverTaxa,
    });
    setDrawerOpen(false);
  };

  const handleSaveAsaas = async () => {
    if (!asaasApiKey.trim()) return;
    await saveAsaas.mutateAsync({
      apiKey: asaasApiKey.trim(),
      settings: {
        environment: asaasEnvironment, habilitarPix: asaasHabilitarPix,
        habilitarCartao: asaasHabilitarCartao, habilitarBoleto: asaasHabilitarBoleto,
        maxParcelas: parseInt(asaasMaxParcelas), absorverTaxa: asaasAbsorverTaxa,
        ireiAntecipar: asaasIreiAntecipar, repassarTaxaAntecipacao: asaasRepassarAntecipacao,
        incluirTaxaAntecipacao: asaasIreiAntecipar && asaasRepassarAntecipacao,
      },
      setAsDefault: !data?.hasPayment,
    });
    setDrawerOpen(false);
  };

  const handleSaveAsaasSettings = async () => {
    await updateAsaasSettings.mutateAsync({
      environment: asaasEnvironment, habilitarPix: asaasHabilitarPix,
      habilitarCartao: asaasHabilitarCartao, habilitarBoleto: asaasHabilitarBoleto,
      maxParcelas: parseInt(asaasMaxParcelas), absorverTaxa: asaasAbsorverTaxa,
      ireiAntecipar: asaasIreiAntecipar, repassarTaxaAntecipacao: asaasRepassarAntecipacao,
      incluirTaxaAntecipacao: asaasIreiAntecipar && asaasRepassarAntecipacao,
    });
    setDrawerOpen(false);
  };

  // Derived data
  const activeIntegrations = data?.allActiveIntegrations || [];
  const activeProviders = new Set(activeIntegrations.map(i => i.provedor));
  const inactiveProviders = allProviders.filter(p => !activeProviders.has(p));

  const mpIntegration = data?.allIntegrations?.find(i => i.provedor === 'mercadopago');
  const asaasIntegration = data?.allIntegrations?.find(i => i.provedor === 'asaas');

  // Also show providers with erro_autenticacao in "other" section
  const errorProviders = (data?.allIntegrations || []).filter(i => i.status === 'erro_autenticacao').map(i => i.provedor);
  const otherProviders = [...new Set([...inactiveProviders, ...errorProviders])];

  if (isLoading || connectMercadoPago.isPending) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        {connectMercadoPago.isPending && <p className="text-sm text-muted-foreground">Conectando Mercado Pago...</p>}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ── Recebimento ativo ── */}
      {activeIntegrations.length > 0 && (
        <section>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Recebimento ativo</h3>
          <div className="divide-y divide-border rounded-lg border border-border">
            {activeIntegrations.map((integration) => {
              const summary = getIntegrationSummary(integration.provedor, integration.dadosExtras);
              return (
                <div key={integration.id} className="flex items-center gap-3 px-4 py-3">
                  {/* Status dot */}
                  <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />

                  {/* Logo */}
                  <img
                    src={providerLogos[integration.provedor]}
                    alt={getProviderLabel(integration.provedor)}
                    className="h-6 w-6 object-contain flex-shrink-0"
                  />

                  {/* Name + badge */}
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium text-sm truncate">{getProviderLabel(integration.provedor)}</span>
                    {integration.isDefault && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 gap-0.5 flex-shrink-0">
                        <Star className="h-2.5 w-2.5" />
                        Padrão
                      </Badge>
                    )}
                  </div>

                  {/* Summary */}
                  <span className="text-xs text-muted-foreground ml-auto mr-2 hidden sm:block truncate max-w-[180px]">
                    {summary}
                  </span>

                  {/* Actions */}
                  <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={() => openDrawer(integration.provedor)}>
                    <Settings className="h-4 w-4" />
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {!integration.isDefault && (
                        <DropdownMenuItem onClick={() => setAsDefault.mutate(integration.id)} disabled={setAsDefault.isPending}>
                          <Star className="h-4 w-4 mr-2" />
                          Definir como padrão
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={() => deactivate.mutate(integration.provedor)}
                        disabled={deactivate.isPending}
                        className="text-destructive focus:text-destructive"
                      >
                        <Power className="h-4 w-4 mr-2" />
                        Desativar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}
          </div>

          {/* PIX manual warning - inline and subtle */}
          {activeIntegrations.some(i => i.provedor === 'pix_manual') && (
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
              <AlertTriangle className="h-3 w-3 text-amber-500" />
              PIX Manual requer confirmação manual de cada pagamento.
            </p>
          )}
        </section>
      )}

      {/* ── Outras formas de pagamento ── */}
      {otherProviders.length > 0 && (
        <section>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Outras formas de pagamento</h3>
          <div className="divide-y divide-border rounded-lg border border-border">
            {otherProviders.map((provider) => {
              const hasError = errorProviders.includes(provider);
              return (
                <div key={provider} className="flex items-center gap-3 px-4 py-3">
                  {/* Status */}
                  {hasError
                    ? <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                    : <Circle className="h-4 w-4 text-muted-foreground/40 flex-shrink-0" />
                  }

                  {/* Logo */}
                  <img
                    src={providerLogos[provider]}
                    alt={getProviderLabel(provider)}
                    className="h-6 w-6 object-contain flex-shrink-0 opacity-60"
                  />

                  {/* Name */}
                  <div className="min-w-0">
                    <span className="text-sm font-medium truncate">{getProviderLabel(provider)}</span>
                    <p className="text-xs text-muted-foreground">
                      {hasError ? 'Reconexão necessária' : providerDescriptions[provider]}
                    </p>
                  </div>

                  {/* Add button */}
                  <Button variant="ghost" size="sm" className="ml-auto flex-shrink-0 gap-1.5" onClick={() => openDrawer(provider)}>
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline">{hasError ? 'Reconectar' : 'Adicionar'}</span>
                  </Button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Empty state */}
      {activeIntegrations.length === 0 && otherProviders.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhum método de pagamento disponível.</p>
      )}

      {/* ── Drawer ── */}
      <PaymentConfigDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        provider={drawerProvider}
        // PIX
        chavePix={chavePix} setChavePix={setChavePix}
        tipoChave={tipoChave} setTipoChave={setTipoChave}
        nomeTitular={nomeTitular} setNomeTitular={setNomeTitular}
        handleSavePix={handleSavePix} savePixPending={savePixManual.isPending}
        // IP
        handle={handle} setHandle={setHandle}
        handleSaveInfinitePay={handleSaveInfinitePay} saveIpPending={saveInfinitePay.isPending}
        // MP
        mpIntegrationStatus={mpIntegration?.status || null}
        mpConnectedAt={mpIntegration?.conectadoEm || null}
        mpHabilitarPix={mpHabilitarPix} setMpHabilitarPix={setMpHabilitarPix}
        mpHabilitarCartao={mpHabilitarCartao} setMpHabilitarCartao={setMpHabilitarCartao}
        mpMaxParcelas={mpMaxParcelas} setMpMaxParcelas={setMpMaxParcelas}
        mpAbsorverTaxa={mpAbsorverTaxa} setMpAbsorverTaxa={setMpAbsorverTaxa}
        handleConnectMercadoPago={handleConnectMercadoPago}
        handleSaveMpSettings={handleSaveMpSettings} updateMpPending={updateMercadoPagoSettings.isPending}
        mpAppId={mpAppId}
        // Asaas
        asaasIntegrationStatus={asaasIntegration?.status || null}
        asaasApiKey={asaasApiKey} setAsaasApiKey={setAsaasApiKey}
        asaasEnvironment={asaasEnvironment} setAsaasEnvironment={setAsaasEnvironment}
        asaasHabilitarPix={asaasHabilitarPix} setAsaasHabilitarPix={setAsaasHabilitarPix}
        asaasHabilitarCartao={asaasHabilitarCartao} setAsaasHabilitarCartao={setAsaasHabilitarCartao}
        asaasHabilitarBoleto={asaasHabilitarBoleto} setAsaasHabilitarBoleto={setAsaasHabilitarBoleto}
        asaasMaxParcelas={asaasMaxParcelas} setAsaasMaxParcelas={setAsaasMaxParcelas}
        asaasAbsorverTaxa={asaasAbsorverTaxa} setAsaasAbsorverTaxa={setAsaasAbsorverTaxa}
        asaasIreiAntecipar={asaasIreiAntecipar} setAsaasIreiAntecipar={setAsaasIreiAntecipar}
        asaasRepassarAntecipacao={asaasRepassarAntecipacao} setAsaasRepassarAntecipacao={setAsaasRepassarAntecipacao}
        handleSaveAsaas={handleSaveAsaas} handleSaveAsaasSettings={handleSaveAsaasSettings}
        saveAsaasPending={saveAsaas.isPending}
        updateAsaasSettings={updateAsaasSettings}
        userId={user?.id}
        asaasFees={asaasFees} setAsaasFees={setAsaasFees}
      />
    </div>
  );
}
