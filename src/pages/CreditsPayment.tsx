import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthContext } from '@/contexts/AuthContext';
import { useCreditPackages } from '@/hooks/useCreditPackages';
import { useAsaasSubscription } from '@/hooks/useAsaasSubscription';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Loader2, Lock, Smartphone, CreditCard, Info } from 'lucide-react';
import { toast } from 'sonner';
import { PixPaymentDisplay } from '@/components/credits/PixPaymentDisplay';
import { cn } from '@/lib/utils';

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
}

type PaymentState = SelectPayment | SubscriptionPayment;

/* ─── Page ─── */

export default function CreditsPayment() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthContext();

  const pkg = location.state as PaymentState | null;

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

  const formattedPrice = (pkg.priceCents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="container max-w-5xl py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/credits/checkout?tab=${pkg?.type === 'subscription' ? 'transfer' : 'select'}`)} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
          <div className="h-4 w-px bg-border" />
          <span className="text-sm text-muted-foreground">Pagamento</span>
        </div>
      </header>

      <main className="container max-w-5xl py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8">
          {/* Left: Form */}
          <div className="space-y-6">
            <div>
              <h1 className="text-xl font-bold tracking-tight">Finalizar Compra</h1>
              <p className="text-sm text-muted-foreground">
                {pkg.type === 'select' ? 'Escolha a forma de pagamento' : 'Pagamento via Cartão de Crédito'}
              </p>
            </div>

            {pkg.type === 'select' ? (
              <SelectForm pkg={pkg} formattedPrice={formattedPrice} />
            ) : (
              <SubscriptionForm pkg={pkg} formattedPrice={formattedPrice} />
            )}
          </div>

          {/* Right: Order summary */}
          <div className="order-first lg:order-last">
            <OrderSummary pkg={pkg} formattedPrice={formattedPrice} />
          </div>
        </div>
      </main>
    </div>
  );
}

/* ═══════════════════════════════════════════
   ORDER SUMMARY
   ═══════════════════════════════════════════ */

