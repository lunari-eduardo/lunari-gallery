import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, CreditCard, CheckCircle2, ArrowLeft, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { useAsaasSubscription } from '@/hooks/useAsaasSubscription';
import { useAuthContext } from '@/contexts/AuthContext';

interface AsaasCheckoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planType: string;
  planName: string;
  billingCycle: 'MONTHLY' | 'YEARLY';
  priceCents: number;
}

type Step = 'personal' | 'card' | 'processing' | 'success' | 'error';

export function AsaasCheckoutModal({
  open,
  onOpenChange,
  planType,
  planName,
  billingCycle,
  priceCents,
}: AsaasCheckoutModalProps) {
  const { user } = useAuthContext();
  const {
    createCustomer,
    isCreatingCustomer,
    createSubscription,
    isCreatingSubscription,
  } = useAsaasSubscription();

  const [step, setStep] = useState<Step>('personal');
  const [errorMessage, setErrorMessage] = useState('');

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

  const formattedPrice = (priceCents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

  const isProcessing = isCreatingCustomer || isCreatingSubscription;

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

  const handleGoToCard = () => {
    if (validatePersonalData()) setStep('card');
  };

  const handleSubmit = async () => {
    if (!validateCardData()) return;

    setStep('processing');
    setErrorMessage('');

    try {
      // Step 1: Create or get customer
      await createCustomer({
        name: name.trim(),
        cpfCnpj: cpfCnpj.replace(/\D/g, ''),
        email: user?.email,
      });

      // Step 2: Get client IP
      let remoteIp = '';
      try {
        const ipRes = await fetch('https://api.ipify.org?format=json');
        const ipData = await ipRes.json();
        remoteIp = ipData.ip || '';
      } catch { remoteIp = ''; }

      // Step 3: Create subscription with card data
      const result = await createSubscription({
        planType,
        billingCycle,
        creditCard: {
          holderName: cardHolderName.trim().toUpperCase(),
          number: cardNumber.replace(/\s/g, ''),
          expiryMonth: expiryMonth.padStart(2, '0'),
          expiryYear,
          ccv,
        },
        creditCardHolderInfo: {
          name: name.trim(),
          email: user?.email || '',
          cpfCnpj: cpfCnpj.replace(/\D/g, ''),
          postalCode: postalCode.replace(/\D/g, ''),
          addressNumber: addressNumber || 'S/N',
          phone: phone.replace(/\D/g, ''),
        },
        remoteIp,
      });

      if (result.status === 'ACTIVE' || result.subscriptionId) {
        setStep('success');
        toast.success('Assinatura ativada com sucesso!');
      } else {
        setStep('error');
        setErrorMessage('Pagamento não foi aprovado. Verifique os dados do cartão.');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      setStep('error');
      setErrorMessage(error instanceof Error ? error.message : 'Erro ao processar pagamento.');
    }
  };

  const handleClose = () => {
    if (step !== 'processing') {
      setStep('personal');
      setErrorMessage('');
      setCardNumber('');
      setCcv('');
      onOpenChange(false);
    }
  };

  const formatCardNumber = (value: string) => {
    const clean = value.replace(/\D/g, '').slice(0, 16);
    return clean.replace(/(\d{4})(?=\d)/g, '$1 ');
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Assinar {planName}
          </DialogTitle>
          <DialogDescription>
            {formattedPrice}/{billingCycle === 'MONTHLY' ? 'mês' : 'ano'} • Cartão de crédito
          </DialogDescription>
        </DialogHeader>

        {step === 'personal' && (
          <div className="space-y-3">
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
            <Button className="w-full gap-2" size="lg" onClick={handleGoToCard}>
              Próximo: Dados do cartão
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {step === 'card' && (
          <div className="space-y-3">
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

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="gap-2" onClick={() => setStep('personal')}>
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </Button>
              <Button className="flex-1 gap-2" size="lg" onClick={handleSubmit}>
                <CreditCard className="h-4 w-4" />
                Assinar {formattedPrice}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Pagamento processado de forma segura via Asaas (PCI DSS).
            </p>
          </div>
        )}

        {step === 'processing' && (
          <div className="py-12 text-center space-y-4">
            <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
            <p className="text-foreground font-medium">Processando pagamento...</p>
            <p className="text-sm text-muted-foreground">Não feche esta janela.</p>
          </div>
        )}

        {step === 'success' && (
          <div className="py-8 text-center space-y-4">
            <CheckCircle2 className="h-12 w-12 mx-auto text-green-500" />
            <h3 className="text-xl font-semibold text-green-600">Assinatura Ativada!</h3>
            <p className="text-muted-foreground">
              Seu plano <strong>{planName}</strong> está ativo.
            </p>
            <Button className="w-full" onClick={handleClose}>
              Fechar
            </Button>
          </div>
        )}

        {step === 'error' && (
          <div className="py-8 text-center space-y-4">
            <div className="text-5xl">❌</div>
            <h3 className="text-lg font-semibold text-destructive">Erro no pagamento</h3>
            <p className="text-sm text-muted-foreground">{errorMessage}</p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep('card')}>
                Tentar novamente
              </Button>
              <Button variant="outline" className="flex-1" onClick={handleClose}>
                Fechar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
