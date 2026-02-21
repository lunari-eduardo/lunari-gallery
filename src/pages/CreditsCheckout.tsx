import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '@/contexts/AuthContext';
import { useCreditPackages, CreditPackage } from '@/hooks/useCreditPackages';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  ArrowLeft, 
  Camera, 
  Check, 
  Loader2, 
  Lock, 
  Smartphone 
} from 'lucide-react';
import { toast } from 'sonner';
import { PixPaymentDisplay } from '@/components/credits/PixPaymentDisplay';
import { cn } from '@/lib/utils';

export default function CreditsCheckout() {
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const { 
    packages, 
    isLoadingPackages, 
    createPayment, 
    checkPayment, 
    isCreatingPayment 
  } = useCreditPackages();

  const [selectedPackage, setSelectedPackage] = useState<CreditPackage | null>(null);
  const [email, setEmail] = useState(user?.email || '');
  const [pixData, setPixData] = useState<{
    qrCodeBase64: string;
    pixCopiaECola: string;
    expiration: string;
    purchaseId: string;
  } | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  // Separar pacotes avulsos e combos
  const avulsos = packages?.filter(p => p.sort_order < 10) || [];
  const combos = packages?.filter(p => p.sort_order >= 10) || [];

  const formattedPrice = selectedPackage 
    ? (selectedPackage.price_cents / 100).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      })
    : '';

  const handlePixPayment = async () => {
    if (!selectedPackage) return;
    if (!email) {
      toast.error('Informe seu e-mail');
      return;
    }

    try {
      const result = await createPayment({
        packageId: selectedPackage.id,
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
      navigate('/credits');
    }, 2000);
  };

  const handleReset = () => {
    setPixData(null);
    setPaymentSuccess(false);
    setSelectedPackage(null);
  };

  const isLocked = !!paymentSuccess || !!pixData;

  const PackageRow = ({ pkg }: { pkg: CreditPackage }) => {
    const isSelected = selectedPackage?.id === pkg.id;
    const price = (pkg.price_cents / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
    const isCombo = pkg.sort_order >= 10;

    return (
      <button
        onClick={() => {
          if (!isLocked) setSelectedPackage(pkg);
        }}
        disabled={isLocked}
        className={cn(
          "w-full flex items-center justify-between p-3 rounded-lg border text-left transition-all",
          "hover:border-primary/50 disabled:opacity-50 disabled:cursor-not-allowed",
          isSelected 
            ? "border-primary bg-primary/5" 
            : "border-border bg-card"
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          {isSelected ? (
            <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center shrink-0">
              <Check className="h-3 w-3 text-primary-foreground" />
            </div>
          ) : (
            <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30 shrink-0" />
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{pkg.name}</p>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Camera className="h-3 w-3" />
              <span>{pkg.credits.toLocaleString('pt-BR')} créditos</span>
              {isCombo && <span className="text-primary font-medium ml-1">• mensal</span>}
            </div>
          </div>
        </div>
        <span className="text-sm font-semibold text-primary shrink-0 ml-2">
          {price}
          {isCombo && <span className="text-xs font-normal text-muted-foreground">/mês</span>}
        </span>
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="border-b bg-background">
        <div className="container max-w-lg py-3 flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => navigate('/credits')}
            className="gap-1.5"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
          <div className="h-4 w-px bg-border" />
          <span className="text-sm text-muted-foreground">Compra de Créditos</span>
        </div>
      </header>

      {/* Main Content - single column */}
      <main className="container max-w-lg py-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Comprar Créditos</h1>
          <p className="text-sm text-muted-foreground">
            Seus créditos não expiram e podem ser usados a qualquer momento
          </p>
        </div>

        {/* Pacotes avulsos */}
        {isLoadingPackages ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Créditos avulsos
              </p>
              <div className="space-y-2">
                {avulsos.map((pkg) => (
                  <PackageRow key={pkg.id} pkg={pkg} />
                ))}
              </div>
            </div>

            {/* Planos mensais */}
            {combos.length > 0 && (
              <div className="space-y-3">
                <Separator />
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Planos mensais
                </p>
                <div className="space-y-2">
                  {combos.map((pkg) => (
                    <PackageRow key={pkg.id} pkg={pkg} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Checkout inline */}
        {paymentSuccess ? (
          <div className="rounded-lg border p-6 text-center bg-card">
            <div className="text-4xl mb-3">🎉</div>
            <h3 className="text-lg font-semibold text-primary">
              Pagamento Confirmado!
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {selectedPackage?.credits.toLocaleString('pt-BR')} créditos adicionados
            </p>
            <p className="text-xs text-muted-foreground mt-3">
              Redirecionando...
            </p>
          </div>
        ) : pixData ? (
          <div className="rounded-lg border p-4 bg-card space-y-4">
            <PixPaymentDisplay
              qrCodeBase64={pixData.qrCodeBase64}
              pixCopiaECola={pixData.pixCopiaECola}
              expiration={pixData.expiration}
              onCheckStatus={handleCheckStatus}
              onSuccess={handlePixSuccess}
            />
            <Button 
              variant="ghost" 
              className="w-full text-muted-foreground"
              onClick={handleReset}
            >
              Escolher outro pacote
            </Button>
          </div>
        ) : selectedPackage ? (
          <div className="rounded-lg border p-4 bg-card space-y-4">
            {/* Resumo */}
            <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
              <div>
                <p className="text-sm font-medium">{selectedPackage.name}</p>
                <p className="text-xs text-muted-foreground">
                  {selectedPackage.credits.toLocaleString('pt-BR')} créditos
                </p>
              </div>
              <p className="text-base font-bold text-primary">
                {formattedPrice}
              </p>
            </div>

            {/* Email */}
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

            {/* PIX */}
            <div className="space-y-3">
              <div className="p-3 bg-muted rounded-lg text-center">
                <Smartphone className="h-6 w-6 mx-auto mb-1.5 text-primary" />
                <p className="text-xs text-muted-foreground">
                  Pague instantaneamente com PIX
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

            <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1">
              <Lock className="h-3 w-3" />
              Pagamento seguro via Mercado Pago
            </p>
          </div>
        ) : null}
      </main>
    </div>
  );
}
