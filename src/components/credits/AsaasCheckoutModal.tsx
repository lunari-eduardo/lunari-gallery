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
import { Loader2, ExternalLink } from 'lucide-react';
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

  const [step, setStep] = useState<'form' | 'redirect'>('form');
  const [name, setName] = useState('');
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null);

  const formattedPrice = (priceCents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

  const isProcessing = isCreatingCustomer || isCreatingSubscription;

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('Informe seu nome completo.');
      return;
    }
    const cleanCpf = cpfCnpj.replace(/\D/g, '');
    if (cleanCpf.length !== 11 && cleanCpf.length !== 14) {
      toast.error('CPF ou CNPJ inválido.');
      return;
    }

    try {
      // Step 1: Create or get customer
      await createCustomer({
        name: name.trim(),
        cpfCnpj: cleanCpf,
        email: user?.email,
      });

      // Step 2: Create subscription (UNDEFINED = generates invoiceUrl)
      const result = await createSubscription({
        planType,
        billingCycle,
        billingType: 'UNDEFINED',
      });

      if (result.invoiceUrl) {
        window.open(result.invoiceUrl, '_blank');
        setInvoiceUrl(result.invoiceUrl);
        setStep('redirect');
      } else {
        toast.success('Assinatura criada! Aguardando confirmação de pagamento.');
        onOpenChange(false);
      }
    } catch (error) {
      console.error('Checkout error:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao processar assinatura.');
    }
  };

  const handleClose = () => {
    setStep('form');
    setInvoiceUrl(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assinar {planName}</DialogTitle>
          <DialogDescription>
            {formattedPrice}/{billingCycle === 'MONTHLY' ? 'mês' : 'ano'}
          </DialogDescription>
        </DialogHeader>

        {step === 'form' ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome completo</Label>
              <Input
                id="name"
                placeholder="Seu nome"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cpfCnpj">CPF ou CNPJ</Label>
              <Input
                id="cpfCnpj"
                placeholder="000.000.000-00"
                value={cpfCnpj}
                onChange={(e) => setCpfCnpj(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input value={user?.email || ''} disabled />
            </div>

            <Button
              className="w-full"
              size="lg"
              onClick={handleSubmit}
              disabled={isProcessing || !name || !cpfCnpj}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (
                `Continuar para pagamento`
              )}
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              Você será redirecionado para a página de pagamento seguro do Asaas.
            </p>
          </div>
        ) : (
          <div className="space-y-6 py-4 text-center">
            <div className="text-4xl">🔗</div>
            <p className="text-foreground font-medium">
              Sua assinatura foi criada! Clique abaixo para concluir o pagamento.
            </p>
            <Button
              className="w-full gap-2"
              size="lg"
              onClick={() => {
                if (invoiceUrl) window.open(invoiceUrl, '_blank');
              }}
            >
              <ExternalLink className="h-4 w-4" />
              Ir para pagamento
            </Button>
            <p className="text-xs text-muted-foreground">
              Após o pagamento, seu plano será ativado automaticamente.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
