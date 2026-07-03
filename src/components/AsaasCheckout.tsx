import { useState, useEffect, useRef, useCallback } from 'react';
import {
  CreditCard,
  QrCode,
  Copy,
  CheckCircle,
  Loader2,
  Lock,
  ShieldCheck,
  AlertCircle,
  ArrowLeft,
  User,
  FileText,
  Mail,
  Calendar,
  Phone,
  MapPin,
  Image as ImageIcon,
  Info,
} from 'lucide-react';
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
  discount?: {
    active: boolean;
    expiration?: string;
    tiers: Array<{ min: number; max: number; percentageFee: number }>;
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
  visitorId?: string;
  enabledMethods: { pix: boolean; creditCard: boolean; boleto?: boolean };
  maxParcelas: number;
  absorverTaxa: boolean;
  /** "Vou antecipar recebíveis?" — campo granular */
  ireiAntecipar?: boolean;
  /** "Repassar custo da antecipação ao cliente?" — campo granular */
  repassarTaxaAntecipacao?: boolean;
  /** Legacy fallback — quando false, apenas taxa de processamento é cobrada (sem antecipação) */
  incluirTaxaAntecipacao?: boolean;
  // Legacy fields (kept for backward compat but ignored when accountFees is available)
  taxaAntecipacao?: boolean;
  taxaAntecipacaoPercentual?: number;
  taxaAntecipacaoCreditoAvista?: number;
  taxaAntecipacaoCreditoParcelado?: number;
}

export interface PayerHintsPrefill {
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  cpfCnpj?: string | null;
}

export interface PayerHintsMissingFlags {
  name?: boolean;
  email?: boolean;
  phone?: boolean;
  cpfCnpj?: boolean;
}

