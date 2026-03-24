import { useState } from 'react';
import { Loader2, Eye, EyeOff, ExternalLink, RefreshCw, CheckCircle, AlertTriangle, Link2, ArrowDownToLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { pixLogo, infinitepayLogo, mercadopagoLogo, asaasLogo } from '@/assets/payment-logos';
import {
  PaymentProvider,
  PixManualData,
  InfinitePayData,
  MercadoPagoData,
  AsaasData,
  PixKeyType,
  getProviderLabel,
  getPixKeyTypeLabel,
} from '@/hooks/usePaymentIntegration';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { hasOtherContextSettings, getDivergenceSummary } from '@/utils/paymentSettingsContext';

const providerLogos: Record<PaymentProvider, string> = {
  pix_manual: pixLogo,
  infinitepay: infinitepayLogo,
  mercadopago: mercadopagoLogo,
  asaas: asaasLogo,
};

interface PaymentConfigDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: PaymentProvider | null;

  // PIX
  chavePix: string;
  setChavePix: (v: string) => void;
  tipoChave: PixKeyType;
  setTipoChave: (v: PixKeyType) => void;
  nomeTitular: string;
  setNomeTitular: (v: string) => void;
  handleSavePix: () => Promise<void>;
  savePixPending: boolean;

  // InfinitePay
  handle: string;
  setHandle: (v: string) => void;
  handleSaveInfinitePay: () => Promise<void>;
  saveIpPending: boolean;

  // Mercado Pago
  mpIntegrationStatus: string | null;
  mpConnectedAt: string | null;
  mpHabilitarPix: boolean;
  setMpHabilitarPix: (v: boolean) => void;
  mpHabilitarCartao: boolean;
  setMpHabilitarCartao: (v: boolean) => void;
  mpMaxParcelas: string;
  setMpMaxParcelas: (v: string) => void;
  mpAbsorverTaxa: boolean;
  setMpAbsorverTaxa: (v: boolean) => void;
  handleConnectMercadoPago: () => void;
  handleSaveMpSettings: () => Promise<void>;
  updateMpPending: boolean;
  mpAppId: string;

  // Asaas
  asaasIntegrationStatus: string | null;
  asaasApiKey: string;
  setAsaasApiKey: (v: string) => void;
  asaasEnvironment: 'sandbox' | 'production';
  setAsaasEnvironment: (v: 'sandbox' | 'production') => void;
  asaasHabilitarPix: boolean;
  setAsaasHabilitarPix: (v: boolean) => void;
  asaasHabilitarCartao: boolean;
  setAsaasHabilitarCartao: (v: boolean) => void;
  asaasHabilitarBoleto: boolean;
  setAsaasHabilitarBoleto: (v: boolean) => void;
  asaasMaxParcelas: string;
  setAsaasMaxParcelas: (v: string) => void;
  asaasAbsorverTaxa: boolean;
  setAsaasAbsorverTaxa: (v: boolean) => void;
  asaasIreiAntecipar: boolean;
  setAsaasIreiAntecipar: (v: boolean) => void;
  asaasRepassarAntecipacao: boolean;
  setAsaasRepassarAntecipacao: (v: boolean) => void;
  handleSaveAsaas: () => Promise<void>;
  handleSaveAsaasSettings: () => Promise<void>;
  saveAsaasPending: boolean;
  updateAsaasSettings: { mutateAsync: (s: Partial<AsaasData>) => Promise<void>; isPending: boolean };
  userId?: string;

  // Fees
  asaasFees: {
    creditCard: {
      operationValue: number;
      detachedMonthlyFeeValue: number;
      installmentMonthlyFeeValue: number;
      tiers: Array<{ min: number; max: number; percentageFee: number }>;
    };
    pix: { fixedFeeValue: number };
    discount?: {
      active: boolean;
      expiration?: string;
      tiers: Array<{ min: number; max: number; percentageFee: number }>;
    };
  } | null;
  setAsaasFees: (v: any) => void;

  // Migration
  asaasDadosExtrasRaw?: any;
  mpDadosExtrasRaw?: any;
  onMigrateFromGestao?: (provedor: 'asaas' | 'mercadopago') => Promise<void>;
  migratePending?: boolean;
}

