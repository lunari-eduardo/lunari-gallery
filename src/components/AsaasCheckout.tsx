import { useState, useEffect, useRef, useCallback } from 'react';
import { CreditCard, QrCode, Copy, CheckCircle, Loader2, Lock, ShieldCheck, AlertCircle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { calcularAntecipacao } from '@/lib/anticipationUtils';

const SUPABASE_URL = 'https://tlnjspsywycbudhewsfv.supabase.co';
const POLL_INTERVAL = 15_000;
const POLL_MAX = 10 * 60 * 1000;

export interface AccountFees {
  creditCard: {
    operationValue: number;
    detachedMonthlyFeeValue: number;
    installmentMonthlyFeeValue: number;
    tiers: Array<{ min: number; max: number; percentageFee: number }>;
  };
  pix: {
    fixedFeeValue: number;
  };
}

export interface AsaasCheckoutData {
  galeriaId: string;
  userId: string;
  valorTotal: number;
  descricao: string;
  qtdFotos: number;
  clienteId?: string;
  sessionId?: string;
  galleryToken?: string;
  enabledMethods: { pix: boolean; creditCard: boolean; boleto?: boolean };
  maxParcelas: number;
  absorverTaxa: boolean;
  // Legacy fields (kept for backward compat but ignored when accountFees is available)
  taxaAntecipacao?: boolean;
  taxaAntecipacaoPercentual?: number;
  taxaAntecipacaoCreditoAvista?: number;
  taxaAntecipacaoCreditoParcelado?: number;
}

interface AsaasCheckoutProps {
  data: AsaasCheckoutData;
  studioName?: string;
  studioLogoUrl?: string;
  onPaymentConfirmed: () => void;
  onCancel?: () => void;
  themeStyles?: React.CSSProperties;
  backgroundMode?: 'light' | 'dark';
}

// ——— Masks ———
function maskCpfCnpj(v: string): string {
  const d = v.replace(/\D/g, '');
  if (d.length <= 11) {
    return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }
  return d.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2');
}

function maskCardNumber(v: string): string {
  return v.replace(/\D/g, '').replace(/(\d{4})(?=\d)/g, '$1 ').trim().slice(0, 19);
}

function maskExpiry(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 4);
  if (d.length >= 3) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return d;
}

function maskPhone(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length > 6) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
  if (d.length > 2) return `(${d.slice(0,2)}) ${d.slice(2)}`;
  return d;
}

function maskCep(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 8);
  if (d.length > 5) return `${d.slice(0,5)}-${d.slice(5)}`;
  return d;
}

