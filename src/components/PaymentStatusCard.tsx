import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  CreditCard, 
  ExternalLink, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Banknote
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface PaymentStatusCardProps {
  status: string | null;
  provedor?: string | null;
  valor?: number;
  valorPago?: number;
  dataPagamento?: Date | string | null;
  receiptUrl?: string | null;
  checkoutUrl?: string | null;
  variant?: 'compact' | 'full';
  showPendingAmount?: boolean;
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof CheckCircle2 }> = {
  sem_vendas: { label: 'Sem cobrança', variant: 'secondary', icon: Banknote },
  pendente: { label: 'Pendente', variant: 'outline', icon: Clock },
  aguardando_confirmacao: { label: 'Aguardando confirmação', variant: 'default', icon: AlertCircle },
  pago: { label: 'Pago', variant: 'default', icon: CheckCircle2 },
};

const provedorLabels: Record<string, string> = {
  infinitepay: 'InfinitePay',
  mercadopago: 'Mercado Pago',
  pix_manual: 'PIX Manual',
};

export function PaymentStatusCard({
  status,
  provedor,
  valor = 0,
  valorPago = 0,
  dataPagamento,
  receiptUrl,
  checkoutUrl,
  variant = 'compact',
  showPendingAmount = false,
}: PaymentStatusCardProps) {
  const statusKey = status || 'sem_vendas';
  const config = statusConfig[statusKey] || statusConfig.sem_vendas;
  const StatusIcon = config.icon;
  const valorPendente = Math.max(0, valor - valorPago);

  const getBadgeClasses = () => {
    switch (statusKey) {
      case 'pago':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'pendente':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'aguardando_confirmacao':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  if (variant === 'compact') {
    return (
      <div className="lunari-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-medium">Status do Pagamento</h3>
        </div>
        
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Status</span>
            <Badge className={getBadgeClasses()}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {config.label}
            </Badge>
          </div>

          {provedor && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Provedor</span>
              <span className="font-medium">{provedorLabels[provedor] || provedor}</span>
            </div>
          )}

          {valor > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Valor</span>
              <span className="font-medium">R$ {valor.toFixed(2)}</span>
            </div>
          )}

          {statusKey === 'pago' && dataPagamento && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Data</span>
              <span className="font-medium">
                {format(new Date(dataPagamento), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </span>
            </div>
          )}

          {receiptUrl && (
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-2"
              asChild
            >
              <a href={receiptUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Ver comprovante
              </a>
            </Button>
          )}

          {statusKey === 'pendente' && checkoutUrl && (
            <Button
              variant="terracotta"
              size="sm"
              className="w-full mt-2"
              asChild
            >
              <a href={checkoutUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Ir para pagamento
              </a>
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Full variant for Detalhes tab
  return (
    <div className="lunari-card p-5 space-y-4">
      <h3 className="font-medium">Informações de Pagamento</h3>
      
      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Status</span>
          <Badge className={getBadgeClasses()}>
            <StatusIcon className="h-3 w-3 mr-1" />
            {config.label}
          </Badge>
        </div>

        {provedor && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Provedor</span>
            <span className="font-medium">{provedorLabels[provedor] || provedor}</span>
          </div>
        )}

        {valor > 0 && (
          <>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Valor extras</span>
              <span className="font-medium">R$ {valor.toFixed(2)}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-muted-foreground">Valor pago</span>
              <span className={`font-medium ${valorPago > 0 ? 'text-green-600 dark:text-green-400' : ''}`}>
                R$ {valorPago.toFixed(2)}
              </span>
            </div>

            {showPendingAmount && valorPendente > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pendente</span>
                <span className="font-medium text-amber-600 dark:text-amber-400">
                  R$ {valorPendente.toFixed(2)}
                </span>
              </div>
            )}
          </>
        )}

        {statusKey === 'pago' && dataPagamento && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Data pagamento</span>
            <span className="font-medium">
              {format(new Date(dataPagamento), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </span>
          </div>
        )}

        {receiptUrl && (
          <div className="pt-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              asChild
            >
              <a href={receiptUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Ver comprovante
              </a>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
