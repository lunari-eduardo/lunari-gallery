import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Copy, Check, Clock, RefreshCw, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface PixPaymentDisplayProps {
  qrCodeBase64: string;
  pixCopiaECola: string;
  expiration: string;
  onCheckStatus: () => Promise<{ status: string }>;
  onSuccess: () => void;
}

export function PixPaymentDisplay({
  qrCodeBase64,
  pixCopiaECola,
  expiration,
  onCheckStatus,
  onSuccess,
}: PixPaymentDisplayProps) {
  const [copied, setCopied] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [status, setStatus] = useState<'pending' | 'approved' | 'expired'>('pending');
  const [timeLeft, setTimeLeft] = useState('');

  // Calcular tempo restante
  useEffect(() => {
    const updateTimeLeft = () => {
      const now = new Date();
      const exp = new Date(expiration);
      const diff = exp.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeLeft('Expirado');
        setStatus('expired');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m`);
      } else if (minutes > 0) {
        setTimeLeft(`${minutes}m ${seconds}s`);
      } else {
        setTimeLeft(`${seconds}s`);
      }
    };

    updateTimeLeft();
    const interval = setInterval(updateTimeLeft, 1000);
    return () => clearInterval(interval);
  }, [expiration]);

  // Polling automático
  useEffect(() => {
    if (status !== 'pending') return;

    const pollInterval = setInterval(async () => {
      try {
        const result = await onCheckStatus();
        if (result.status === 'approved') {
          setStatus('approved');
          clearInterval(pollInterval);
          onSuccess();
        }
      } catch (error) {
        console.error('Erro ao verificar status:', error);
      }
    }, 5000); // A cada 5 segundos

    // Parar após 5 minutos
    const timeout = setTimeout(() => {
      clearInterval(pollInterval);
    }, 5 * 60 * 1000);

    return () => {
      clearInterval(pollInterval);
      clearTimeout(timeout);
    };
  }, [status, onCheckStatus, onSuccess]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(pixCopiaECola);
      setCopied(true);
      toast.success('Código PIX copiado!');
      setTimeout(() => setCopied(false), 3000);
    } catch (error) {
      toast.error('Erro ao copiar código');
    }
  };

  const handleManualCheck = async () => {
    setIsChecking(true);
    try {
      const result = await onCheckStatus();
      if (result.status === 'approved') {
        setStatus('approved');
        onSuccess();
      } else {
        toast.info('Pagamento ainda não confirmado');
      }
    } catch (error) {
      toast.error('Erro ao verificar pagamento');
    } finally {
      setIsChecking(false);
    }
  };

  if (status === 'approved') {
    return (
      <Card className="border-green-500 bg-green-50 dark:bg-green-950/20">
        <CardContent className="pt-6 text-center space-y-4">
          <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
          <div>
            <h3 className="text-xl font-semibold text-green-700 dark:text-green-400">
              Pagamento Confirmado!
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Seus créditos foram adicionados à conta
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (status === 'expired') {
    return (
      <Card className="border-destructive bg-destructive/5">
        <CardContent className="pt-6 text-center space-y-4">
          <Clock className="h-16 w-16 text-destructive mx-auto" />
          <div>
            <h3 className="text-xl font-semibold text-destructive">
              PIX Expirado
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              O tempo para pagamento expirou. Por favor, inicie uma nova compra.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center space-y-2">
        <Badge variant="outline" className="gap-1">
          <Clock className="h-3 w-3" />
          Expira em: {timeLeft}
        </Badge>
      </div>

      {/* QR Code */}
      <div className="flex justify-center">
        <div className="p-4 bg-white rounded-lg shadow-sm border">
          <img
            src={`data:image/png;base64,${qrCodeBase64}`}
            alt="QR Code PIX"
            className="w-48 h-48"
          />
        </div>
      </div>

      {/* Código Copia e Cola */}
      <div className="space-y-2">
        <p className="text-sm text-center text-muted-foreground">
          Ou copie o código PIX:
        </p>
        <div className="flex gap-2">
          <div className="flex-1 p-2 bg-muted rounded-md text-xs font-mono break-all max-h-20 overflow-y-auto">
            {pixCopiaECola}
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={handleCopy}
            className="shrink-0"
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Instruções */}
      <div className="text-center text-sm text-muted-foreground space-y-1">
        <p>1. Abra o app do seu banco</p>
        <p>2. Escaneie o QR Code ou cole o código</p>
        <p>3. Confirme o pagamento</p>
      </div>

      {/* Botão de verificação manual */}
      <Button
        variant="outline"
        className="w-full"
        onClick={handleManualCheck}
        disabled={isChecking}
      >
        {isChecking ? (
          <>
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            Verificando...
          </>
        ) : (
          <>
            <RefreshCw className="h-4 w-4 mr-2" />
            Já paguei, verificar status
          </>
        )}
      </Button>
    </div>
  );
}
