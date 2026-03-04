import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthContext } from '@/contexts/AuthContext';
import { useCreditPackages } from '@/hooks/useCreditPackages';
import { useAsaasSubscription } from '@/hooks/useAsaasSubscription';
import { useCouponValidation } from '@/hooks/useCouponValidation';
import { isSubActiveForPlan } from '@/lib/transferPlans';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Loader2, Lock, Smartphone, CreditCard, Info, Check, Tag, X, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { PixPaymentDisplay } from '@/components/credits/PixPaymentDisplay';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

/* ─── CPF / CNPJ mathematical validation ─── */

function isValidCPF(cpf: string): boolean {
  cpf = cpf.replace(/\D/g, '');
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cpf[i]) * (10 - i);
  let rem = (sum * 10) % 11;
  if (rem === 10) rem = 0;
  if (rem !== parseInt(cpf[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cpf[i]) * (11 - i);
  rem = (sum * 10) % 11;
  if (rem === 10) rem = 0;
  return rem === parseInt(cpf[10]);
}

function isValidCNPJ(cnpj: string): boolean {
  cnpj = cnpj.replace(/\D/g, '');
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;
  const weights1 = [5,4,3,2,9,8,7,6,5,4,3,2];
  const weights2 = [6,5,4,3,2,9,8,7,6,5,4,3,2];
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(cnpj[i]) * weights1[i];
  let rem = sum % 11;
  const d1 = rem < 2 ? 0 : 11 - rem;
  if (parseInt(cnpj[12]) !== d1) return false;
  sum = 0;
  for (let i = 0; i < 13; i++) sum += parseInt(cnpj[i]) * weights2[i];
  rem = sum % 11;
  const d2 = rem < 2 ? 0 : 11 - rem;
  return parseInt(cnpj[13]) === d2;
}

/* ─── State types ─── */

interface SelectPayment {
  type: 'select';
  packageId: string;
  packageName: string;
  credits: number;
  priceCents: number;
}

interface SubscriptionPayment {
  type: 'subscription';
  planType: string;
  planName: string;
  billingCycle: 'MONTHLY' | 'YEARLY';
  priceCents: number;
  isUpgrade?: boolean;
  isRenewal?: boolean;
  prorataValueCents?: number;
  currentSubscriptionId?: string;
  subscriptionIdsToCancel?: string[];
  currentPlanName?: string;
  couponCode?: string;
}

type PaymentState = SelectPayment | SubscriptionPayment;

/* ─── Format helpers ─── */
const formatCurrency = (cents: number) =>
  (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatCardNumber = (value: string) => {
  const clean = value.replace(/\D/g, '').slice(0, 16);
  return clean.replace(/(\d{4})(?=\d)/g, '$1 ');
};

/* ═══════════════════════════════════════════
   STEP INDICATOR
   ═══════════════════════════════════════════ */

const STEPS = [
  { key: 'personal', label: 'Dados' },
  { key: 'payment', label: 'Pagamento' },
  { key: 'review', label: 'Revisão' },
] as const;

function StepIndicator({ currentStep, completedSteps }: { currentStep: number; completedSteps: number[] }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {STEPS.map((step, i) => {
        const isActive = i === currentStep;
        const isCompleted = completedSteps.includes(i);
        return (
          <div key={step.key} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  'h-9 w-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all border-2',
                  isCompleted
                    ? 'bg-primary border-primary text-primary-foreground'
                    : isActive
                      ? 'border-primary text-primary bg-primary/10'
                      : 'border-muted-foreground/30 text-muted-foreground bg-muted/30'
                )}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span className={cn(
                'text-xs font-medium',
                isActive || isCompleted ? 'text-foreground' : 'text-muted-foreground'
              )}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn(
                'w-12 md:w-20 h-0.5 mx-2 mb-5 rounded-full transition-all',
                isCompleted ? 'bg-primary' : 'bg-muted-foreground/20'
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════
   ORDER SUMMARY (sidebar / bottom card)
   ═══════════════════════════════════════════ */

function OrderSummary({
  pkg,
  installments,
  couponDiscount,
  couponCode,
  couponDiscountType,
  couponDiscountValue,
}: {
  pkg: PaymentState;
  installments: number;
  couponDiscount: number | null;
  couponCode: string | null;
  couponDiscountType: string | null;
  couponDiscountValue: number | null;
}) {
  const isUpgrade = pkg.type === 'subscription' && pkg.isUpgrade;
  const isRenewal = pkg.type === 'subscription' && pkg.isRenewal;
  const isYearly = pkg.type === 'subscription' && pkg.billingCycle === 'YEARLY';

  // Base amount for calculation
  const baseCents = isUpgrade && !isRenewal && pkg.type === 'subscription' && pkg.prorataValueCents != null
    ? pkg.prorataValueCents
    : pkg.priceCents;

  const finalCents = couponDiscount != null ? couponDiscount : baseCents;
  const hasDiscount = couponDiscount != null && couponDiscount < baseCents;

  const prorataFormatted = isUpgrade && !isRenewal && pkg.type === 'subscription' && pkg.prorataValueCents != null
    ? formatCurrency(pkg.prorataValueCents)
    : null;

  return (
    <div className="rounded-xl border bg-card p-6 space-y-4 lg:sticky lg:top-20 shadow-sm">
      <h2 className="font-semibold text-foreground text-base">Resumo do Pedido</h2>
      
      <div className="border-t pt-4 space-y-1">
        <p className="font-medium text-foreground">
          {pkg.type === 'select' ? pkg.packageName : pkg.planName}
        </p>
        <p className="text-sm text-muted-foreground">
          {pkg.type === 'select'
            ? `${pkg.credits.toLocaleString('pt-BR')} créditos`
            : isRenewal
              ? 'Renovação antecipada'
              : isUpgrade
                ? `Upgrade de ${(pkg as SubscriptionPayment).currentPlanName || 'plano atual'}`
                : isYearly
                  ? (installments === 1 ? 'Assinatura anual' : 'Compra parcelada')
                  : 'Assinatura mensal'}
        </p>
      </div>

      <div className="border-t pt-4 space-y-2">
        {isUpgrade && prorataFormatted ? (
          <>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Valor do novo plano</span>
              <span className="text-foreground">
                {formatCurrency(pkg.priceCents)}/{(pkg as SubscriptionPayment).billingCycle === 'MONTHLY' ? 'mês' : 'ano'}
              </span>
            </div>
            {pkg.type === 'subscription' && pkg.prorataValueCents != null && pkg.prorataValueCents < pkg.priceCents && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Crédito de planos ativos</span>
                <span className="text-primary font-medium">-{formatCurrency(pkg.priceCents - pkg.prorataValueCents)}</span>
              </div>
            )}
            {hasDiscount && couponCode && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Tag className="h-3 w-3" /> Cupom {couponCode}
                </span>
                <span className="text-primary font-medium">-{formatCurrency(baseCents - finalCents)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-base border-t pt-2">
              <span className="text-foreground">Pagar agora</span>
              <span className="text-primary">{formatCurrency(finalCents)}</span>
            </div>
          </>
        ) : (
          <>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className={cn('text-foreground', hasDiscount && 'line-through text-muted-foreground')}>
                {formatCurrency(baseCents)}
              </span>
            </div>
            {hasDiscount && couponCode && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Tag className="h-3 w-3" /> Cupom {couponCode}
                  </span>
                  <span className="text-primary font-medium">
                    {couponDiscountType === 'percentage' ? `-${couponDiscountValue}%` : `-${formatCurrency(baseCents - finalCents)}`}
                  </span>
                </div>
              </>
            )}
            <div className="flex justify-between font-semibold text-base border-t pt-2">
              <span className="text-foreground">Total</span>
              <span className="text-primary">{formatCurrency(finalCents)}</span>
            </div>
          </>
        )}
        {isYearly && installments > 1 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Parcelas</span>
            <span className="text-foreground font-medium">
              {installments}x de {formatCurrency(Math.round(finalCents / installments))} sem juros
            </span>
          </div>
        )}
      </div>

      {/* Renewal info */}
      {isYearly && (
        <div className="border-t pt-4">
          <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
            <span>
              {isRenewal
                ? 'Sua assinatura atual será encerrada e um novo ciclo de 12 meses iniciará.'
                : installments === 1
                  ? 'Renovação automática a cada 12 meses.'
                  : 'Renovação manual após 12 meses. Você será notificado antes do vencimento.'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   PAGE
   ═══════════════════════════════════════════ */

export default function CreditsPayment() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthContext();
  const isMobile = useIsMobile();

  const { subscriptions: allSubs, isLoading: subsLoading } = useAsaasSubscription();

  const pkg = location.state as PaymentState | null;

  // Guard: redirect if user already has this subscription plan active
  useEffect(() => {
    if (subsLoading || !pkg || pkg.type !== 'subscription' || pkg.isUpgrade) return;
    if (isSubActiveForPlan(allSubs, pkg.planType)) {
      toast.error('Você já possui este plano ativo.');
      navigate('/credits/subscription', { replace: true });
    }
  }, [subsLoading, allSubs, pkg, navigate]);

  if (!pkg) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Nenhum pacote selecionado.</p>
          <Button variant="outline" onClick={() => navigate('/credits/checkout?tab=select')}>
            Voltar para pacotes
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="container max-w-5xl py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/credits/checkout?tab=${pkg?.type === 'subscription' ? 'transfer' : 'select'}`)} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
          <div className="h-4 w-px bg-border" />
          <span className="text-sm text-muted-foreground">Checkout</span>
        </div>
      </header>

      <main className="container max-w-5xl py-8">
        {pkg.type === 'select' ? (
          <SelectFlow pkg={pkg} />
        ) : (
          <SubscriptionWizard pkg={pkg} />
        )}
      </main>
    </div>
  );
}

/* ═══════════════════════════════════════════
   SELECT FLOW (PIX + Card toggle — simpler)
   ═══════════════════════════════════════════ */

function SelectFlow({ pkg }: { pkg: SelectPayment }) {
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'card'>('pix');
  const isMobile = useIsMobile();
  const formattedPrice = formatCurrency(pkg.priceCents);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8">
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Finalizar Compra</h1>
          <p className="text-sm text-muted-foreground">Escolha a forma de pagamento</p>
        </div>

        {/* Payment method toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => setPaymentMethod('pix')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 rounded-lg border p-3 text-sm font-medium transition-all',
              paymentMethod === 'pix'
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-border text-muted-foreground hover:text-foreground'
            )}
          >
            <Smartphone className="h-4 w-4" />
            PIX
          </button>
          <button
            onClick={() => setPaymentMethod('card')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 rounded-lg border p-3 text-sm font-medium transition-all',
              paymentMethod === 'card'
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-border text-muted-foreground hover:text-foreground'
            )}
          >
            <CreditCard className="h-4 w-4" />
            Cartão de Crédito
          </button>
        </div>

        {paymentMethod === 'pix' ? (
          <SelectPixForm pkg={pkg} formattedPrice={formattedPrice} />
        ) : (
          <SelectCardForm pkg={pkg} formattedPrice={formattedPrice} />
        )}
      </div>

      {/* Order summary */}
      <div className={cn(isMobile ? 'order-first' : 'order-last')}>
        <OrderSummary pkg={pkg} installments={1} couponDiscount={null} couponCode={null} couponDiscountType={null} couponDiscountValue={null} />
      </div>
    </div>
  );
}

/* ─── Select: PIX flow ─── */

function SelectPixForm({ pkg, formattedPrice }: { pkg: SelectPayment; formattedPrice: string }) {
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const { createPayment, checkPayment, isCreatingPayment } = useCreditPackages();

  const [email, setEmail] = useState(user?.email || '');
  const [pixData, setPixData] = useState<{
    qrCodeBase64: string;
    pixCopiaECola: string;
    expiration: string;
    purchaseId: string;
  } | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  const handlePixPayment = async () => {
    if (!email) { toast.error('Informe seu e-mail'); return; }
    try {
      const result = await createPayment({
        packageId: pkg.packageId,
        paymentMethod: 'pix',
        payerEmail: email,
      });
      if (result.pix) {
        setPixData({
          qrCodeBase64: result.pix.qr_code_base64,
          pixCopiaECola: result.pix.qr_code,
          expiration: result.pix.expiration,
          purchaseId: result.purchase_id,
        });
      }
    } catch (error) {
      console.error('Erro ao criar PIX:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao criar pagamento PIX');
    }
  };

  const handleCheckStatus = async () => {
    if (!pixData?.purchaseId) return { status: 'pending' };
    return await checkPayment(pixData.purchaseId);
  };

  const handlePixSuccess = () => {
    setPaymentSuccess(true);
    toast.success('Pagamento confirmado! Créditos adicionados.');
    setTimeout(() => navigate('/credits'), 2000);
  };

  if (paymentSuccess) {
    return (
      <div className="rounded-lg border p-8 text-center bg-card">
        <div className="text-4xl mb-3">🎉</div>
        <h3 className="text-lg font-semibold text-primary">Pagamento Confirmado!</h3>
        <p className="text-sm text-muted-foreground mt-1">
          {pkg.credits.toLocaleString('pt-BR')} créditos adicionados
        </p>
        <p className="text-xs text-muted-foreground mt-3">Redirecionando...</p>
      </div>
    );
  }

  if (pixData) {
    return (
      <div className="rounded-lg border p-6 bg-card space-y-4">
        <PixPaymentDisplay
          qrCodeBase64={pixData.qrCodeBase64}
          pixCopiaECola={pixData.pixCopiaECola}
          expiration={pixData.expiration}
          onCheckStatus={handleCheckStatus}
          onSuccess={handlePixSuccess}
        />
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-6 bg-card space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="email" className="text-sm">E-mail para recibo</Label>
        <Input
          id="email"
          type="email"
          placeholder="seu@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="p-4 bg-muted/50 rounded-lg text-center">
        <Smartphone className="h-6 w-6 mx-auto mb-2 text-primary" />
        <p className="text-sm text-muted-foreground">Pague instantaneamente com PIX</p>
      </div>
      <Button className="w-full" size="lg" onClick={handlePixPayment} disabled={isCreatingPayment || !email}>
        {isCreatingPayment ? (
          <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Gerando PIX...</>
        ) : (
          `Gerar PIX de ${formattedPrice}`
        )}
      </Button>
      <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1">
        <Lock className="h-3 w-3" />
        Pagamento seguro via Mercado Pago
      </p>
    </div>
  );
}

/* ─── Select: Card flow (Asaas) ─── */

function SelectCardForm({ pkg, formattedPrice }: { pkg: SelectPayment; formattedPrice: string }) {
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const { createCustomer, isCreatingCustomer, createPayment, isCreatingPayment } = useAsaasSubscription();

  return (
    <LegacyCardCheckoutForm
      onSubmit={async (cardData) => {
        await createCustomer({
          name: cardData.name,
          cpfCnpj: cardData.cpfCnpj,
          email: user?.email,
        });
        let remoteIp = '';
        try {
          const ipRes = await fetch('https://api.ipify.org?format=json');
          const ipData = await ipRes.json();
          remoteIp = ipData.ip || '';
        } catch { remoteIp = ''; }

        const result = await createPayment({
          productType: 'select',
          packageId: pkg.packageId,
          credits: pkg.credits,
          priceCents: pkg.priceCents,
          creditCard: {
            holderName: cardData.cardHolderName.toUpperCase(),
            number: cardData.cardNumber.replace(/\s/g, ''),
            expiryMonth: cardData.expiryMonth.padStart(2, '0'),
            expiryYear: cardData.expiryYear,
            ccv: cardData.ccv,
          },
          creditCardHolderInfo: {
            name: cardData.name,
            email: user?.email || '',
            cpfCnpj: cardData.cpfCnpj.replace(/\D/g, ''),
            postalCode: cardData.postalCode.replace(/\D/g, ''),
            addressNumber: 'S/N',
            phone: cardData.phone.replace(/\D/g, ''),
          },
          remoteIp,
        });

        if (result.status === 'CONFIRMED' || result.status === 'RECEIVED') {
          toast.success('Pagamento confirmado! Créditos adicionados.');
          setTimeout(() => navigate('/credits'), 2000);
          return { success: true };
        } else {
          throw new Error('Pagamento não foi aprovado. Verifique os dados do cartão.');
        }
      }}
      submitLabel={`Pagar ${formattedPrice}`}
      isProcessing={isCreatingCustomer || isCreatingPayment}
      providerLabel="Pagamento seguro via Asaas (PCI DSS)"
    />
  );
}

/* ═══════════════════════════════════════════
   SUBSCRIPTION WIZARD (3 steps)
   ═══════════════════════════════════════════ */

function SubscriptionWizard({ pkg }: { pkg: SubscriptionPayment }) {
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const isMobile = useIsMobile();
  const {
    createCustomer, isCreatingCustomer,
    createSubscription, isCreatingSubscription,
    createPayment, isCreatingPayment,
    upgradeSubscription, isUpgrading,
  } = useAsaasSubscription();

  const isYearly = pkg.billingCycle === 'YEARLY';
  const isUpgrade = !!pkg.isUpgrade;

  // Wizard steps
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  // Step 1: Personal data
  const [name, setName] = useState('');
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [phone, setPhone] = useState('');
  const [postalCode, setPostalCode] = useState('');

  // Step 2: Payment
  const [installments, setInstallments] = useState(1);
  const [cardNumber, setCardNumber] = useState('');
  const [cardHolderName, setCardHolderName] = useState('');
  const [expiryMonth, setExpiryMonth] = useState('');
  const [expiryYear, setExpiryYear] = useState('');
  const [ccv, setCcv] = useState('');

  // Step 3: Coupon
  const { coupon, isValidating: isValidatingCoupon, validateCoupon, clearCoupon } = useCouponValidation();
  const [couponInput, setCouponInput] = useState(pkg.couponCode || '');

  // If coupon came from checkout page, validate immediately
  useEffect(() => {
    if (pkg.couponCode && !coupon.valid) {
      validateCoupon(pkg.couponCode, pkg.planType);
    }
  }, []);

  // Processing states
  const [wizardState, setWizardState] = useState<'form' | 'processing' | 'success' | 'error'>('form');
  const [errorMessage, setErrorMessage] = useState('');

  const installmentBaseCents = isUpgrade && pkg.prorataValueCents != null
    ? pkg.prorataValueCents
    : pkg.priceCents;

  const couponDiscountedCents = coupon.valid ? coupon.calculateDiscount(installmentBaseCents) : null;
  const finalChargeCents = couponDiscountedCents ?? installmentBaseCents;

  const installmentOptions = isYearly
    ? Array.from({ length: 12 }, (_, i) => {
        const n = i + 1;
        const value = finalChargeCents / 100 / n;
        return {
          value: n,
          label: `${n}x de ${value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} sem juros`,
        };
      })
    : [];

  const isProcessing = isCreatingCustomer || isCreatingSubscription || isCreatingPayment || isUpgrading;

  // Validations
  const validateStep1 = (): boolean => {
    if (!name.trim()) { toast.error('Informe seu nome completo.'); return false; }
    const cleanCpf = cpfCnpj.replace(/\D/g, '');
    if (cleanCpf.length === 11) {
      if (!isValidCPF(cleanCpf)) { toast.error('CPF inválido. Verifique os dígitos.'); return false; }
    } else if (cleanCpf.length === 14) {
      if (!isValidCNPJ(cleanCpf)) { toast.error('CNPJ inválido. Verifique os dígitos.'); return false; }
    } else {
      toast.error('CPF (11 dígitos) ou CNPJ (14 dígitos) inválido.'); return false;
    }
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) { toast.error('Telefone inválido.'); return false; }
    const cleanCep = postalCode.replace(/\D/g, '');
    if (cleanCep.length !== 8) { toast.error('CEP inválido.'); return false; }
    return true;
  };

  const validateStep2 = (): boolean => {
    const cleanCard = cardNumber.replace(/\s/g, '');
    if (cleanCard.length < 13 || cleanCard.length > 19) { toast.error('Número do cartão inválido.'); return false; }
    if (!cardHolderName.trim()) { toast.error('Informe o nome no cartão.'); return false; }
    const month = parseInt(expiryMonth);
    if (isNaN(month) || month < 1 || month > 12) { toast.error('Mês de validade inválido.'); return false; }
    const year = parseInt(expiryYear);
    if (isNaN(year) || expiryYear.length !== 4 || year < new Date().getFullYear()) { toast.error('Ano de validade inválido.'); return false; }
    if (ccv.length < 3 || ccv.length > 4) { toast.error('CVV inválido.'); return false; }
    return true;
  };

  const goNext = () => {
    if (currentStep === 0) {
      if (!validateStep1()) return;
      setCompletedSteps(prev => [...prev.filter(s => s !== 0), 0]);
      setCurrentStep(1);
    } else if (currentStep === 1) {
      if (!validateStep2()) return;
      setCompletedSteps(prev => [...prev.filter(s => s !== 1), 1]);
      setCurrentStep(2);
    }
  };

  const goBack = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  const handleFinalSubmit = async () => {
    setWizardState('processing');
    setErrorMessage('');

    try {
      const cardData = {
        name: name.trim(),
        cpfCnpj,
        phone,
        postalCode,
        cardNumber,
        cardHolderName,
        expiryMonth,
        expiryYear,
        ccv,
      };

      // Create customer
      await createCustomer({
        name: cardData.name,
        cpfCnpj: cardData.cpfCnpj,
        email: user?.email,
      });

      let remoteIp = '';
      try {
        const ipRes = await fetch('https://api.ipify.org?format=json');
        const ipData = await ipRes.json();
        remoteIp = ipData.ip || '';
      } catch { remoteIp = ''; }

      const creditCardPayload = {
        holderName: cardData.cardHolderName.toUpperCase(),
        number: cardData.cardNumber.replace(/\s/g, ''),
        expiryMonth: cardData.expiryMonth.padStart(2, '0'),
        expiryYear: cardData.expiryYear,
        ccv: cardData.ccv,
      };
      const holderInfo = {
        name: cardData.name,
        email: user?.email || '',
        cpfCnpj: cardData.cpfCnpj.replace(/\D/g, ''),
        postalCode: cardData.postalCode.replace(/\D/g, ''),
        addressNumber: 'S/N',
        phone: cardData.phone.replace(/\D/g, ''),
      };

      if (isUpgrade && (pkg.currentSubscriptionId || pkg.subscriptionIdsToCancel?.length)) {
        const upgradeBody: any = {
          newPlanType: pkg.planType,
          billingCycle: pkg.billingCycle,
          creditCard: creditCardPayload,
          creditCardHolderInfo: holderInfo,
          remoteIp,
        };
        if (pkg.subscriptionIdsToCancel && pkg.subscriptionIdsToCancel.length > 0) {
          upgradeBody.subscriptionIdsToCancel = pkg.subscriptionIdsToCancel;
        } else if (pkg.currentSubscriptionId) {
          upgradeBody.currentSubscriptionId = pkg.currentSubscriptionId;
        }
        if (isYearly && installments > 1) {
          upgradeBody.installmentCount = installments;
        }
        if (coupon.valid) {
          upgradeBody.couponCode = coupon.code;
        }
        const result = await upgradeSubscription(upgradeBody);
        if (result.status === 'ACTIVE' || result.newSubscriptionId) {
          setWizardState('success');
          toast.success('Upgrade realizado com sucesso!');
          setTimeout(() => navigate('/credits'), 3000);
          return;
        } else {
          throw new Error('Upgrade não foi aprovado.');
        }
      } else if (isYearly && installments === 1) {
        const result = await createSubscription({
          planType: pkg.planType,
          billingCycle: 'YEARLY',
          creditCard: creditCardPayload,
          creditCardHolderInfo: holderInfo,
          remoteIp,
          ...(coupon.valid ? { couponCode: coupon.code } : {}),
        });
        if (result.status === 'ACTIVE' || result.subscriptionId) {
          setWizardState('success');
          toast.success('Assinatura anual ativada com sucesso!');
          setTimeout(() => navigate('/credits'), 3000);
          return;
        } else {
          throw new Error('Pagamento não foi aprovado.');
        }
      } else if (isYearly) {
        const result = await createPayment({
          productType: 'subscription_yearly',
          planType: pkg.planType,
          installmentCount: installments,
          creditCard: creditCardPayload,
          creditCardHolderInfo: holderInfo,
          remoteIp,
          ...(coupon.valid ? { couponCode: coupon.code } : {}),
        });
        if (result.status === 'ACTIVE' || result.paymentId) {
          setWizardState('success');
          toast.success('Plano ativado com sucesso!');
          setTimeout(() => navigate('/credits'), 3000);
          return;
        } else {
          throw new Error('Pagamento não foi aprovado.');
        }
      } else {
        const result = await createSubscription({
          planType: pkg.planType,
          billingCycle: 'MONTHLY',
          creditCard: creditCardPayload,
          creditCardHolderInfo: holderInfo,
          remoteIp,
          ...(coupon.valid ? { couponCode: coupon.code } : {}),
        });
        if (result.status === 'ACTIVE' || result.subscriptionId) {
          setWizardState('success');
          toast.success('Assinatura ativada com sucesso!');
          setTimeout(() => navigate('/credits'), 3000);
          return;
        } else {
          throw new Error('Pagamento não foi aprovado.');
        }
      }
    } catch (error) {
      console.error('Checkout error:', error);
      setWizardState('error');
      setErrorMessage(error instanceof Error ? error.message : 'Erro ao processar pagamento.');
    }
  };

  // Processing / Success / Error states
  if (wizardState === 'processing') {
    return (
      <div className="max-w-lg mx-auto rounded-xl border p-12 text-center bg-card space-y-4 shadow-sm">
        <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
        <p className="font-medium text-foreground">Processando pagamento...</p>
        <p className="text-sm text-muted-foreground">Não feche esta página.</p>
      </div>
    );
  }
  if (wizardState === 'success') {
    return (
      <div className="max-w-lg mx-auto rounded-xl border p-8 text-center bg-card space-y-3 shadow-sm">
        <div className="text-4xl">🎉</div>
        <h3 className="text-lg font-semibold text-primary">Pagamento Confirmado!</h3>
        <p className="text-xs text-muted-foreground">Redirecionando...</p>
      </div>
    );
  }
  if (wizardState === 'error') {
    return (
      <div className="max-w-lg mx-auto rounded-xl border p-8 text-center bg-card space-y-4 shadow-sm">
        <div className="text-5xl">❌</div>
        <h3 className="text-lg font-semibold text-destructive">Erro no pagamento</h3>
        <p className="text-sm text-muted-foreground">{errorMessage}</p>
        <div className="flex gap-2 justify-center">
          <Button variant="outline" onClick={() => { setWizardState('form'); setCurrentStep(1); }}>
            Revisar dados do cartão
          </Button>
          <Button variant="outline" onClick={() => navigate('/credits/checkout')}>Voltar</Button>
        </div>
      </div>
    );
  }

  const summaryComponent = (
    <OrderSummary
      pkg={pkg}
      installments={installments}
      couponDiscount={coupon.valid ? coupon.calculateDiscount(installmentBaseCents) : null}
      couponCode={coupon.valid ? coupon.code : null}
      couponDiscountType={coupon.valid ? coupon.discountType : null}
      couponDiscountValue={coupon.valid ? coupon.discountValue : null}
    />
  );

  return (
    <div>
      <StepIndicator currentStep={currentStep} completedSteps={completedSteps} />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8">
        {/* Left: Form area */}
        <div className="space-y-6">
          {/* STEP 1: Personal Data */}
          {currentStep === 0 && (
            <div className="rounded-xl border bg-card p-6 space-y-5 shadow-sm">
              <div className="flex items-center gap-2 text-base font-semibold text-foreground">
                <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold">1</div>
                Dados Pessoais
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="name">Nome completo</Label>
                <Input id="name" placeholder="Seu nome" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cpfCnpj">CPF ou CNPJ</Label>
                <Input id="cpfCnpj" placeholder="000.000.000-00" value={cpfCnpj} onChange={(e) => setCpfCnpj(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>E-mail</Label>
                <Input value={user?.email || ''} disabled className="bg-muted/50" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input id="phone" placeholder="(00) 00000-0000" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="postalCode">CEP</Label>
                  <Input id="postalCode" placeholder="00000-000" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
                </div>
              </div>

              <Button className="w-full" size="lg" onClick={goNext}>
                Próximo: Pagamento
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}

          {/* STEP 2: Payment */}
          {currentStep === 1 && (
            <div className="space-y-5">
              {/* Installment selector for yearly */}
              {isYearly && installmentOptions.length > 0 && (
                <div className="rounded-xl border bg-card p-5 space-y-4 shadow-sm">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <CreditCard className="h-4 w-4 text-primary" />
                    Forma de Pagamento
                  </div>

                  <button
                    type="button"
                    onClick={() => setInstallments(1)}
                    className={cn(
                      'w-full flex items-center justify-between rounded-lg border-2 p-4 text-left transition-all',
                      installments === 1 ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/30'
                    )}
                  >
                    <div>
                      <p className="text-sm font-semibold text-foreground">À vista</p>
                      <p className="text-sm text-primary font-medium">{formatCurrency(finalChargeCents)}</p>
                    </div>
                    <Badge variant="secondary" className="text-[10px] shrink-0">Renovação automática</Badge>
                  </button>

                  <button
                    type="button"
                    onClick={() => { if (installments <= 1) setInstallments(2); }}
                    className={cn(
                      'w-full flex flex-col rounded-lg border-2 p-4 text-left transition-all',
                      installments > 1 ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/30'
                    )}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div>
                        <p className="text-sm font-semibold text-foreground">Parcelado</p>
                        <p className="text-sm text-primary font-medium">até 12x sem juros</p>
                      </div>
                      <Badge variant="outline" className="text-[10px] shrink-0">Renovação manual</Badge>
                    </div>
                  </button>

                  {installments > 1 && (
                    <div className="pl-1 space-y-2">
                      <Label className="text-xs text-muted-foreground">Número de parcelas</Label>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        value={installments}
                        onChange={(e) => setInstallments(Number(e.target.value))}
                      >
                        {installmentOptions.filter(opt => opt.value >= 2).map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
                    <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
                    <span>
                      {installments === 1
                        ? 'Sua assinatura será renovada automaticamente a cada 12 meses.'
                        : 'Este plano terá renovação manual. Você será notificado antes do vencimento para renovar.'}
                    </span>
                  </div>
                </div>
              )}

              {/* Card data */}
              <div className="rounded-xl border bg-card p-6 space-y-4 shadow-sm">
                <div className="flex items-center gap-2 text-base font-semibold text-foreground">
                  <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold">2</div>
                  Dados do Cartão
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="cardNumber">Número do cartão</Label>
                  <Input
                    id="cardNumber"
                    placeholder="0000 0000 0000 0000"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                    maxLength={19}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cardHolderName">Nome no cartão</Label>
                  <Input
                    id="cardHolderName"
                    placeholder="NOME COMO NO CARTÃO"
                    value={cardHolderName}
                    onChange={(e) => setCardHolderName(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="expiryMonth">Mês</Label>
                    <Input id="expiryMonth" placeholder="MM" maxLength={2} value={expiryMonth} onChange={(e) => setExpiryMonth(e.target.value.replace(/\D/g, ''))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="expiryYear">Ano</Label>
                    <Input id="expiryYear" placeholder="AAAA" maxLength={4} value={expiryYear} onChange={(e) => setExpiryYear(e.target.value.replace(/\D/g, ''))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ccv">CVV</Label>
                    <Input id="ccv" placeholder="000" maxLength={4} type="password" value={ccv} onChange={(e) => setCcv(e.target.value.replace(/\D/g, ''))} />
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={goBack}>
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Voltar
                </Button>
                <Button className="flex-1" size="lg" onClick={goNext}>
                  Próximo: Revisão
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3: Review + Coupon */}
          {currentStep === 2 && (
            <div className="space-y-5">
              {/* Review summary */}
              <div className="rounded-xl border bg-card p-6 space-y-5 shadow-sm">
                <div className="flex items-center gap-2 text-base font-semibold text-foreground">
                  <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold">3</div>
                  Revisão e Confirmação
                </div>

                {/* Personal data summary */}
                <div className="rounded-lg bg-muted/30 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Dados Pessoais</span>
                    <button onClick={() => setCurrentStep(0)} className="text-xs text-primary hover:underline">Editar</button>
                  </div>
                  <p className="text-sm text-foreground">{name}</p>
                  <p className="text-sm text-muted-foreground">{cpfCnpj} • {phone}</p>
                  <p className="text-sm text-muted-foreground">{user?.email} • CEP {postalCode}</p>
                </div>

                {/* Card summary */}
                <div className="rounded-lg bg-muted/30 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Pagamento</span>
                    <button onClick={() => setCurrentStep(1)} className="text-xs text-primary hover:underline">Editar</button>
                  </div>
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm text-foreground">
                      •••• {cardNumber.replace(/\s/g, '').slice(-4)}
                    </p>
                  </div>
                  {isYearly && (
                    <p className="text-sm text-muted-foreground">
                      {installments === 1 ? 'À vista (renovação automática)' : `${installments}x sem juros (renovação manual)`}
                    </p>
                  )}
                </div>

                {/* Coupon */}
                <div className="border-t pt-4 space-y-3">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Cupom de Desconto</span>
                  {coupon.valid ? (
                    <div className="flex items-center gap-2">
                      <div className="inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2">
                        <Tag className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium text-primary">{coupon.code}</span>
                        <span className="text-xs text-muted-foreground">
                          ({coupon.discountType === 'percentage' ? `${coupon.discountValue}% off` : `${formatCurrency(coupon.discountValue)} off`})
                        </span>
                        <button
                          onClick={() => { clearCoupon(); setCouponInput(''); }}
                          className="ml-1 text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="Cupom de desconto"
                        value={couponInput}
                        onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                        onKeyDown={(e) => e.key === 'Enter' && validateCoupon(couponInput, pkg.planType)}
                        className="h-9 text-sm max-w-xs"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => validateCoupon(couponInput, pkg.planType)}
                        disabled={isValidatingCoupon || !couponInput.trim()}
                        className="gap-1.5 shrink-0"
                      >
                        {isValidatingCoupon ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Tag className="h-3.5 w-3.5" />}
                        Aplicar
                      </Button>
                      {coupon.error && <p className="text-xs text-destructive">{coupon.error}</p>}
                    </div>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3">
                <Button variant="outline" onClick={goBack}>
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Voltar
                </Button>
                <Button className="flex-1" size="lg" onClick={handleFinalSubmit} disabled={isProcessing}>
                  {isProcessing ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processando...</>
                  ) : (
                    <>
                      <Lock className="h-4 w-4 mr-2" />
                      {isUpgrade
                        ? `Confirmar upgrade ${formatCurrency(finalChargeCents)}`
                        : isYearly && installments > 1
                          ? `Assinar ${installments}x de ${formatCurrency(Math.round(finalChargeCents / installments))}`
                          : `Confirmar ${formatCurrency(finalChargeCents)}`}
                    </>
                  )}
                </Button>
              </div>

              <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1">
                <Lock className="h-3 w-3" />
                Pagamento seguro via Asaas (PCI DSS)
              </p>
            </div>
          )}
        </div>

        {/* Right: Order summary (desktop) / bottom (mobile) */}
        <div className={cn(isMobile ? 'order-first' : 'order-last')}>
          {summaryComponent}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   LEGACY CARD CHECKOUT FORM (used for select card only)
   ═══════════════════════════════════════════ */

interface CardData {
  name: string;
  cpfCnpj: string;
  phone: string;
  postalCode: string;
  cardNumber: string;
  cardHolderName: string;
  expiryMonth: string;
  expiryYear: string;
  ccv: string;
}

interface LegacyCardCheckoutFormProps {
  onSubmit: (data: CardData) => Promise<{ success: boolean }>;
  submitLabel: string;
  isProcessing: boolean;
  providerLabel: string;
}

function LegacyCardCheckoutForm({ onSubmit, submitLabel, isProcessing, providerLabel }: LegacyCardCheckoutFormProps) {
  const { user } = useAuthContext();
  const [step, setStep] = useState<'personal' | 'card' | 'processing' | 'success' | 'error'>('personal');
  const [errorMessage, setErrorMessage] = useState('');
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [phone, setPhone] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardHolderName, setCardHolderName] = useState('');
  const [expiryMonth, setExpiryMonth] = useState('');
  const [expiryYear, setExpiryYear] = useState('');
  const [ccv, setCcv] = useState('');

  const validatePersonalData = (): boolean => {
    if (!name.trim()) { toast.error('Informe seu nome completo.'); return false; }
    const cleanCpf = cpfCnpj.replace(/\D/g, '');
    if (cleanCpf.length === 11) {
      if (!isValidCPF(cleanCpf)) { toast.error('CPF inválido.'); return false; }
    } else if (cleanCpf.length === 14) {
      if (!isValidCNPJ(cleanCpf)) { toast.error('CNPJ inválido.'); return false; }
    } else {
      toast.error('CPF ou CNPJ inválido.'); return false;
    }
    if (phone.replace(/\D/g, '').length < 10) { toast.error('Telefone inválido.'); return false; }
    if (postalCode.replace(/\D/g, '').length !== 8) { toast.error('CEP inválido.'); return false; }
    return true;
  };

  const validateCardData = (): boolean => {
    const cleanCard = cardNumber.replace(/\s/g, '');
    if (cleanCard.length < 13 || cleanCard.length > 19) { toast.error('Número do cartão inválido.'); return false; }
    if (!cardHolderName.trim()) { toast.error('Informe o nome no cartão.'); return false; }
    const month = parseInt(expiryMonth);
    if (isNaN(month) || month < 1 || month > 12) { toast.error('Mês inválido.'); return false; }
    const year = parseInt(expiryYear);
    if (isNaN(year) || expiryYear.length !== 4 || year < new Date().getFullYear()) { toast.error('Ano inválido.'); return false; }
    if (ccv.length < 3 || ccv.length > 4) { toast.error('CVV inválido.'); return false; }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateCardData()) return;
    setStep('processing');
    setErrorMessage('');
    try {
      await onSubmit({ name: name.trim(), cpfCnpj, phone, postalCode, cardNumber, cardHolderName, expiryMonth, expiryYear, ccv });
      setStep('success');
    } catch (error) {
      setStep('error');
      setErrorMessage(error instanceof Error ? error.message : 'Erro ao processar pagamento.');
    }
  };

  if (step === 'processing') {
    return (
      <div className="rounded-lg border p-12 text-center bg-card space-y-4">
        <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
        <p className="font-medium text-foreground">Processando pagamento...</p>
        <p className="text-sm text-muted-foreground">Não feche esta página.</p>
      </div>
    );
  }
  if (step === 'success') {
    return (
      <div className="rounded-lg border p-8 text-center bg-card space-y-3">
        <div className="text-4xl">🎉</div>
        <h3 className="text-lg font-semibold text-primary">Pagamento Confirmado!</h3>
        <p className="text-xs text-muted-foreground">Redirecionando...</p>
      </div>
    );
  }
  if (step === 'error') {
    return (
      <div className="rounded-lg border p-8 text-center bg-card space-y-4">
        <div className="text-5xl">❌</div>
        <h3 className="text-lg font-semibold text-destructive">Erro no pagamento</h3>
        <p className="text-sm text-muted-foreground">{errorMessage}</p>
        <div className="flex gap-2 justify-center">
          <Button variant="outline" onClick={() => setStep('card')}>Tentar novamente</Button>
          <Button variant="outline" onClick={() => navigate('/credits/checkout')}>Voltar</Button>
        </div>
      </div>
    );
  }
  if (step === 'card') {
    return (
      <div className="rounded-lg border p-6 bg-card space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <CreditCard className="h-4 w-4 text-primary" />
          Dados do Cartão
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cardNumber">Número do cartão</Label>
          <Input id="cardNumber" placeholder="0000 0000 0000 0000" value={cardNumber} onChange={(e) => setCardNumber(formatCardNumber(e.target.value))} maxLength={19} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cardHolderName">Nome no cartão</Label>
          <Input id="cardHolderName" placeholder="NOME COMO NO CARTÃO" value={cardHolderName} onChange={(e) => setCardHolderName(e.target.value)} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="expiryMonth">Mês</Label>
            <Input id="expiryMonth" placeholder="MM" maxLength={2} value={expiryMonth} onChange={(e) => setExpiryMonth(e.target.value.replace(/\D/g, ''))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="expiryYear">Ano</Label>
            <Input id="expiryYear" placeholder="AAAA" maxLength={4} value={expiryYear} onChange={(e) => setExpiryYear(e.target.value.replace(/\D/g, ''))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ccv">CVV</Label>
            <Input id="ccv" placeholder="000" maxLength={4} type="password" value={ccv} onChange={(e) => setCcv(e.target.value.replace(/\D/g, ''))} />
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          <Button variant="outline" onClick={() => setStep('personal')}><ArrowLeft className="h-4 w-4 mr-1" />Voltar</Button>
          <Button className="flex-1" size="lg" onClick={handleSubmit} disabled={isProcessing}>
            {isProcessing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processando...</> : submitLabel}
          </Button>
        </div>
        <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1">
          <Lock className="h-3 w-3" />{providerLabel}
        </p>
      </div>
    );
  }

  // step === 'personal'
  return (
    <div className="rounded-lg border p-6 bg-card space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="name">Nome completo</Label>
        <Input id="name" placeholder="Seu nome" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cpfCnpj">CPF ou CNPJ</Label>
        <Input id="cpfCnpj" placeholder="000.000.000-00" value={cpfCnpj} onChange={(e) => setCpfCnpj(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label>E-mail</Label>
        <Input value={user?.email || ''} disabled />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="phone">Telefone</Label>
        <Input id="phone" placeholder="(00) 00000-0000" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="postalCode">CEP</Label>
        <Input id="postalCode" placeholder="00000-000" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
      </div>
      <Button className="w-full" size="lg" onClick={() => { if (validatePersonalData()) setStep('card'); }}>
        Próximo: Dados do cartão
      </Button>
    </div>
  );
}
