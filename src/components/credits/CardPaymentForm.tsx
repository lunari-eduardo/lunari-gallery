import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CreditCard, Lock, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

// Tipo global do SDK do Mercado Pago
declare global {
  interface Window {
    MercadoPago?: new (publicKey: string, options?: { locale: string }) => {
      createCardToken: (cardData: {
        cardNumber: string;
        cardholderName: string;
        cardExpirationMonth: string;
        cardExpirationYear: string;
        securityCode: string;
        identificationType: string;
        identificationNumber: string;
      }) => Promise<{ id: string } | { cause: Array<{ code: string; description: string }> }>;
    };
  }
}

interface CardPaymentFormProps {
  onSubmit: (cardToken: string) => Promise<void>;
  isProcessing: boolean;
  amount: number;
}

// Cache da public key
let cachedPublicKey: string | null = null;

async function fetchPublicKey(): Promise<string> {
  if (cachedPublicKey) return cachedPublicKey;
  
  try {
    const response = await fetch(
      'https://tlnjspsywycbudhewsfv.supabase.co/functions/v1/mercadopago-public-key'
    );
    const data = await response.json();
    cachedPublicKey = data.public_key || '';
    return cachedPublicKey;
  } catch (error) {
    console.error('Erro ao buscar public key:', error);
    return '';
  }
}

export function CardPaymentForm({ onSubmit, isProcessing, amount }: CardPaymentFormProps) {
  const [cardNumber, setCardNumber] = useState('');
  const [cardholderName, setCardholderName] = useState('');
  const [expirationMonth, setExpirationMonth] = useState('');
  const [expirationYear, setExpirationYear] = useState('');
  const [securityCode, setSecurityCode] = useState('');
  const [cpf, setCpf] = useState('');
  const [error, setError] = useState('');
  const [publicKey, setPublicKey] = useState<string | null>(null);

  // Buscar public key ao montar
  useEffect(() => {
    fetchPublicKey().then(setPublicKey);
  }, []);

  const formatCardNumber = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    return numbers.replace(/(\d{4})(?=\d)/g, '$1 ').slice(0, 19);
  };

  const formatCpf = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    return numbers
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2')
      .slice(0, 14);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validações básicas
    const cardNumberClean = cardNumber.replace(/\s/g, '');
    if (cardNumberClean.length < 13 || cardNumberClean.length > 19) {
      setError('Número do cartão inválido');
      return;
    }

    if (!cardholderName.trim()) {
      setError('Nome do titular é obrigatório');
      return;
    }

    const month = parseInt(expirationMonth);
    const year = parseInt(expirationYear);
    if (isNaN(month) || month < 1 || month > 12) {
      setError('Mês de validade inválido');
      return;
    }

    const currentYear = new Date().getFullYear() % 100;
    if (isNaN(year) || year < currentYear) {
      setError('Ano de validade inválido');
      return;
    }

    if (securityCode.length < 3 || securityCode.length > 4) {
      setError('CVV inválido');
      return;
    }

    const cpfClean = cpf.replace(/\D/g, '');
    if (cpfClean.length !== 11) {
      setError('CPF inválido');
      return;
    }

    // Verificar se SDK está carregado
    if (!window.MercadoPago) {
      setError('SDK de pagamento não carregado. Recarregue a página.');
      return;
    }

    try {
      if (!publicKey) {
        setError('Chave pública não configurada. Contate o suporte.');
        return;
      }

      const mp = new window.MercadoPago(publicKey, { locale: 'pt-BR' });

      const tokenResult = await mp.createCardToken({
        cardNumber: cardNumberClean,
        cardholderName: cardholderName.toUpperCase(),
        cardExpirationMonth: expirationMonth.padStart(2, '0'),
        cardExpirationYear: `20${expirationYear}`,
        securityCode: securityCode,
        identificationType: 'CPF',
        identificationNumber: cpfClean,
      });

      if ('cause' in tokenResult && tokenResult.cause?.length > 0) {
        const errorMsg = tokenResult.cause[0]?.description || 'Erro ao processar cartão';
        setError(errorMsg);
        return;
      }

      if ('id' in tokenResult) {
        await onSubmit(tokenResult.id);
      }
    } catch (err) {
      console.error('Erro ao tokenizar cartão:', err);
      setError('Erro ao processar cartão. Verifique os dados.');
    }
  };

  const formattedAmount = (amount / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/10 rounded-md">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="cardNumber">Número do Cartão</Label>
        <div className="relative">
          <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="cardNumber"
            placeholder="0000 0000 0000 0000"
            value={cardNumber}
            onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
            className="pl-10"
            maxLength={19}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="cardholderName">Nome no Cartão</Label>
        <Input
          id="cardholderName"
          placeholder="NOME COMO ESTÁ NO CARTÃO"
          value={cardholderName}
          onChange={(e) => setCardholderName(e.target.value.toUpperCase())}
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label htmlFor="expirationMonth">Mês</Label>
          <Input
            id="expirationMonth"
            placeholder="MM"
            value={expirationMonth}
            onChange={(e) => setExpirationMonth(e.target.value.replace(/\D/g, '').slice(0, 2))}
            maxLength={2}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="expirationYear">Ano</Label>
          <Input
            id="expirationYear"
            placeholder="AA"
            value={expirationYear}
            onChange={(e) => setExpirationYear(e.target.value.replace(/\D/g, '').slice(0, 2))}
            maxLength={2}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="securityCode">CVV</Label>
          <Input
            id="securityCode"
            placeholder="123"
            value={securityCode}
            onChange={(e) => setSecurityCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
            maxLength={4}
            type="password"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="cpf">CPF do Titular</Label>
        <Input
          id="cpf"
          placeholder="000.000.000-00"
          value={cpf}
          onChange={(e) => setCpf(formatCpf(e.target.value))}
          maxLength={14}
        />
      </div>

      <div className="pt-2">
        <Button 
          type="submit" 
          className="w-full" 
          size="lg"
          disabled={isProcessing}
        >
          {isProcessing ? (
            'Processando...'
          ) : (
            <>
              <Lock className="h-4 w-4 mr-2" />
              Pagar {formattedAmount}
            </>
          )}
        </Button>
      </div>

      <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1">
        <Lock className="h-3 w-3" />
        Pagamento seguro via Mercado Pago
      </p>
    </form>
  );
}
