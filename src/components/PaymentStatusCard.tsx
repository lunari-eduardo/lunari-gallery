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
  Loader2,
  RotateCcw,
  Copy,
  HandCoins,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { usePaymentIntegration, getProviderLabel } from '@/hooks/usePaymentIntegration';

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
  galleryId?: string;
  extraCount?: number;
  descricao?: string;
  onStatusUpdated?: () => void;
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof CheckCircle2 }> = {
  sem_vendas: { label: 'Sem cobrança', variant: 'secondary', icon: Banknote },
  pendente: { label: 'Pendente', variant: 'outline', icon: Clock },
  aguardando_confirmacao: { label: 'Aguardando confirmação', variant: 'default', icon: AlertCircle },
  pago: { label: 'Pago', variant: 'default', icon: CheckCircle2 },
  pago_manual: { label: 'Pago manualmente', variant: 'default', icon: HandCoins },
};

const provedorLabels: Record<string, string> = {
  infinitepay: 'InfinitePay',
  mercadopago: 'Mercado Pago',
  pix_manual: 'PIX Manual',
  manual: 'Manual',
  asaas: 'Asaas',
};

const manualMethodLabels: Record<string, string> = {
  dinheiro: 'Dinheiro',
  pix_externo: 'PIX externo',
  cartao_externo: 'Cartão externo',
  outro: 'Outro',
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
  galleryId,
  extraCount,
  descricao,
  onStatusUpdated,
}: PaymentStatusCardProps) {
  const [showRebillModal, setShowRebillModal] = useState(false);
  const [isRebilling, setIsRebilling] = useState(false);
  const [newCheckoutUrl, setNewCheckoutUrl] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);

  // Manual receipt modal state
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [manualMethod, setManualMethod] = useState('dinheiro');
  const [manualValor, setManualValor] = useState('');
  const [manualObs, setManualObs] = useState('');
  
  const { data: paymentData } = usePaymentIntegration();
  
  const statusKey = status || 'sem_vendas';
  const config = statusConfig[statusKey] || statusConfig.sem_vendas;
  const StatusIcon = config.icon;
  const valorPendente = Math.max(0, valor - valorPago);

  // Open receipt modal with pre-filled value
  const openReceiptModal = () => {
    setManualValor(valor > 0 ? valor.toFixed(2) : '');
    setManualMethod('dinheiro');
    setManualObs('');
    setShowReceiptModal(true);
  };

  // Register manual receipt
  const handleRegisterReceipt = async () => {
    const parsedValor = parseFloat(manualValor.replace(',', '.'));
    if (isNaN(parsedValor) || parsedValor <= 0) {
      toast.error('Informe um valor válido');
      return;
    }

    setIsRegistering(true);
    try {
      // Force token refresh to avoid 401
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !refreshData?.session) {
        toast.error('Sessão expirada. Recarregue a página e tente novamente.');
        setIsRegistering(false);
        return;
      }

      const response = await supabase.functions.invoke('confirm-payment-manual', {
        body: {
          cobrancaId: cobrancaId || null,
          galleryId: galleryId || null,
          sessionId: sessionId || null,
          metodoManual: manualMethod,
          valorManual: parsedValor,
          observacao: manualObs || null,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const data = response.data;

      if (data.success) {
        toast.success('Recebimento registrado!', {
          description: data.alreadyPaid
            ? 'O pagamento já estava registrado.'
            : `R$ ${parsedValor.toFixed(2)} via ${manualMethodLabels[manualMethod] || manualMethod}`,
        });
        setShowReceiptModal(false);
        onStatusUpdated?.();
      } else {
        toast.error(data.error || 'Erro ao registrar recebimento');
      }
    } catch (error: any) {
      console.error('Erro ao registrar recebimento:', error);
      toast.error('Erro ao registrar recebimento', {
        description: error?.message || 'Tente novamente',
      });
    } finally {
      setIsRegistering(false);
    }
  };

  // Rebill: create new payment link via chosen gateway
  const handleRebill = async (provider: string) => {
    if (!galleryId || !valor) {
      toast.error('Dados insuficientes para gerar cobrança');
      return;
    }
    
    setIsRebilling(true);
    setSelectedProvider(provider);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData?.session) {
        toast.error('Sessão expirada. Recarregue a página e tente novamente.');
        setIsRebilling(false);
        return;
      }
      
      const response = await supabase.functions.invoke('gallery-create-payment', {
        body: {
          galleryId,
          valorTotal: valor,
          extraCount: extraCount || 0,
          descricao: descricao || undefined,
          provider,
        },
      });
      
      if (response.error) {
        throw new Error(response.error.message);
      }
      
      const data = response.data;
      
      if (data.success && (data.checkoutUrl || data.galleryUrl)) {
        const urlToShow = (provider === 'asaas' && data.galleryUrl) ? data.galleryUrl : data.checkoutUrl;
        setNewCheckoutUrl(urlToShow || data.checkoutUrl);
        toast.success('Link de cobrança gerado!');
        onStatusUpdated?.();
      } else {
        toast.error(data.error || 'Erro ao gerar cobrança');
      }
    } catch (error) {
      console.error('Erro ao gerar cobrança:', error);
      toast.error('Erro ao gerar nova cobrança');
    } finally {
      setIsRebilling(false);
    }
  };

  const copyToClipboard = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success('Link copiado!');
  };

  const getBadgeClasses = () => {
    switch (statusKey) {
      case 'pago':
      case 'pago_manual':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'pendente':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'aguardando_confirmacao':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const activeGateways = paymentData?.allActiveIntegrations?.filter(
    i => i.provedor !== 'pix_manual'
  ) || [];

  const isPaid = statusKey === 'pago' || statusKey === 'pago_manual';

  const renderActions = () => {
    if (isPaid) return null;
    if (statusKey !== 'pendente' && statusKey !== 'aguardando_confirmacao') return null;
    
    return (
      <div className="space-y-2 mt-2">
        {/* Cobrar novamente */}
        {galleryId && activeGateways.length > 0 && (
          <Button
            variant="terracotta"
            size="sm"
            className="w-full"
            onClick={() => {
              setNewCheckoutUrl(null);
              setShowRebillModal(true);
            }}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Cobrar novamente
          </Button>
        )}

        {/* Registrar recebimento */}
        <Button
          variant="default"
          size="sm"
          className="w-full"
          onClick={openReceiptModal}
        >
          <HandCoins className="h-4 w-4 mr-2" />
          Registrar recebimento
        </Button>
      </div>
    );
  };

  const renderReceiptModal = () => (
    <Dialog open={showReceiptModal} onOpenChange={setShowReceiptModal}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Registrar recebimento</DialogTitle>
          <DialogDescription>
            Registre um pagamento recebido fora do sistema (dinheiro, PIX externo, etc.)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Forma de pagamento</Label>
            <Select value={manualMethod} onValueChange={setManualMethod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dinheiro">Dinheiro</SelectItem>
                <SelectItem value="pix_externo">PIX externo</SelectItem>
                <SelectItem value="cartao_externo">Cartão externo</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Valor (R$)</Label>
            <Input
              type="text"
              inputMode="decimal"
              value={manualValor}
              onChange={(e) => setManualValor(e.target.value)}
              placeholder="0,00"
            />
          </div>

          <div className="space-y-2">
            <Label>Observação (opcional)</Label>
            <Textarea
              value={manualObs}
              onChange={(e) => setManualObs(e.target.value)}
              placeholder="Ex: Recebido em mãos no dia da entrega"
              rows={2}
            />
          </div>

          <Button
            className="w-full"
            onClick={handleRegisterReceipt}
            disabled={isRegistering}
          >
            {isRegistering ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4 mr-2" />
            )}
            Confirmar recebimento
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  const renderRebillModal = () => (
    <Dialog open={showRebillModal} onOpenChange={setShowRebillModal}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Cobrar novamente</DialogTitle>
          <DialogDescription>
            Selecione o gateway para gerar uma nova cobrança de R$ {valor.toFixed(2)}
          </DialogDescription>
        </DialogHeader>
        
        {newCheckoutUrl ? (
          <div className="space-y-4">
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
              <CheckCircle2 className="h-6 w-6 text-green-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-green-800 dark:text-green-400">Link gerado!</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => copyToClipboard(newCheckoutUrl)}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copiar link
              </Button>
              <Button
                size="sm"
                className="flex-1"
                asChild
              >
                <a href={newCheckoutUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Abrir
                </a>
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {activeGateways.map((gateway) => (
              <Button
                key={gateway.id}
                variant="outline"
                className="w-full justify-start"
                disabled={isRebilling}
                onClick={() => handleRebill(gateway.provedor)}
              >
                {isRebilling && selectedProvider === gateway.provedor ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CreditCard className="h-4 w-4 mr-2" />
                )}
                {getProviderLabel(gateway.provedor)}
              </Button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );

  if (variant === 'compact') {
    return (
      <>
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

            {isPaid && dataPagamento && (
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

            {renderActions()}
          </div>
        </div>
        {renderRebillModal()}
        {renderReceiptModal()}
      </>
    );
  }

  // Full variant
  return (
    <>
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

          {isPaid && dataPagamento && (
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

          {renderActions()}
        </div>
      </div>
      {renderRebillModal()}
      {renderReceiptModal()}
    </>
  );
}