interface AsaasCheckoutProps {
  data: AsaasCheckoutData;
  studioName?: string;
  studioLogoUrl?: string;
  onPaymentConfirmed: () => void;
  onCancel?: () => void;
  onMissingCpf?: () => void;
  /** Valores já conhecidos do pagador — pré-preenchem os campos do checkout. */
  payerHints?: PayerHintsPrefill;
  /** Quais campos faltam no cadastro (backend). Direciona quais aparecem inline no PIX. */
  payerMissing?: PayerHintsMissingFlags;
  /** Persiste os dados no cadastro do cliente antes de gerar a cobrança. */
  onPersistContact?: (data: { email?: string; phone?: string; nome?: string; cpfCnpj?: string }) => Promise<void>;
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
  onMissingCpf,
  payerHints,
  payerMissing,
  onPersistContact,
  themeStyles = {},
  backgroundMode = 'light',
}: AsaasCheckoutProps) {
  const defaultTab = data.enabledMethods.pix ? 'pix' : 'card';

  // ——— Pré-preenchimento dos dados do pagador ———
  const initialFullName = payerHints?.fullName || '';
  const initialEmail = payerHints?.email || '';
  const initialPhone = payerHints?.phone ? maskPhone(payerHints.phone) : '';
  const initialCpfCnpj = payerHints?.cpfCnpj ? maskCpfCnpj(payerHints.cpfCnpj) : '';

  // ——— PIX state ———
  const [pixLoading, setPixLoading] = useState(false);
  const [pixQrCode, setPixQrCode] = useState<string | null>(null);
  const [pixCopiaECola, setPixCopiaECola] = useState<string | null>(null);
  const [pixCobrancaId, setPixCobrancaId] = useState<string | null>(null);
  const [pixCopied, setPixCopied] = useState(false);
  const [pixConfirmed, setPixConfirmed] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartRef = useRef<number>(0);

  // ——— Pré-checkout PIX inline (dados do pagador coletados na própria tela) ———
  const [pixName, setPixName] = useState(initialFullName);
  const [pixEmail, setPixEmail] = useState(initialEmail);
  const [pixCpfCnpj, setPixCpfCnpj] = useState(initialCpfCnpj);
  const [pixPhone, setPixPhone] = useState(initialPhone);
  const [pixContactLoading, setPixContactLoading] = useState(false);

  // ——— Card state (pré-preenchido com dados conhecidos) ———
  const [cardLoading, setCardLoading] = useState(false);
  const [cardName, setCardName] = useState(initialFullName.toUpperCase());
  const [cardCpfCnpj, setCardCpfCnpj] = useState(initialCpfCnpj);
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardPhone, setCardPhone] = useState(initialPhone);
  const [cardEmail, setCardEmail] = useState(initialEmail);
  const [cardCep, setCardCep] = useState('');
  const [cardInstallments, setCardInstallments] = useState('1');
  const [cardError, setCardError] = useState<string | null>(null);
  const [cardSuccess, setCardSuccess] = useState(false);

  // ——— Inline field errors (suave UX, não bloqueia digitação) ———
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const setFieldError = (key: string, msg: string | null) => {
    setFieldErrors(prev => {
      const next = { ...prev };
      if (msg) next[key] = msg;
      else delete next[key];
      return next;
    });
  };

  // ——— Refs para auto-foco entre campos ———
  const cpfRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const cardNumberRef = useRef<HTMLInputElement>(null);
  const cardExpiryRef = useRef<HTMLInputElement>(null);
  const cardCvvRef = useRef<HTMLInputElement>(null);
  const cardPhoneRef = useRef<HTMLInputElement>(null);
  const cardCepRef = useRef<HTMLInputElement>(null);
  const pixNameRef = useRef<HTMLInputElement>(null);
  const pixEmailRef = useRef<HTMLInputElement>(null);
  const pixCpfRef = useRef<HTMLInputElement>(null);
  const pixPhoneRef = useRef<HTMLInputElement>(null);
  const pixGenerateRef = useRef<HTMLButtonElement>(null);

  // ——— Flags: quais campos inline mostrar no PIX ———
  // Se o backend disse que falta, ou se o valor pré-preenchido está vazio, exibimos.
  const needsName = !!payerMissing?.name || !initialFullName;
  const needsEmail = !!payerMissing?.email || !initialEmail;
  const needsCpf = !!payerMissing?.cpfCnpj || !initialCpfCnpj;
  const needsPhone = !!payerMissing?.phone || !initialPhone;
  const showPixContactForm = needsName || needsEmail || needsCpf || needsPhone;


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
          visitorId: data.visitorId,
          billingType: 'PIX',
        }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        // Backend exigiu CPF do pagador.
        if (result?.code === 'MISSING_CPF_CNPJ') {
          setPixQrCode(null);
          setPixCopiaECola(null);
          setPixCobrancaId(null);
          if (showPixContactForm) {
            setFieldError('pixCpf', 'Confirme seu CPF ou CNPJ para gerar o PIX.');
            pixCpfRef.current?.focus();
          } else if (onMissingCpf) {
            onMissingCpf();
          }
          return;
        }
        // Email inválido (Asaas rejeita acentos/caracteres não-ASCII).
        if (result?.code === 'INVALID_EMAIL') {
          setPixQrCode(null);
          setPixCopiaECola(null);
          setPixCobrancaId(null);
          setFieldError('pixEmail', 'Este email não é aceito pelo Asaas. Use um email sem acentos ou caracteres especiais.');
          pixEmailRef.current?.focus();
          return;
        }
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
            setTimeout(() => onPaymentConfirmed(), 2000);
          }
        } catch { /* silently retry */ }
      }, POLL_INTERVAL);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao gerar PIX');
    } finally {
      setPixLoading(false);
    }
  }, [data, onPaymentConfirmed, onMissingCpf, showPixContactForm]);

  // ——— Validação do formulário inline de PIX ———
  const pixFormValid = (() => {
    if (needsName && pixName.trim().length < 2) return false;
    if (needsEmail && !/\S+@\S+\.\S+/.test(pixEmail)) return false;
    if (needsCpf && !validateCpfCnpj(pixCpfCnpj)) return false;
    if (needsPhone && pixPhone.replace(/\D/g, '').length < 10) return false;
    return true;
  })();

  // Wrapper: persiste dados no cadastro (se necessário) e dispara generatePix.
  const handleGeneratePixClick = async () => {
    // Validação final antes de submeter
    if (needsName && pixName.trim().length < 2) {
      setFieldError('pixName', 'Informe seu nome');
      pixNameRef.current?.focus();
      return;
    }
    if (needsEmail && !/\S+@\S+\.\S+/.test(pixEmail)) {
      setFieldError('pixEmail', 'Email inválido');
      pixEmailRef.current?.focus();
      return;
    }
    if (needsCpf && !validateCpfCnpj(pixCpfCnpj)) {
      setFieldError('pixCpf', 'CPF ou CNPJ inválido');
      pixCpfRef.current?.focus();
      return;
    }
    if (needsPhone && pixPhone.replace(/\D/g, '').length < 10) {
      setFieldError('pixPhone', 'Telefone inválido');
      pixPhoneRef.current?.focus();
      return;
    }

    // Persiste no cadastro do cliente (galeria_visitantes/clientes) — melhor esforço.
    if (showPixContactForm && onPersistContact) {
      setPixContactLoading(true);
      try {
        await onPersistContact({
          nome: needsName ? pixName.trim() : undefined,
          email: needsEmail ? pixEmail.trim() : undefined,
          cpfCnpj: needsCpf ? pixCpfCnpj.replace(/\D/g, '') : undefined,
          phone: needsPhone ? pixPhone.replace(/\D/g, '') : undefined,
        });
      } catch (e) {
        setPixContactLoading(false);
        toast.error(e instanceof Error ? e.message : 'Não foi possível salvar seus dados.');
        return;
      }
      setPixContactLoading(false);
    }

    await generatePix();
  };

  const handleCopyPix = async () => {
    if (!pixCopiaECola) return;
    try {
      await navigator.clipboard.writeText(pixCopiaECola);
      setPixCopied(true);
      setTimeout(() => setPixCopied(false), 3000);
    } catch { toast.error('Erro ao copiar'); }
  };

  // ——— Card Flow: Calculate installments with combined fees ———
  // Resolve anticipation config: new granular fields → legacy fallback
  const ireiAntecipar = data.ireiAntecipar ?? data.incluirTaxaAntecipacao ?? false;
  const repassarAntecipacao = ireiAntecipar
    ? (data.repassarTaxaAntecipacao ?? data.incluirTaxaAntecipacao ?? false)
    : false;
  const incluirAntecipacao = repassarAntecipacao;

  const installmentOptions: Array<{ value: string; label: string; totalValue: number }> = [];
  for (let i = 1; i <= (data.maxParcelas || 12); i++) {
    let totalComTaxas = data.valorTotal;
    let label = `${i}x de R$ ${(data.valorTotal / i).toFixed(2)}`;

    if (!data.absorverTaxa && accountFees) {
      // 1. Processing fee (tier-based percentage + fixed operation value)
      // Use discount tiers if active, otherwise standard tiers
      const activeTiers = (accountFees.discount?.active && accountFees.discount.tiers.length > 0)
        ? accountFees.discount.tiers
        : accountFees.creditCard.tiers;
      const tier = activeTiers.find(t => i >= t.min && i <= t.max);
      const processingPercentage = tier?.percentageFee ?? 0;
      const processingFee = (data.valorTotal * processingPercentage / 100) + accountFees.creditCard.operationValue;

      // 2. Anticipation fee — only when enabled
      let anticipationFee = 0;
      if (incluirAntecipacao) {
        const taxaMensal = i === 1
          ? accountFees.creditCard.detachedMonthlyFeeValue
          : accountFees.creditCard.installmentMonthlyFeeValue;
        const result = calcularAntecipacao(data.valorTotal, i, taxaMensal);
        anticipationFee = result.totalTaxa;
      }

      totalComTaxas = data.valorTotal + processingFee + anticipationFee;
      totalComTaxas = Math.round(totalComTaxas * 100) / 100;

      label = `${i}x de R$ ${(totalComTaxas / i).toFixed(2)}`;
      if (totalComTaxas > data.valorTotal) label += ` (total R$ ${totalComTaxas.toFixed(2)})`;
    } else if (!data.absorverTaxa && !accountFees && !feesLoading) {
      // Fallback to legacy fields if fees failed to load
      if (incluirAntecipacao) {
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
    if (!cardEmail || !/\S+@\S+\.\S+/.test(cardEmail)) { setCardError('Informe o email do titular do cartão'); return; }
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
          visitorId: data.visitorId,
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
            email: cardEmail,
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
      if (result.paid) {
        // Single payment (à vista) finalized inline by backend
        setCardSuccess(true);
        setTimeout(() => onPaymentConfirmed(), 2000);
      } else if (result.requiresPolling && result.cobrancaId) {
        // Installment or async payment — poll check-payment-status
        setCardLoading(true);
        const cobrancaId = result.cobrancaId;
        const pollStart = Date.now();
        const maxPollTime = 2 * 60 * 1000; // 2 minutes
        const pollInterval = 12000; // 12s (Realtime cobre confirmação instantânea; polling é fallback)

        const poll = async () => {
          try {
            const pollRes = await fetch(`${SUPABASE_URL}/functions/v1/check-payment-status`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ cobrancaId }),
            });
            const pollData = await pollRes.json();

            if (pollData.status === 'pago') {
              setCardSuccess(true);
              setCardLoading(false);
              setTimeout(() => onPaymentConfirmed(), 2000);
              return;
            }

            if (Date.now() - pollStart < maxPollTime) {
              setTimeout(poll, pollInterval);
            } else {
              // Timeout — payment may still be processing
              setCardLoading(false);
              setCardSuccess(true);
              setTimeout(() => onPaymentConfirmed(), 2000);
            }
          } catch {
            if (Date.now() - pollStart < maxPollTime) {
              setTimeout(poll, pollInterval);
            } else {
              setCardLoading(false);
              setCardSuccess(true);
              setTimeout(() => onPaymentConfirmed(), 2000);
            }
          }
        };

        poll();
      } else if (result.creditCardStatus === 'CONFIRMED' || result.creditCardStatus === 'RECEIVED') {
        // Fallback: backend said confirmed but didn't set paid flag
        setCardSuccess(true);
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

  // ——— Helpers de UI ———
  const checkoutInputClass = (errKey?: string) =>
    cn(
      'h-12 bg-background border border-border/70 hover:border-border transition-colors',
      'focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary focus-visible:ring-offset-0',
      'placeholder:text-muted-foreground/50',
      errKey && fieldErrors[errKey] && 'border-destructive/50 focus-visible:border-destructive focus-visible:ring-destructive/20',
    );

  const SectionTitle = ({ icon: Icon, children }: { icon: typeof User; children: React.ReactNode }) => (
    <div className="flex items-center gap-2 pb-1">
      <Icon className="h-4 w-4 text-primary" />
      <h3 className="text-sm font-semibold text-foreground">{children}</h3>
    </div>
  );

  const FieldError = ({ name }: { name: string }) =>
    fieldErrors[name] ? (
      <p className="text-xs text-destructive mt-1 flex items-center gap-1">
        <AlertCircle className="h-3 w-3" /> {fieldErrors[name]}
      </p>
    ) : null;

  return (
    <div
      className={cn("min-h-screen flex flex-col items-center bg-background text-foreground p-4", backgroundMode === 'dark' && 'dark')}
      style={themeStyles}
    >
      <div className="max-w-md w-full space-y-6 py-6">
        {/* Logo */}
        {studioLogoUrl ? (
          <img src={studioLogoUrl} alt={studioName || 'Estúdio'} className="h-16 mx-auto object-contain" />
        ) : studioName ? (
          <h1 className="text-xl font-semibold text-center">{studioName}</h1>
        ) : null}

        {/* Selo de segurança no topo */}
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5 text-primary" />
          <span>Ambiente seguro e criptografado</span>
        </div>

        {/* Hierarquia premium do valor */}
        <div className="text-center space-y-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Pagamento</p>
          <p className="text-5xl font-bold text-primary tracking-tight">
            R$ {data.valorTotal.toFixed(2).replace('.', ',')}
          </p>
          <p className="text-sm text-muted-foreground flex items-center justify-center gap-1.5">
            <ImageIcon className="h-3.5 w-3.5" />
            <span>{data.descricao}</span>
          </p>
        </div>

        {/* Tabs */}
        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="w-full grid grid-cols-2 h-14 p-1 bg-muted/50 rounded-xl">
            {data.enabledMethods.pix && (
              <TabsTrigger
                value="pix"
                className="gap-2 h-full rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm"
              >
                <QrCode className="h-5 w-5" /> PIX
              </TabsTrigger>
            )}
            {data.enabledMethods.creditCard && (
              <TabsTrigger
                value="card"
                className="gap-2 h-full rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm"
              >
                <CreditCard className="h-5 w-5" /> Cartão
              </TabsTrigger>
            )}
          </TabsList>

          {/* ——— PIX TAB ——— */}
          {data.enabledMethods.pix && (
            <TabsContent value="pix" className="space-y-4 mt-6">
              {!pixQrCode && !pixLoading && (
                <div className="space-y-4">
                  {showPixContactForm && (
                    <section className="space-y-3 p-4 rounded-xl border border-border/60 bg-muted/30">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-primary" />
                        <h3 className="text-sm font-semibold text-foreground">Seus dados para o PIX</h3>
                      </div>
                      <p className="text-xs text-muted-foreground -mt-1">
                        Precisamos destes dados para gerar a cobrança e enviar o comprovante.
                      </p>

                      {needsName && (
                        <div className="space-y-1.5">
                          <Label htmlFor="pix-name" className="text-xs font-medium text-muted-foreground">Nome completo</Label>
                          <Input
                            ref={pixNameRef}
                            id="pix-name"
                            autoFocus
                            value={pixName}
                            onChange={(e) => { setPixName(e.target.value); if (fieldErrors.pixName) setFieldError('pixName', null); }}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (needsEmail ? pixEmailRef : needsCpf ? pixCpfRef : needsPhone ? pixPhoneRef : pixGenerateRef).current?.focus(); } }}
                            placeholder="Como você se chama"
                            autoComplete="name"
                            maxLength={80}
                            className={checkoutInputClass('pixName')}
                          />
                          <FieldError name="pixName" />
                        </div>
                      )}

                      {needsEmail && (
                        <div className="space-y-1.5">
                          <Label htmlFor="pix-email" className="text-xs font-medium text-muted-foreground">Email</Label>
                          <Input
                            ref={pixEmailRef}
                            id="pix-email"
                            type="email"
                            inputMode="email"
                            autoFocus={!needsName}
                            value={pixEmail}
                            onChange={(e) => { setPixEmail(e.target.value); if (fieldErrors.pixEmail) setFieldError('pixEmail', null); }}
                            onBlur={() => {
                              if (pixEmail && !/\S+@\S+\.\S+/.test(pixEmail)) setFieldError('pixEmail', 'Email inválido');
                            }}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (needsCpf ? pixCpfRef : needsPhone ? pixPhoneRef : pixGenerateRef).current?.focus(); } }}
                            placeholder="voce@email.com"
                            autoComplete="email"
                            maxLength={160}
                            className={checkoutInputClass('pixEmail')}
                          />
                          <FieldError name="pixEmail" />
                        </div>
                      )}

                      {needsCpf && (
                        <div className="space-y-1.5">
                          <Label htmlFor="pix-cpf" className="text-xs font-medium text-muted-foreground">CPF ou CNPJ</Label>
                          <Input
                            ref={pixCpfRef}
                            id="pix-cpf"
                            inputMode="numeric"
                            autoFocus={!needsName && !needsEmail}
                            value={pixCpfCnpj}
                            onChange={(e) => {
                              const masked = maskCpfCnpj(e.target.value);
                              setPixCpfCnpj(masked);
                              if (fieldErrors.pixCpf) setFieldError('pixCpf', null);
                              const digits = masked.replace(/\D/g, '');
                              if (digits.length === 11 || digits.length === 14) {
                                if (needsPhone) pixPhoneRef.current?.focus();
                                else pixGenerateRef.current?.focus();
                              }
                            }}
                            onBlur={() => {
                              if (pixCpfCnpj && !validateCpfCnpj(pixCpfCnpj)) setFieldError('pixCpf', 'CPF ou CNPJ inválido');
                            }}
                            placeholder="000.000.000-00"
                            maxLength={18}
                            className={checkoutInputClass('pixCpf')}
                          />
                          <FieldError name="pixCpf" />
                        </div>
                      )}

                      {needsPhone && (
                        <div className="space-y-1.5">
                          <Label htmlFor="pix-phone" className="text-xs font-medium text-muted-foreground">Telefone (WhatsApp)</Label>
                          <Input
                            ref={pixPhoneRef}
                            id="pix-phone"
                            type="tel"
                            inputMode="tel"
                            autoFocus={!needsName && !needsEmail && !needsCpf}
                            value={pixPhone}
                            onChange={(e) => {
                              const masked = maskPhone(e.target.value);
                              setPixPhone(masked);
                              if (fieldErrors.pixPhone) setFieldError('pixPhone', null);
                              if (masked.replace(/\D/g, '').length === 11) pixGenerateRef.current?.focus();
                            }}
                            placeholder="(11) 98765-4321"
                            autoComplete="tel"
                            maxLength={15}
                            className={checkoutInputClass('pixPhone')}
                          />
                          <FieldError name="pixPhone" />
                        </div>
                      )}
                    </section>
                  )}

                  <Button
                    ref={pixGenerateRef}
                    onClick={handleGeneratePixClick}
                    disabled={pixContactLoading || (showPixContactForm && !pixFormValid)}
                    className="w-full gap-2 h-12 rounded-lg active:scale-[0.98] transition-transform"
                    variant="terracotta"
                  >
                    {pixContactLoading ? (
                      <><Loader2 className="h-5 w-5 animate-spin" /> Salvando dados...</>
                    ) : (
                      <><QrCode className="h-5 w-5" /> Gerar QR Code PIX</>
                    )}
                  </Button>
                </div>
              )}

              {pixLoading && (
                <div className="space-y-4 py-8">
                  <Skeleton className="w-48 h-48 mx-auto rounded-2xl" />
                  <Skeleton className="h-4 w-32 mx-auto" />
                  <p className="text-center text-sm text-muted-foreground">Gerando QR Code...</p>
                </div>
              )}

              {pixQrCode && (
                <div className="space-y-4 text-center animate-in fade-in duration-300">
                  <div className="inline-block p-5 bg-white rounded-2xl shadow-md border border-border/50 mx-auto">
                    <img src={pixQrCode} alt="QR Code PIX" className="w-52 h-52" />
                  </div>

                  {pixCopiaECola && (
                    <div className="space-y-2 text-left">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">PIX Copia e Cola</p>
                      <div className="relative">
                        <div className="p-3 pr-24 rounded-lg bg-muted/40 border border-border/70 max-h-20 overflow-y-auto">
                          <code className="text-xs break-all font-mono text-muted-foreground">{pixCopiaECola}</code>
                        </div>
                        <Button variant="secondary" size="sm" onClick={handleCopyPix} className="absolute top-2 right-2 h-8">
                          {pixCopied ? <><CheckCircle className="h-4 w-4 mr-1" /> Copiado</> : <><Copy className="h-4 w-4 mr-1" /> Copiar</>}
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Aguardando pagamento...</span>
                  </div>
                </div>
              )}
            </TabsContent>
          )}

          {/* ——— CARD TAB ——— */}
          {data.enabledMethods.creditCard && (
            <TabsContent value="card" className="space-y-6 mt-6">
              {/* Seção 1: Dados do titular */}
              <section className="space-y-4">
                <SectionTitle icon={User}>Dados do titular</SectionTitle>

                <div className="space-y-1.5">
                  <Label htmlFor="cc-name" className="text-xs font-medium text-muted-foreground">Nome no cartão</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70 pointer-events-none" />
                    <Input
                      id="cc-name"
                      value={cardName}
                      onChange={e => setCardName(e.target.value.toUpperCase())}
                      placeholder="NOME COMPLETO"
                      autoComplete="cc-name"
                      className={cn(checkoutInputClass(), 'pl-10')}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="cc-cpf" className="text-xs font-medium text-muted-foreground">CPF / CNPJ</Label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70 pointer-events-none" />
                    <Input
                      ref={cpfRef}
                      id="cc-cpf"
                      value={cardCpfCnpj}
                      onChange={e => {
                        const masked = maskCpfCnpj(e.target.value);
                        setCardCpfCnpj(masked);
                        if (fieldErrors.cpf) setFieldError('cpf', null);
                        const digits = masked.replace(/\D/g, '');
                        if (digits.length === 11) emailRef.current?.focus();
                      }}
                      onBlur={() => {
                        if (cardCpfCnpj && !validateCpfCnpj(cardCpfCnpj)) {
                          setFieldError('cpf', 'CPF/CNPJ inválido');
                        }
                      }}
                      placeholder="000.000.000-00"
                      inputMode="numeric"
                      maxLength={18}
                      className={cn(checkoutInputClass('cpf'), 'pl-10')}
                    />
                  </div>
                  <FieldError name="cpf" />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="cc-email" className="text-xs font-medium text-muted-foreground">Email do titular</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70 pointer-events-none" />
                    <Input
                      ref={emailRef}
                      id="cc-email"
                      type="email"
                      value={cardEmail}
                      onChange={e => {
                        setCardEmail(e.target.value);
                        if (fieldErrors.email) setFieldError('email', null);
                      }}
                      onBlur={() => {
                        if (cardEmail && !/\S+@\S+\.\S+/.test(cardEmail)) {
                          setFieldError('email', 'Email inválido');
                        }
                      }}
                      placeholder="email@exemplo.com"
                      autoComplete="email"
                      className={cn(checkoutInputClass('email'), 'pl-10')}
                    />
                  </div>
                  <FieldError name="email" />
                </div>
              </section>

              {/* Seção 2: Dados do cartão */}
              <section className="space-y-4">
                <SectionTitle icon={CreditCard}>Dados do cartão</SectionTitle>

                <div className="space-y-1.5">
                  <Label htmlFor="cc-number" className="text-xs font-medium text-muted-foreground">Número do cartão</Label>
                  <div className="relative">
                    <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70 pointer-events-none" />
                    <Input
                      ref={cardNumberRef}
                      id="cc-number"
                      value={cardNumber}
                      onChange={e => {
                        const masked = maskCardNumber(e.target.value);
                        setCardNumber(masked);
                        if (fieldErrors.cardNumber) setFieldError('cardNumber', null);
                        const digits = masked.replace(/\s/g, '');
                        if (digits.length >= 16) cardExpiryRef.current?.focus();
                      }}
                      onBlur={() => {
                        const digits = cardNumber.replace(/\s/g, '');
                        if (digits && digits.length < 13) {
                          setFieldError('cardNumber', 'Número do cartão inválido');
                        }
                      }}
                      placeholder="0000 0000 0000 0000"
                      inputMode="numeric"
                      maxLength={19}
                      autoComplete="cc-number"
                      className={cn(checkoutInputClass('cardNumber'), 'pl-10')}
                    />
                  </div>
                  <FieldError name="cardNumber" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="cc-exp" className="text-xs font-medium text-muted-foreground">Validade</Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70 pointer-events-none" />
                      <Input
                        ref={cardExpiryRef}
                        id="cc-exp"
                        value={cardExpiry}
                        onChange={e => {
                          const masked = maskExpiry(e.target.value);
                          setCardExpiry(masked);
                          if (fieldErrors.expiry) setFieldError('expiry', null);
                          if (masked.length === 5) cardCvvRef.current?.focus();
                        }}
                        onBlur={() => {
                          if (cardExpiry && cardExpiry.length === 5) {
                            const [m, y] = cardExpiry.split('/');
                            const mm = parseInt(m);
                            if (!mm || mm < 1 || mm > 12) {
                              setFieldError('expiry', 'Validade inválida');
                            }
                          } else if (cardExpiry) {
                            setFieldError('expiry', 'Validade incompleta');
                          }
                        }}
                        placeholder="MM/AA"
                        inputMode="numeric"
                        maxLength={5}
                        autoComplete="cc-exp"
                        className={cn(checkoutInputClass('expiry'), 'pl-10')}
                      />
                    </div>
                    <FieldError name="expiry" />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="cc-cvv" className="text-xs font-medium text-muted-foreground">CVV</Label>
                      <span className="text-[10px] text-muted-foreground/70 flex items-center gap-1" title="3 dígitos no verso">
                        <Info className="h-3 w-3" /> verso
                      </span>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70 pointer-events-none" />
                      <Input
                        ref={cardCvvRef}
                        id="cc-cvv"
                        value={cardCvv}
                        onChange={e => {
                          const v = e.target.value.replace(/\D/g, '').slice(0, 4);
                          setCardCvv(v);
                          if (v.length >= 3) cardPhoneRef.current?.focus();
                        }}
                        placeholder="000"
                        inputMode="numeric"
                        maxLength={4}
                        autoComplete="cc-csc"
                        className={cn(checkoutInputClass(), 'pl-10')}
                      />
                    </div>
                  </div>
                </div>
              </section>

              {/* Seção 3: Contato */}
              <section className="space-y-4">
                <SectionTitle icon={Phone}>Contato</SectionTitle>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="cc-phone" className="text-xs font-medium text-muted-foreground">
                      Telefone <span className="text-muted-foreground/60">(opcional)</span>
                    </Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70 pointer-events-none" />
                      <Input
                        ref={cardPhoneRef}
                        id="cc-phone"
                        value={cardPhone}
                        onChange={e => {
                          const masked = maskPhone(e.target.value);
                          setCardPhone(masked);
                          if (masked.replace(/\D/g, '').length === 11) cardCepRef.current?.focus();
                        }}
                        placeholder="(00) 00000-0000"
                        inputMode="tel"
                        maxLength={15}
                        className={cn(checkoutInputClass(), 'pl-10')}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cc-cep" className="text-xs font-medium text-muted-foreground">CEP</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70 pointer-events-none" />
                      <Input
                        ref={cardCepRef}
                        id="cc-cep"
                        value={cardCep}
                        onChange={e => setCardCep(maskCep(e.target.value))}
                        placeholder="00000-000"
                        inputMode="numeric"
                        maxLength={9}
                        className={cn(checkoutInputClass(), 'pl-10')}
                      />
                    </div>
                  </div>
                </div>

                {/* Installments */}
                {data.maxParcelas > 1 && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Parcelas</Label>
                    {feesLoading && !data.absorverTaxa ? (
                      <div className="space-y-2">
                        <Skeleton className="h-12 w-full rounded-md" />
                        <p className="text-xs text-muted-foreground">Carregando taxas...</p>
                      </div>
                    ) : (
                      <Select value={cardInstallments} onValueChange={setCardInstallments}>
                        <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {installmentOptions.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                )}
              </section>

              {cardError && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  {cardError}
                </div>
              )}

              <Button
                onClick={handleCardSubmit}
                disabled={cardLoading || feesLoading}
                className="w-full gap-2 h-12 rounded-lg text-base font-semibold active:scale-[0.98] transition-transform"
                variant="terracotta"
              >
                {cardLoading ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Processando...</>
                ) : (
                  <><Lock className="h-4 w-4" /> Finalizar pagamento • R$ {valorComTaxas.toFixed(2).replace('.', ',')}</>
                )}
              </Button>

              {/* Selo final */}
              <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                Seus dados estão protegidos com segurança de ponta a ponta.
              </p>
            </TabsContent>
          )}
        </Tabs>

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