export function PaymentConfigDrawer({
  open,
  onOpenChange,
  provider,
  // PIX
  chavePix, setChavePix, tipoChave, setTipoChave, nomeTitular, setNomeTitular, handleSavePix, savePixPending,
  // IP
  handle, setHandle, handleSaveInfinitePay, saveIpPending,
  // MP
  mpIntegrationStatus, mpConnectedAt, mpHabilitarPix, setMpHabilitarPix, mpHabilitarCartao, setMpHabilitarCartao,
  mpMaxParcelas, setMpMaxParcelas, mpAbsorverTaxa, setMpAbsorverTaxa,
  handleConnectMercadoPago, handleSaveMpSettings, updateMpPending, mpAppId,
  // Asaas
  asaasIntegrationStatus, asaasApiKey, setAsaasApiKey, asaasEnvironment, setAsaasEnvironment,
  asaasHabilitarPix, setAsaasHabilitarPix, asaasHabilitarCartao, setAsaasHabilitarCartao,
  asaasHabilitarBoleto, setAsaasHabilitarBoleto, asaasMaxParcelas, setAsaasMaxParcelas,
  asaasAbsorverTaxa, setAsaasAbsorverTaxa, asaasIreiAntecipar, setAsaasIreiAntecipar,
  asaasRepassarAntecipacao, setAsaasRepassarAntecipacao,
  handleSaveAsaas, handleSaveAsaasSettings, saveAsaasPending, updateAsaasSettings, userId,
  asaasFees, setAsaasFees,
  // Migration
  asaasDadosExtrasRaw, mpDadosExtrasRaw, onMigrateFromGestao, migratePending,
}: PaymentConfigDrawerProps) {
  const [asaasShowKey, setAsaasShowKey] = useState(false);
  const [asaasFeesLoading, setAsaasFeesLoading] = useState(false);

  if (!provider) return null;

  const isNewAsaas = provider === 'asaas' && asaasIntegrationStatus !== 'ativo';
  const isNewMp = provider === 'mercadopago' && mpIntegrationStatus !== 'ativo' && mpIntegrationStatus !== 'erro_autenticacao';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="pb-4">
          <div className="flex items-center gap-3">
            <img src={providerLogos[provider]} alt={getProviderLabel(provider)} className="h-7 w-7 object-contain" />
            <div>
              <SheetTitle>{getProviderLabel(provider)}</SheetTitle>
              <SheetDescription className="text-xs">
                {provider === 'pix_manual' && 'Confirmação manual de pagamento'}
                {provider === 'infinitepay' && 'Checkout automático'}
                {provider === 'mercadopago' && 'Checkout automático via OAuth'}
                {provider === 'asaas' && 'Checkout transparente'}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-6 pt-2">
          {/* ── PIX Manual ── */}
          {provider === 'pix_manual' && (
            <>
              <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0 text-amber-500" />
                Você precisará confirmar manualmente cada recebimento.
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Tipo de Chave</Label>
                  <Select value={tipoChave} onValueChange={(v) => setTipoChave(v as PixKeyType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
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
                  <Label>Chave PIX</Label>
                  <Input value={chavePix} onChange={(e) => setChavePix(e.target.value)} placeholder="Sua chave PIX" />
                </div>

                <div className="space-y-2">
                  <Label>Nome do Titular</Label>
                  <Input value={nomeTitular} onChange={(e) => setNomeTitular(e.target.value)} placeholder="Nome que aparecerá para o cliente" />
                </div>
              </div>

              <Button className="w-full" onClick={handleSavePix} disabled={!chavePix.trim() || !nomeTitular.trim() || savePixPending}>
                {savePixPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Salvando...</> : 'Salvar PIX'}
              </Button>
            </>
          )}

          {/* ── InfinitePay ── */}
          {provider === 'infinitepay' && (
            <>
              <div className="space-y-2">
                <Label>Handle InfinitePay</Label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-muted text-sm text-muted-foreground">@</span>
                  <Input value={handle} onChange={(e) => setHandle(e.target.value.replace('@', ''))} placeholder="seu-handle" className="rounded-l-none" />
                </div>
                <p className="text-xs text-muted-foreground">Identificador único do seu perfil InfinitePay</p>
              </div>

              <a href="https://infinitepay.io" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                Não tem conta? Criar conta <ExternalLink className="h-3 w-3" />
              </a>

              <Button className="w-full" onClick={handleSaveInfinitePay} disabled={!handle.trim() || saveIpPending}>
                {saveIpPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Salvando...</> : 'Salvar InfinitePay'}
              </Button>
            </>
          )}

          {/* ── Mercado Pago ── */}
          {provider === 'mercadopago' && (
            <>
              {mpIntegrationStatus === 'erro_autenticacao' && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Reconexão necessária</p>
                    <p className="text-muted-foreground mt-1">Sua autorização expirou.</p>
                  </div>
                </div>
              )}

              {mpIntegrationStatus === 'ativo' ? (
                <>
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Conta conectada{mpConnectedAt && ` em ${format(new Date(mpConnectedAt), "dd/MM/yyyy", { locale: ptBR })}`}</span>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-sm font-medium">Métodos de Pagamento</h4>
                    <div className="flex items-center justify-between">
                      <Label>PIX</Label>
                      <Switch checked={mpHabilitarPix} onCheckedChange={setMpHabilitarPix} />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Cartão de Crédito</Label>
                      <Switch checked={mpHabilitarCartao} onCheckedChange={setMpHabilitarCartao} />
                    </div>
                  </div>

                  {mpHabilitarCartao && (
                    <div className="space-y-4 pt-4 border-t border-border">
                      <h4 className="text-sm font-medium">Parcelamento</h4>
                      <div className="space-y-2">
                        <Label>Máximo de parcelas</Label>
                        <Select value={mpMaxParcelas} onValueChange={setMpMaxParcelas}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">À vista</SelectItem>
                            <SelectItem value="3">Até 3x</SelectItem>
                            <SelectItem value="6">Até 6x</SelectItem>
                            <SelectItem value="12">Até 12x</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch checked={mpAbsorverTaxa} onCheckedChange={setMpAbsorverTaxa} />
                        <span className="text-sm text-muted-foreground">{mpAbsorverTaxa ? 'Eu absorvo a taxa' : 'Cliente paga juros'}</span>
                      </div>
                    </div>
                  )}

                  <Button className="w-full" onClick={handleSaveMpSettings} disabled={updateMpPending}>
                    {updateMpPending ? 'Salvando...' : 'Salvar Configurações'}
                  </Button>
                </>
              ) : (
                <>
                  {!mpAppId ? (
                    <p className="text-sm text-muted-foreground">Integração Mercado Pago não disponível no momento.</p>
                  ) : (
                    <Button className="w-full" onClick={handleConnectMercadoPago}>
                      <Link2 className="h-4 w-4 mr-2" />
                      {mpIntegrationStatus === 'erro_autenticacao' ? 'Reconectar' : 'Conectar'} Mercado Pago
                    </Button>
                  )}
                </>
              )}
            </>
          )}

          {/* ── Asaas ── */}
          {provider === 'asaas' && (
            <>
              {isNewAsaas && (
                <div className="space-y-2">
                  <Label>API Key</Label>
                  <div className="relative">
                    <Input
                      type={asaasShowKey ? 'text' : 'password'}
                      value={asaasApiKey}
                      onChange={(e) => setAsaasApiKey(e.target.value)}
                      placeholder="$aact_..."
                      className="pr-10"
                    />
                    <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3" onClick={() => setAsaasShowKey(!asaasShowKey)}>
                      {asaasShowKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Encontre sua API Key em Asaas {'>'} Integrações {'>'} API</p>
                </div>
              )}

              <div className="space-y-2">
                <Label>Ambiente</Label>
                <div className="flex items-center gap-3">
                  <Switch checked={asaasEnvironment === 'production'} onCheckedChange={(c) => setAsaasEnvironment(c ? 'production' : 'sandbox')} />
                  <span className="text-sm font-medium">
                    {asaasEnvironment === 'production'
                      ? <span className="text-green-600 dark:text-green-400">Produção</span>
                      : <span className="text-amber-600 dark:text-amber-400">Sandbox</span>}
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-sm font-medium">Métodos de Pagamento</h4>
                <div className="flex items-center justify-between">
                  <Label>PIX</Label>
                  <Switch checked={asaasHabilitarPix} onCheckedChange={setAsaasHabilitarPix} />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Cartão de Crédito</Label>
                  <Switch checked={asaasHabilitarCartao} onCheckedChange={setAsaasHabilitarCartao} />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Boleto</Label>
                  <Switch checked={asaasHabilitarBoleto} onCheckedChange={setAsaasHabilitarBoleto} />
                </div>
              </div>

              {asaasHabilitarCartao && (
                <div className="space-y-4 pt-4 border-t border-border">
                  <h4 className="text-sm font-medium">Parcelamento</h4>
                  <div className="space-y-2">
                    <Label>Máximo de parcelas</Label>
                    <Select value={asaasMaxParcelas} onValueChange={setAsaasMaxParcelas}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
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

                  <div className="flex items-center gap-2">
                    <Switch
                      checked={asaasAbsorverTaxa}
                      onCheckedChange={async (checked) => {
                        setAsaasAbsorverTaxa(checked);
                        if (asaasIntegrationStatus === 'ativo') {
                          try {
                            await updateAsaasSettings.mutateAsync({
                              environment: asaasEnvironment,
                              habilitarPix: asaasHabilitarPix,
                              habilitarCartao: asaasHabilitarCartao,
                              habilitarBoleto: asaasHabilitarBoleto,
                              maxParcelas: parseInt(asaasMaxParcelas),
                              absorverTaxa: checked,
                              ireiAntecipar: asaasIreiAntecipar,
                              repassarTaxaAntecipacao: checked ? false : asaasRepassarAntecipacao,
                              incluirTaxaAntecipacao: checked ? false : (asaasIreiAntecipar && asaasRepassarAntecipacao),
                            });
                            if (checked) setAsaasRepassarAntecipacao(false);
                          } catch { setAsaasAbsorverTaxa(!checked); }
                        }
                      }}
                      disabled={updateAsaasSettings.isPending}
                    />
                    <span className="text-sm text-muted-foreground">{asaasAbsorverTaxa ? 'Eu absorvo a taxa' : 'Cliente paga juros'}</span>
                    {updateAsaasSettings.isPending && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                  </div>

                  {/* Antecipação */}
                  <div className="p-3 rounded-lg border border-border bg-muted/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Vou antecipar meus recebíveis</Label>
                        <p className="text-xs text-muted-foreground">Ative se pretende antecipar no Asaas</p>
                      </div>
                      <Switch
                        checked={asaasIreiAntecipar}
                        onCheckedChange={async (checked) => {
                          setAsaasIreiAntecipar(checked);
                          if (!checked) setAsaasRepassarAntecipacao(false);
                          if (asaasIntegrationStatus === 'ativo') {
                            try {
                              await updateAsaasSettings.mutateAsync({
                                ireiAntecipar: checked,
                                repassarTaxaAntecipacao: checked ? asaasRepassarAntecipacao : false,
                                incluirTaxaAntecipacao: checked ? asaasRepassarAntecipacao : false,
                              });
                            } catch { setAsaasIreiAntecipar(!checked); }
                          }
                        }}
                        disabled={updateAsaasSettings.isPending}
                      />
                    </div>

                    {asaasIreiAntecipar && !asaasAbsorverTaxa && (
                      <div className="flex items-center justify-between pt-2 border-t border-border/50">
                        <div className="space-y-0.5">
                          <Label>Repassar taxa de antecipação</Label>
                          <p className="text-xs text-muted-foreground">O cliente pagará a taxa junto</p>
                        </div>
                        <Switch
                          checked={asaasRepassarAntecipacao}
                          onCheckedChange={async (checked) => {
                            setAsaasRepassarAntecipacao(checked);
                            if (asaasIntegrationStatus === 'ativo') {
                              try {
                                await updateAsaasSettings.mutateAsync({
                                  ireiAntecipar: asaasIreiAntecipar,
                                  repassarTaxaAntecipacao: checked,
                                  incluirTaxaAntecipacao: checked,
                                });
                              } catch { setAsaasRepassarAntecipacao(!checked); }
                            }
                          }}
                          disabled={updateAsaasSettings.isPending}
                        />
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground">
                      {!asaasIreiAntecipar ? 'Sem antecipação configurada'
                        : asaasAbsorverTaxa ? 'Você absorverá o custo da antecipação'
                        : asaasRepassarAntecipacao ? 'Cliente pagará processamento + antecipação'
                        : 'Você absorverá o custo da antecipação'}
                    </p>
                  </div>

                  {/* Fees */}
                  {!asaasAbsorverTaxa && asaasIntegrationStatus === 'ativo' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Taxas do Asaas</Label>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={asaasFeesLoading}
                          onClick={async () => {
                            setAsaasFeesLoading(true);
                            try {
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
                            } catch { toast.error('Erro ao buscar taxas'); } finally { setAsaasFeesLoading(false); }
                          }}
                        >
                          {asaasFeesLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                          Ver taxas
                        </Button>
                      </div>

                      {asaasFees && (
                        <div className="rounded-lg border border-border p-3 bg-muted/30 space-y-2 text-sm">
                          {asaasFees.discount?.active && (
                            <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400 text-xs font-medium">
                              <CheckCircle className="h-3 w-3" />
                              Desconto promocional ativo
                              {asaasFees.discount.expiration && ` até ${format(new Date(asaasFees.discount.expiration), "dd/MM/yyyy", { locale: ptBR })}`}
                            </div>
                          )}

                          <p className="text-xs font-medium text-muted-foreground">Cartão de Crédito</p>
                          {(asaasFees.discount?.active && asaasFees.discount.tiers.length > 0 ? asaasFees.discount.tiers : asaasFees.creditCard.tiers).map((tier, idx) => {
                            const standardTier = asaasFees.discount?.active ? asaasFees.creditCard.tiers[idx] : null;
                            return (
                              <div key={idx} className="flex justify-between text-xs text-muted-foreground">
                                <span>{tier.min === tier.max ? `${tier.min}x` : `${tier.min}x - ${tier.max}x`}</span>
                                <span>
                                  {asaasFees.discount?.active && <span className="text-green-600 dark:text-green-400">{tier.percentageFee}%</span>}
                                  {!asaasFees.discount?.active && <span>{tier.percentageFee}%</span>}
                                  {standardTier && standardTier.percentageFee !== tier.percentageFee && (
                                    <span className="line-through opacity-50 ml-1">{standardTier.percentageFee}%</span>
                                  )}
                                  {' '}+ R$ {asaasFees.creditCard.operationValue.toFixed(2)}
                                </span>
                              </div>
                            );
                          })}

                          <div className="pt-1 border-t border-border space-y-0.5">
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>Antecipação à vista</span>
                              <span>{asaasFees.creditCard.detachedMonthlyFeeValue}%/mês</span>
                            </div>
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>Antecipação parcelado</span>
                              <span>{asaasFees.creditCard.installmentMonthlyFeeValue}%/mês</span>
                            </div>
                          </div>

                          {asaasFees.pix && (
                            <div className="pt-1 border-t border-border">
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>PIX (taxa fixa)</span>
                                <span>R$ {asaasFees.pix.fixedFeeValue.toFixed(2)}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <Button
                className="w-full"
                onClick={isNewAsaas ? handleSaveAsaas : handleSaveAsaasSettings}
                disabled={isNewAsaas ? (!asaasApiKey.trim() || saveAsaasPending) : updateAsaasSettings.isPending}
              >
                {(saveAsaasPending || updateAsaasSettings.isPending) ? 'Salvando...' : 'Salvar Configurações'}
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