// ——— Validation ———
function validateCpf(cpf: string): boolean {
  const d = cpf.replace(/\D/g, '');
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(d[i]) * (10 - i);
  let rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  if (rest !== parseInt(d[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(d[i]) * (11 - i);
  rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  return rest === parseInt(d[10]);
}

function validateCnpj(cnpj: string): boolean {
  const d = cnpj.replace(/\D/g, '');
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const w1 = [5,4,3,2,9,8,7,6,5,4,3,2];
  const w2 = [6,5,4,3,2,9,8,7,6,5,4,3,2];
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(d[i]) * w1[i];
  let r = sum % 11;
  if (r < 2 ? 0 : 11 - r) { if ((r < 2 ? 0 : 11 - r) !== parseInt(d[12])) return false; }
  sum = 0;
  for (let i = 0; i < 13; i++) sum += parseInt(d[i]) * w2[i];
  r = sum % 11;
  return (r < 2 ? 0 : 11 - r) === parseInt(d[13]);
}

function validateCpfCnpj(val: string): boolean {
  const d = val.replace(/\D/g, '');
  if (d.length === 11) return validateCpf(val);
  if (d.length === 14) return validateCnpj(val);
  return false;
}

export function AsaasCheckout({
  data,
  studioName,
  studioLogoUrl,
  onPaymentConfirmed,
  onCancel,
  themeStyles = {},
  backgroundMode = 'light',
}: AsaasCheckoutProps) {
  const defaultTab = data.enabledMethods.pix ? 'pix' : 'card';

  // ——— PIX state ———
  const [pixLoading, setPixLoading] = useState(false);
  const [pixQrCode, setPixQrCode] = useState<string | null>(null);
  const [pixCopiaECola, setPixCopiaECola] = useState<string | null>(null);
  const [pixCobrancaId, setPixCobrancaId] = useState<string | null>(null);
  const [pixCopied, setPixCopied] = useState(false);
  const [pixConfirmed, setPixConfirmed] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartRef = useRef<number>(0);

  // ——— Card state ———
  const [cardLoading, setCardLoading] = useState(false);
  const [cardName, setCardName] = useState('');
  const [cardCpfCnpj, setCardCpfCnpj] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardPhone, setCardPhone] = useState('');
  const [cardCep, setCardCep] = useState('');
  const [cardInstallments, setCardInstallments] = useState('1');
  const [cardError, setCardError] = useState<string | null>(null);
  const [cardSuccess, setCardSuccess] = useState(false);

  // ——— Real-time fees from Asaas API ———
  const [accountFees, setAccountFees] = useState<AccountFees | null>(null);
  const [feesLoading, setFeesLoading] = useState(false);
  const [feesError, setFeesError] = useState(false);

  // Fetch fees from Asaas API on mount
  useEffect(() => {
    if (!data.userId || data.absorverTaxa) return; // No need to fetch fees if photographer absorbs
    
    let cancelled = false;
    setFeesLoading(true);
    setFeesError(false);
    
    fetch(`${SUPABASE_URL}/functions/v1/asaas-fetch-fees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: data.userId }),
    })
      .then(res => res.json())
      .then(result => {
        if (cancelled) return;
        if (result.success && result.accountFees) {
          setAccountFees(result.accountFees);
          console.log('📊 Asaas fees loaded:', result.accountFees);
        } else {
          console.warn('Failed to load Asaas fees:', result.error);
          setFeesError(true);
        }
      })
      .catch(err => {
        if (cancelled) return;
        console.error('Error fetching Asaas fees:', err);
        setFeesError(true);
      })
      .finally(() => {
        if (!cancelled) setFeesLoading(false);
      });
    
    return () => { cancelled = true; };
  }, [data.userId, data.absorverTaxa]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // ——— PIX Flow ———
  const generatePix = useCallback(async () => {
    setPixLoading(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/asaas-gallery-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: data.userId,
          clienteId: data.clienteId,
          sessionId: data.sessionId,
          valor: data.valorTotal,
          descricao: data.descricao,
          galeriaId: data.galeriaId,
          qtdFotos: data.qtdFotos,
          galleryToken: data.galleryToken,
          billingType: 'PIX',
        }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error || 'Erro ao gerar PIX');
      }
      setPixQrCode(result.pixQrCode ? `data:image/png;base64,${result.pixQrCode}` : null);
      setPixCopiaECola(result.pixCopiaECola || null);
      setPixCobrancaId(result.cobrancaId || null);

      // Start polling
      pollStartRef.current = Date.now();
      pollRef.current = setInterval(async () => {
        if (Date.now() - pollStartRef.current > POLL_MAX) {
          if (pollRef.current) clearInterval(pollRef.current);
          return;
        }
        try {
          const pollRes = await fetch(`${SUPABASE_URL}/functions/v1/check-payment-status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              cobrancaId: result.cobrancaId,
              sessionId: data.sessionId,
              forceUpdate: false,
            }),
          });
          const pollData = await pollRes.json();
          if (pollData.status === 'pago' || pollData.updated) {
            if (pollRef.current) clearInterval(pollRef.current);
            setPixConfirmed(true);
            toast.success('Pagamento confirmado!');
            setTimeout(() => onPaymentConfirmed(), 2000);
          }
        } catch { /* silently retry */ }
      }, POLL_INTERVAL);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao gerar PIX');
    } finally {
      setPixLoading(false);
    }
  }, [data, onPaymentConfirmed]);

  const handleCopyPix = async () => {
    if (!pixCopiaECola) return;
    try {
      await navigator.clipboard.writeText(pixCopiaECola);
      setPixCopied(true);
      toast.success('Código PIX copiado!');
      setTimeout(() => setPixCopied(false), 3000);
    } catch { toast.error('Erro ao copiar'); }
  };

  // ——— Card Flow: Calculate installments with combined fees ———
  const installmentOptions: Array<{ value: string; label: string; totalValue: number }> = [];
  for (let i = 1; i <= (data.maxParcelas || 12); i++) {
    let totalComTaxas = data.valorTotal;
    let label = `${i}x de R$ ${(data.valorTotal / i).toFixed(2)}`;

    if (!data.absorverTaxa && accountFees) {
      // 1. Processing fee (tier-based percentage + fixed operation value)
      const tier = accountFees.creditCard.tiers.find(t => i >= t.min && i <= t.max);
      const processingPercentage = tier?.percentageFee ?? 0;
      const processingFee = (data.valorTotal * processingPercentage / 100) + accountFees.creditCard.operationValue;

      // 2. Anticipation fee (monthly rate × installment number)
      const taxaMensal = i === 1
        ? accountFees.creditCard.detachedMonthlyFeeValue
        : accountFees.creditCard.installmentMonthlyFeeValue;
      const { totalTaxa: anticipationFee } = calcularAntecipacao(data.valorTotal, i, taxaMensal);

      totalComTaxas = data.valorTotal + processingFee + anticipationFee;
      totalComTaxas = Math.round(totalComTaxas * 100) / 100;

      label = `${i}x de R$ ${(totalComTaxas / i).toFixed(2)}`;
      if (totalComTaxas > data.valorTotal) label += ` (total R$ ${totalComTaxas.toFixed(2)})`;
    } else if (!data.absorverTaxa && !accountFees && !feesLoading) {
      // Fallback to legacy fields if fees failed to load
      const taxaMensal = i === 1
        ? (data.taxaAntecipacaoCreditoAvista ?? data.taxaAntecipacaoPercentual ?? 0)
        : (data.taxaAntecipacaoCreditoParcelado ?? data.taxaAntecipacaoPercentual ?? 0);
      if (taxaMensal > 0) {
        const { totalTaxa } = calcularAntecipacao(data.valorTotal, i, taxaMensal);
        totalComTaxas = data.valorTotal + totalTaxa;
        label = `${i}x de R$ ${(totalComTaxas / i).toFixed(2)}`;
        if (totalTaxa > 0) label += ` (total R$ ${totalComTaxas.toFixed(2)})`;
      }
    }

    installmentOptions.push({ value: String(i), label, totalValue: totalComTaxas });
  }

  // Get the total value for the selected installment (for the pay button and submission)
  const selectedInstallmentOption = installmentOptions.find(o => o.value === cardInstallments);
  const valorComTaxas = selectedInstallmentOption?.totalValue ?? data.valorTotal;

  const handleCardSubmit = async () => {
    setCardError(null);

    // Validate
    if (!cardName.trim()) { setCardError('Informe o nome no cartão'); return; }
    if (!validateCpfCnpj(cardCpfCnpj)) { setCardError('CPF/CNPJ inválido'); return; }
    const rawCard = cardNumber.replace(/\s/g, '');
    if (rawCard.length < 13) { setCardError('Número do cartão inválido'); return; }
    const [expM, expY] = cardExpiry.split('/');
    if (!expM || !expY || parseInt(expM) < 1 || parseInt(expM) > 12) { setCardError('Validade inválida'); return; }
    if (cardCvv.length < 3) { setCardError('CVV inválido'); return; }
    if (cardPhone.replace(/\D/g, '').length < 10) { setCardError('Telefone inválido'); return; }
    if (cardCep.replace(/\D/g, '').length < 8) { setCardError('CEP inválido'); return; }

    setCardLoading(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/asaas-gallery-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: data.userId,
          clienteId: data.clienteId,
          sessionId: data.sessionId,
          valor: data.valorTotal,
          descricao: data.descricao,
          galeriaId: data.galeriaId,
          qtdFotos: data.qtdFotos,
          galleryToken: data.galleryToken,
          billingType: 'CREDIT_CARD',
          installmentCount: parseInt(cardInstallments),
          // Let backend recalculate with real fees - but hint the frontend-calculated total
          valorComTaxasFrontend: valorComTaxas,
          creditCard: {
            holderName: cardName,
            number: rawCard,
            expiryMonth: expM,
            expiryYear: `20${expY}`,
            ccv: cardCvv,
          },
          creditCardHolderInfo: {
            name: cardName,
            cpfCnpj: cardCpfCnpj.replace(/\D/g, ''),
            email: '',
            phone: cardPhone.replace(/\D/g, ''),
            postalCode: cardCep.replace(/\D/g, ''),
            addressNumber: 'S/N',
          },
        }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error || 'Pagamento recusado');
      }
      if (result.paid || result.creditCardStatus === 'CONFIRMED' || result.creditCardStatus === 'RECEIVED') {
        setCardSuccess(true);
        toast.success('Pagamento aprovado!');
        setTimeout(() => onPaymentConfirmed(), 2000);
      } else {
        throw new Error('Pagamento não foi aprovado. Tente outro cartão.');
      }
    } catch (err) {
      setCardError(err instanceof Error ? err.message : 'Erro no pagamento');
    } finally {
      setCardLoading(false);
    }
  };

  // ——— Success state ———
  if (pixConfirmed || cardSuccess) {
    return (
      <div
        className={cn("min-h-screen flex items-center justify-center p-4 bg-background text-foreground", backgroundMode === 'dark' && 'dark')}
        style={themeStyles}
      >
        <div className="max-w-sm w-full text-center space-y-6 animate-in fade-in zoom-in duration-500">
          <div className="w-20 h-20 mx-auto rounded-full flex items-center justify-center bg-green-100 dark:bg-green-900/30">
            <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-2xl font-bold">Pagamento confirmado!</h1>
          <p className="text-muted-foreground">Sua seleção foi finalizada com sucesso.</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn("min-h-screen flex flex-col items-center bg-background text-foreground p-4", backgroundMode === 'dark' && 'dark')}
      style={themeStyles}
    >
      <div className="max-w-md w-full space-y-6 py-6">
        {/* Header */}
        {studioLogoUrl ? (
          <img src={studioLogoUrl} alt={studioName || 'Estúdio'} className="h-12 mx-auto object-contain" />
        ) : studioName ? (
          <h1 className="text-xl font-semibold text-center">{studioName}</h1>
        ) : null}

        <div className="text-center space-y-1">
          <h2 className="text-2xl font-bold">Pagamento</h2>
          <p className="text-3xl font-bold text-primary">R$ {data.valorTotal.toFixed(2)}</p>
          <p className="text-sm text-muted-foreground">{data.descricao}</p>
        </div>

        {/* Tabs */}
        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="w-full grid grid-cols-2">
            {data.enabledMethods.pix && (
              <TabsTrigger value="pix" className="gap-2">
                <QrCode className="h-4 w-4" /> PIX
              </TabsTrigger>
            )}
            {data.enabledMethods.creditCard && (
              <TabsTrigger value="card" className="gap-2">
                <CreditCard className="h-4 w-4" /> Cartão
              </TabsTrigger>
            )}
          </TabsList>

          {/* ——— PIX TAB ——— */}
          {data.enabledMethods.pix && (
            <TabsContent value="pix" className="space-y-4 mt-4">
              {!pixQrCode && !pixLoading && (
                <Button onClick={generatePix} className="w-full gap-2" variant="terracotta" size="lg">
                  <QrCode className="h-5 w-5" />
                  Gerar QR Code PIX
                </Button>
              )}

              {pixLoading && (
                <div className="space-y-4 py-8">
                  <Skeleton className="w-48 h-48 mx-auto rounded-lg" />
                  <Skeleton className="h-4 w-32 mx-auto" />
                  <p className="text-center text-sm text-muted-foreground">Gerando QR Code...</p>
                </div>
              )}

              {pixQrCode && (
                <div className="space-y-4 text-center animate-in fade-in duration-300">
                  <div className="inline-block p-4 bg-white rounded-xl shadow-sm border mx-auto">
                    <img src={pixQrCode} alt="QR Code PIX" className="w-52 h-52" />
                  </div>

                  {pixCopiaECola && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">PIX Copia e Cola</p>
                      <div className="relative">
                        <div className="p-3 rounded-lg bg-muted/50 border max-h-20 overflow-y-auto">
                          <code className="text-xs break-all font-mono text-muted-foreground">{pixCopiaECola}</code>
                        </div>
                        <Button variant="secondary" size="sm" onClick={handleCopyPix} className="absolute top-2 right-2">
                          {pixCopied ? <><CheckCircle className="h-4 w-4 mr-1" /> Copiado</> : <><Copy className="h-4 w-4 mr-1" /> Copiar</>}
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <div className="flex items-center justify-center gap-2 text-sm">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      <span className="text-muted-foreground">Aguardando pagamento...</span>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>
          )}

          {/* ——— CARD TAB ——— */}
          {data.enabledMethods.creditCard && (
            <TabsContent value="card" className="space-y-4 mt-4">
              <div className="space-y-3">
                <div>
                  <Label htmlFor="cc-name">Nome no cartão</Label>
                  <Input id="cc-name" value={cardName} onChange={e => setCardName(e.target.value.toUpperCase())} placeholder="NOME COMPLETO" autoComplete="cc-name" />
                </div>
                <div>
                  <Label htmlFor="cc-cpf">CPF / CNPJ</Label>
                  <Input id="cc-cpf" value={cardCpfCnpj} onChange={e => setCardCpfCnpj(maskCpfCnpj(e.target.value))} placeholder="000.000.000-00" inputMode="numeric" maxLength={18} />
                </div>
                <div>
                  <Label htmlFor="cc-number">Número do cartão</Label>
                  <Input id="cc-number" value={cardNumber} onChange={e => setCardNumber(maskCardNumber(e.target.value))} placeholder="0000 0000 0000 0000" inputMode="numeric" maxLength={19} autoComplete="cc-number" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="cc-exp">Validade</Label>
                    <Input id="cc-exp" value={cardExpiry} onChange={e => setCardExpiry(maskExpiry(e.target.value))} placeholder="MM/AA" inputMode="numeric" maxLength={5} autoComplete="cc-exp" />
                  </div>
                  <div>
                    <Label htmlFor="cc-cvv">CVV</Label>
                    <Input id="cc-cvv" value={cardCvv} onChange={e => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="000" inputMode="numeric" maxLength={4} autoComplete="cc-csc" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="cc-phone">Telefone</Label>
                    <Input id="cc-phone" value={cardPhone} onChange={e => setCardPhone(maskPhone(e.target.value))} placeholder="(00) 00000-0000" inputMode="tel" maxLength={15} />
                  </div>
                  <div>
                    <Label htmlFor="cc-cep">CEP</Label>
                    <Input id="cc-cep" value={cardCep} onChange={e => setCardCep(maskCep(e.target.value))} placeholder="00000-000" inputMode="numeric" maxLength={9} />
                  </div>
                </div>

                {/* Installments */}
                {data.maxParcelas > 1 && (
                  <div>
                    <Label>Parcelas</Label>
                    <Select value={cardInstallments} onValueChange={setCardInstallments}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {installmentOptions.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {cardError && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    {cardError}
                  </div>
                )}

                <Button onClick={handleCardSubmit} disabled={cardLoading} className="w-full gap-2" variant="terracotta" size="lg">
                  {cardLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> Processando...</> : <><Lock className="h-4 w-4" /> Pagar R$ {data.valorTotal.toFixed(2)}</>}
                </Button>
              </div>
            </TabsContent>
          )}
        </Tabs>

        {/* Security badge */}
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-2">
          <ShieldCheck className="h-4 w-4" />
          <span>Pagamento criptografado e seguro</span>
        </div>

        {/* Cancel */}
        {onCancel && (
          <Button variant="ghost" onClick={onCancel} className="w-full gap-2">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
        )}
      </div>
    </div>
  );
}
