import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthContext } from '@/contexts/AuthContext';
import { useCreditPackages } from '@/hooks/useCreditPackages';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Loader2, Lock, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { PixPaymentDisplay } from '@/components/credits/PixPaymentDisplay';

interface PaymentState {
  packageId: string;
  packageName: string;
  credits: number;
  priceCents: number;
}

export default function CreditsPayment() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthContext();
  const { createPayment, checkPayment, isCreatingPayment } = useCreditPackages();

  const pkg = location.state as PaymentState | null;

  const [email, setEmail] = useState(user?.email || '');
  const [pixData, setPixData] = useState<{
    qrCodeBase64: string;
    pixCopiaECola: string;
    expiration: string;
    purchaseId: string;
  } | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  if (!pkg) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Nenhum pacote selecionado.</p>
          <Button variant="outline" onClick={() => navigate('/credits/checkout')}>
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

  const handlePixPayment = async () => {
    if (!email) {
      toast.error('Informe seu e-mail');
      return;
    }
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

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="container max-w-lg py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/credits/checkout')} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
          <div className="h-4 w-px bg-border" />
          <span className="text-sm text-muted-foreground">Pagamento</span>
        </div>
      </header>

      <main className="container max-w-lg py-8 space-y-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Finalizar Compra</h1>
          <p className="text-sm text-muted-foreground">Pagamento via PIX</p>
        </div>

        {/* Package summary */}
        <div className="flex justify-between items-center p-4 rounded-2xl bg-card border shadow-sm">
          <div>
            <p className="font-medium text-foreground">{pkg.packageName}</p>
            <p className="text-sm text-muted-foreground">
              {pkg.credits.toLocaleString('pt-BR')} créditos
            </p>
          </div>
          <p className="text-xl font-bold text-primary">{formattedPrice}</p>
        </div>

        {paymentSuccess ? (
          <div className="rounded-2xl border p-8 text-center bg-card">
            <div className="text-4xl mb-3">🎉</div>
            <h3 className="text-lg font-semibold text-primary">Pagamento Confirmado!</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {pkg.credits.toLocaleString('pt-BR')} créditos adicionados
            </p>
            <p className="text-xs text-muted-foreground mt-3">Redirecionando...</p>
          </div>
        ) : pixData ? (
          <div className="rounded-2xl border p-6 bg-card space-y-4">
            <PixPaymentDisplay
              qrCodeBase64={pixData.qrCodeBase64}
              pixCopiaECola={pixData.pixCopiaECola}
              expiration={pixData.expiration}
              onCheckStatus={handleCheckStatus}
              onSuccess={handlePixSuccess}
            />
          </div>
        ) : (
          <div className="rounded-2xl border p-6 bg-card space-y-5 shadow-sm">
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

            <div className="p-4 bg-muted/50 rounded-xl text-center">
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
        )}
      </main>
    </div>
  );
}
