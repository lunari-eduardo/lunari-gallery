import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  CreditCard, 
  ExternalLink, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Banknote,
  RefreshCw,
  Loader2
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
  sessionId?: string;
  cobrancaId?: string;
  onStatusUpdated?: () => void;
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
  sessionId,
  cobrancaId,
  onStatusUpdated,
}: PaymentStatusCardProps) {
  const [isChecking, setIsChecking] = useState(false);
  const statusKey = status || 'sem_vendas';
  const config = statusConfig[statusKey] || statusConfig.sem_vendas;
  const StatusIcon = config.icon;
  const valorPendente = Math.max(0, valor - valorPago);

  const handleCheckPaymentStatus = async (forceUpdate = false) => {
    if (!sessionId && !cobrancaId) {
      toast.error('Não foi possível verificar o status');
      return;
    }
    
    setIsChecking(true);
    try {
      const response = await supabase.functions.invoke('check-payment-status', {
        body: { 
          sessionId, 
          cobrancaId,
          forceUpdate 
        },
      });
      
      if (response.error) {
        throw new Error(response.error.message);
      }
      
      const data = response.data;
      
      if (data.status === 'pago') {
        toast.success('Pagamento confirmado!', {
          description: data.updated 
            ? 'Status atualizado com sucesso.' 
            : 'O pagamento já estava registrado.',
        });
        onStatusUpdated?.();
      } else if (data.status === 'pendente') {
        toast.info('Pagamento ainda pendente', {
          description: 'O sistema ainda não recebeu a confirmação do pagamento.',
        });
      } else {
        toast.info(`Status atual: ${data.status}`);
      }
    } catch (error) {
      console.error('Erro ao verificar status:', error);
      toast.error('Erro ao verificar status do pagamento');
    } finally {
      setIsChecking(false);
    }
  };

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

          {/* Botão de verificação manual para pagamentos pendentes InfinitePay */}
          {statusKey === 'pendente' && provedor === 'infinitepay' && (sessionId || cobrancaId) && (
            <div className="flex gap-2 mt-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => handleCheckPaymentStatus(false)}
                disabled={isChecking}
              >
                {isChecking ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Verificar Status
              </Button>
              <Button
                variant="default"
                size="sm"
                className="flex-1"
                onClick={() => handleCheckPaymentStatus(true)}
                disabled={isChecking}
              >
                {isChecking ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                )}
                Confirmar Pago
              </Button>
            </div>
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
