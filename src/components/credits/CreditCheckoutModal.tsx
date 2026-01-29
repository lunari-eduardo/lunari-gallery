import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Smartphone, CreditCard, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { CreditPackage, useCreditPackages } from '@/hooks/useCreditPackages';
import { PixPaymentDisplay } from './PixPaymentDisplay';
import { CardPaymentForm } from './CardPaymentForm';
import { useAuthContext } from '@/contexts/AuthContext';

interface CreditCheckoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  package_: CreditPackage | null;
  onSuccess: () => void;
}

export function CreditCheckoutModal({
  open,
  onOpenChange,
  package_,
  onSuccess,
}: CreditCheckoutModalProps) {
  const { user } = useAuthContext();
  const { createPayment, checkPayment, isCreatingPayment } = useCreditPackages();
  
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'credit_card'>('pix');
  const [email, setEmail] = useState(user?.email || '');
  const [pixData, setPixData] = useState<{
    qrCodeBase64: string;
    pixCopiaECola: string;
    expiration: string;
    purchaseId: string;
  } | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  if (!package_) return null;

  const formattedPrice = (package_.price_cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

  const handlePixPayment = async () => {
    if (!email) {
      toast.error('Informe seu e-mail');
      return;
    }

    try {
      const result = await createPayment({
        packageId: package_.id,
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

  const handleCardPayment = async (cardToken: string) => {
    if (!email) {
      toast.error('Informe seu e-mail');
      return;
    }

    try {
      const result = await createPayment({
        packageId: package_.id,
        paymentMethod: 'credit_card',
        cardToken,
        payerEmail: email,
      });

      if (result.status === 'approved') {
        setPaymentSuccess(true);
        toast.success('Pagamento aprovado! Créditos adicionados.');
        setTimeout(() => {
          onSuccess();
          onOpenChange(false);
        }, 2000);
      } else {
        toast.error(`Pagamento ${result.status_detail || 'não aprovado'}`);
      }
    } catch (error) {
      console.error('Erro ao processar cartão:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao processar pagamento');
    }
  };

  const handleCheckStatus = async () => {
    if (!pixData?.purchaseId) {
      return { status: 'pending' };
    }
    
    const result = await checkPayment(pixData.purchaseId);
    return result;
  };

  const handlePixSuccess = () => {
    setPaymentSuccess(true);
    toast.success('Pagamento confirmado! Créditos adicionados.');
    setTimeout(() => {
      onSuccess();
      onOpenChange(false);
    }, 2000);
  };

  const handleClose = () => {
    // Reset state when closing
    setPixData(null);
    setPaymentSuccess(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Comprar Créditos</DialogTitle>
          <DialogDescription>
            {package_.credits.toLocaleString('pt-BR')} créditos por {formattedPrice}
          </DialogDescription>
        </DialogHeader>

        {paymentSuccess ? (
          <div className="py-8 text-center">
            <div className="text-5xl mb-4">🎉</div>
            <h3 className="text-xl font-semibold text-green-600">Pagamento Confirmado!</h3>
            <p className="text-muted-foreground mt-2">
              {package_.credits.toLocaleString('pt-BR')} créditos foram adicionados à sua conta
            </p>
          </div>
        ) : pixData ? (
          <PixPaymentDisplay
            qrCodeBase64={pixData.qrCodeBase64}
            pixCopiaECola={pixData.pixCopiaECola}
            expiration={pixData.expiration}
            onCheckStatus={handleCheckStatus}
            onSuccess={handlePixSuccess}
          />
        ) : (
          <div className="space-y-4">
            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">E-mail para recibo</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            {/* Tabs de método de pagamento */}
            <Tabs 
              value={paymentMethod} 
              onValueChange={(v) => setPaymentMethod(v as 'pix' | 'credit_card')}
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="pix" className="gap-2">
                  <Smartphone className="h-4 w-4" />
                  PIX
                </TabsTrigger>
                <TabsTrigger value="credit_card" className="gap-2">
                  <CreditCard className="h-4 w-4" />
                  Cartão
                </TabsTrigger>
              </TabsList>

              <TabsContent value="pix" className="mt-4">
                <div className="space-y-4">
                  <div className="p-4 bg-muted rounded-lg text-center">
                    <Smartphone className="h-8 w-8 mx-auto mb-2 text-primary" />
                    <p className="text-sm text-muted-foreground">
                      Pague instantaneamente com PIX
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Créditos liberados em segundos após confirmação
                    </p>
                  </div>
                  
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={handlePixPayment}
                    disabled={isCreatingPayment || !email}
                  >
                    {isCreatingPayment ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Gerando PIX...
                      </>
                    ) : (
                      `Gerar PIX de ${formattedPrice}`
                    )}
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="credit_card" className="mt-4">
                <CardPaymentForm
                  onSubmit={handleCardPayment}
                  isProcessing={isCreatingPayment}
                  amount={package_.price_cents}
                />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