function OrderSummary({ pkg, formattedPrice }: { pkg: PaymentState; formattedPrice: string }) {
  return (
    <div className="rounded-lg border bg-card p-6 space-y-4 lg:sticky lg:top-20">
      <h2 className="font-semibold text-foreground">Resumo do Pedido</h2>
      <div className="border-t pt-4 space-y-2">
        <p className="font-medium text-foreground">
          {pkg.type === 'select' ? pkg.packageName : pkg.planName}
        </p>
        <p className="text-sm text-muted-foreground">
          {pkg.type === 'select'
            ? `${pkg.credits.toLocaleString('pt-BR')} créditos`
            : `Assinatura ${pkg.billingCycle === 'MONTHLY' ? 'mensal' : 'anual'}`}
        </p>
      </div>
      <div className="border-t pt-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="text-foreground">{formattedPrice}</span>
        </div>
        <div className="flex justify-between font-semibold text-base">
          <span className="text-foreground">Total</span>
          <span className="text-primary">{formattedPrice}</span>
        </div>
      </div>

      {/* Annual renewal badge */}
      {pkg.type === 'subscription' && pkg.billingCycle === 'YEARLY' && (
        <div className="border-t pt-4">
          <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
            <span>Renovação manual após 12 meses. Você será notificado antes do vencimento.</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   SELECT FORM (PIX + Card toggle)
   ═══════════════════════════════════════════ */

function SelectForm({ pkg, formattedPrice }: { pkg: SelectPayment; formattedPrice: string }) {
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'card'>('pix');

  return (
    <div className="space-y-5">
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

      <Button
        className="w-full"
        size="lg"
        onClick={handlePixPayment}
        disabled={isCreatingPayment || !email}
      >
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
    <CardCheckoutForm
      onSubmit={async (cardData) => {
        // Create customer first
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
            addressNumber: cardData.addressNumber || 'S/N',
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
   SUBSCRIPTION FORM
   ═══════════════════════════════════════════ */

function SubscriptionForm({ pkg, formattedPrice }: { pkg: SubscriptionPayment; formattedPrice: string }) {
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const {
    createCustomer, isCreatingCustomer,
    createSubscription, isCreatingSubscription,
    createPayment, isCreatingPayment,
  } = useAsaasSubscription();

  const isYearly = pkg.billingCycle === 'YEARLY';
  const [installments, setInstallments] = useState(1);

  const installmentOptions = isYearly
    ? Array.from({ length: 12 }, (_, i) => {
        const n = i + 1;
        const value = (pkg.priceCents / 100 / n);
        return {
          value: n,
          label: `${n}x de ${value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} sem juros`,
        };
      })
    : [];

  return (
    <div className="space-y-5">
      {/* Installment selector for yearly */}
      {isYearly && installmentOptions.length > 0 && (
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <Label className="text-sm font-medium">Parcelas</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={installments}
            onChange={(e) => setInstallments(Number(e.target.value))}
          >
            {installmentOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <CardCheckoutForm
        onSubmit={async (cardData) => {
          // Create customer first
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

          if (isYearly) {
            // Yearly: one-time payment with installments
            const result = await createPayment({
              productType: 'subscription_yearly',
              planType: pkg.planType,
              installmentCount: installments,
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
                addressNumber: cardData.addressNumber || 'S/N',
                phone: cardData.phone.replace(/\D/g, ''),
              },
              remoteIp,
            });

            if (result.status === 'ACTIVE' || result.paymentId) {
              toast.success('Plano ativado com sucesso!');
              setTimeout(() => navigate('/credits'), 3000);
              return { success: true };
            } else {
              throw new Error('Pagamento não foi aprovado. Verifique os dados do cartão.');
            }
          } else {
            // Monthly: recurring subscription
            const result = await createSubscription({
              planType: pkg.planType,
              billingCycle: 'MONTHLY',
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
                addressNumber: cardData.addressNumber || 'S/N',
                phone: cardData.phone.replace(/\D/g, ''),
              },
              remoteIp,
            });

            if (result.status === 'ACTIVE' || result.subscriptionId) {
              toast.success('Assinatura ativada com sucesso!');
              setTimeout(() => navigate('/credits'), 3000);
              return { success: true };
            } else {
              throw new Error('Pagamento não foi aprovado. Verifique os dados do cartão.');
            }
          }
        }}
        submitLabel={
          isYearly && installments > 1
            ? `Assinar ${installments}x de ${((pkg.priceCents / 100) / installments).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
            : `Assinar ${formattedPrice}`
        }
        isProcessing={isCreatingCustomer || isCreatingSubscription || isCreatingPayment}
        providerLabel="Pagamento seguro via Asaas (PCI DSS)"
      />
    </div>
  );
}

/* ═══════════════════════════════════════════
   SHARED CARD CHECKOUT FORM
   ═══════════════════════════════════════════ */

interface CardData {
  name: string;
  cpfCnpj: string;
  phone: string;
  postalCode: string;
  addressNumber: string;
  cardNumber: string;
  cardHolderName: string;
  expiryMonth: string;
  expiryYear: string;
  ccv: string;
}

interface CardCheckoutFormProps {
  onSubmit: (data: CardData) => Promise<{ success: boolean }>;
  submitLabel: string;
  isProcessing: boolean;
  providerLabel: string;
}

function CardCheckoutForm({ onSubmit, submitLabel, isProcessing, providerLabel }: CardCheckoutFormProps) {
  const { user } = useAuthContext();
  const [step, setStep] = useState<'personal' | 'card' | 'processing' | 'success' | 'error'>('personal');
  const [errorMessage, setErrorMessage] = useState('');
  const navigate = useNavigate();

  // Personal data
  const [name, setName] = useState('');
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [phone, setPhone] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [addressNumber, setAddressNumber] = useState('');

  // Card data
  const [cardNumber, setCardNumber] = useState('');
  const [cardHolderName, setCardHolderName] = useState('');
  const [expiryMonth, setExpiryMonth] = useState('');
  const [expiryYear, setExpiryYear] = useState('');
  const [ccv, setCcv] = useState('');

  const formatCardNumber = (value: string) => {
    const clean = value.replace(/\D/g, '').slice(0, 16);
    return clean.replace(/(\d{4})(?=\d)/g, '$1 ');
  };

  const validatePersonalData = (): boolean => {
    if (!name.trim()) { toast.error('Informe seu nome completo.'); return false; }
    const cleanCpf = cpfCnpj.replace(/\D/g, '');
    if (cleanCpf.length !== 11 && cleanCpf.length !== 14) { toast.error('CPF ou CNPJ inválido.'); return false; }
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) { toast.error('Telefone inválido.'); return false; }
    const cleanCep = postalCode.replace(/\D/g, '');
    if (cleanCep.length !== 8) { toast.error('CEP inválido.'); return false; }
    return true;
  };

  const validateCardData = (): boolean => {
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

  const handleSubmit = async () => {
    if (!validateCardData()) return;
    setStep('processing');
    setErrorMessage('');

    try {
      await onSubmit({
        name: name.trim(),
        cpfCnpj,
        phone,
        postalCode,
        addressNumber,
        cardNumber,
        cardHolderName,
        expiryMonth,
        expiryYear,
        ccv,
      });
      setStep('success');
    } catch (error) {
      console.error('Checkout error:', error);
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

        <div className="flex gap-2 pt-2">
          <Button variant="outline" onClick={() => setStep('personal')}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Voltar
          </Button>
          <Button className="flex-1" size="lg" onClick={handleSubmit} disabled={isProcessing}>
            {isProcessing ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processando...</>
            ) : (
              submitLabel
            )}
          </Button>
        </div>

        <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1">
          <Lock className="h-3 w-3" />
          {providerLabel}
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
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="postalCode">CEP</Label>
          <Input id="postalCode" placeholder="00000-000" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="addressNumber">Nº endereço</Label>
          <Input id="addressNumber" placeholder="123" value={addressNumber} onChange={(e) => setAddressNumber(e.target.value)} />
        </div>
      </div>

      <Button className="w-full" size="lg" onClick={() => { if (validatePersonalData()) setStep('card'); }}>
        Próximo: Dados do cartão
      </Button>
    </div>
  );
}
