import { useEffect, useState } from 'react';
import { ExternalLink, CreditCard, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PaymentRedirectProps {
  checkoutUrl: string;
  provedor: 'infinitepay' | 'mercadopago' | string;
  valorTotal: number;
  onCancel?: () => void;
  themeStyles?: React.CSSProperties;
  backgroundMode?: 'light' | 'dark';
}

export function PaymentRedirect({ 
  checkoutUrl, 
  provedor, 
  valorTotal,
  onCancel,
  themeStyles = {},
  backgroundMode = 'light',
}: PaymentRedirectProps) {
  const [countdown, setCountdown] = useState(3);
  const [redirected, setRedirected] = useState(false);

  const provedorInfo = {
    infinitepay: {
      name: 'InfinitePay',
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-50 dark:bg-green-900/20',
    },
    mercadopago: {
      name: 'Mercado Pago',
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    },
  };

  const info = provedorInfo[provedor as keyof typeof provedorInfo] || {
    name: 'Pagamento',
    color: 'text-primary',
    bgColor: 'bg-primary/10',
  };

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (!redirected) {
      setRedirected(true);
      window.location.href = checkoutUrl;
    }
  }, [countdown, checkoutUrl, redirected]);

  const handleManualRedirect = () => {
    setRedirected(true);
    window.location.href = checkoutUrl;
  };

  return (
    <div 
      className={cn(
        "min-h-screen flex flex-col items-center justify-center bg-background text-foreground p-4",
        backgroundMode === 'dark' && 'dark'
      )}
      style={themeStyles}
    >
      <div className="max-w-md w-full text-center space-y-8">
        {/* Provider Logo/Icon */}
        <div className={cn(
          "w-20 h-20 mx-auto rounded-full flex items-center justify-center",
          info.bgColor
        )}>
          <CreditCard className={cn("h-10 w-10", info.color)} />
        </div>

        {/* Title */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">
            Redirecionando para {info.name}
          </h1>
          <p className="text-muted-foreground">
            Você será redirecionado em <span className="font-bold text-foreground">{countdown}</span> segundos
          </p>
        </div>

        {/* Value */}
        <div className="lunari-card p-6">
          <p className="text-sm text-muted-foreground mb-1">Valor do pagamento</p>
          <p className={cn("text-3xl font-bold", info.color)}>
            R$ {valorTotal.toFixed(2)}
          </p>
        </div>

        {/* Loading indicator */}
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Preparando checkout seguro...</span>
        </div>

        {/* Manual redirect button */}
        <div className="space-y-3">
          <Button
            onClick={handleManualRedirect}
            className="w-full gap-2"
            variant="terracotta"
            size="lg"
          >
            <ExternalLink className="h-4 w-4" />
            Ir para pagamento agora
          </Button>

          {onCancel && (
            <Button
              onClick={onCancel}
              variant="ghost"
              className="w-full"
            >
              Cancelar
            </Button>
          )}
        </div>

        {/* Security notice */}
        <p className="text-xs text-muted-foreground">
          Pagamento processado com segurança por {info.name}.
          <br />
          Seus dados estão protegidos.
        </p>
      </div>
    </div>
  );
}
