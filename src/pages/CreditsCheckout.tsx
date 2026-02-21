import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '@/contexts/AuthContext';
import { useCreditPackages, CreditPackage } from '@/hooks/useCreditPackages';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  ArrowLeft, 
  Camera, 
  Check, 
  Loader2, 
  Lock, 
  Package, 
  ShoppingCart, 
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

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="border-b bg-background">
        <div className="container max-w-6xl py-4 flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => navigate('/credits')}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
          <div className="h-4 w-px bg-border" />
          <span className="text-sm text-muted-foreground">Compra de Créditos</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="container max-w-6xl py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">Comprar Créditos</h1>
          <p className="text-muted-foreground">
            Escolha seu pacote e finalize a compra
          </p>
        </div>

        <div className="lg:grid lg:grid-cols-5 lg:gap-8">
          {/* Coluna de Pacotes */}
          <div className="lg:col-span-3 space-y-6">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Package className="h-4 w-4" />
              Selecione um pacote
            </div>

            {isLoadingPackages ? (
              <div className="grid grid-cols-2 gap-4">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-40 rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {packages?.map((pkg) => {
                  const isSelected = selectedPackage?.id === pkg.id;
                  const price = (pkg.price_cents / 100).toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  });

                  return (
                    <button
                      key={pkg.id}
                      onClick={() => {
                        if (!paymentSuccess && !pixData) {
                          setSelectedPackage(pkg);
                        }
                      }}
                      disabled={!!paymentSuccess || !!pixData}
                      className={cn(
                        "relative p-6 rounded-xl border-2 text-left transition-all",
                        "hover:border-primary/50 hover:shadow-md",
                        "disabled:opacity-50 disabled:cursor-not-allowed",
                        isSelected 
                          ? "border-primary bg-primary/5 shadow-md" 
                          : "border-border bg-card"
                      )}
                    >
                      {isSelected && (
                        <div className="absolute top-3 right-3">
                          <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                            <Check className="h-4 w-4 text-primary-foreground" />
                          </div>
                        </div>
                      )}

                      <div className="space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">
                          {pkg.name}
                        </p>
                        <div className="flex items-baseline gap-1">
                          <Camera className="h-4 w-4 text-primary" />
                          <span className="text-2xl font-bold">
                            {pkg.credits.toLocaleString('pt-BR')}
                          </span>
                        </div>
                        <p className="text-lg font-semibold text-primary">
                          {price}
                        </p>
                        {pkg.description && (
                          <p className="text-xs text-muted-foreground">
                            {pkg.description}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Info adicional */}
            <div className="p-4 rounded-lg bg-muted/50 border">
              <div className="flex items-start gap-3">
                <Camera className="h-5 w-5 text-primary mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium">Como funcionam os créditos?</p>
                  <p className="text-muted-foreground mt-1">
                    Cada foto enviada para uma galeria consome 1 crédito. 
                    Os créditos não expiram e podem ser usados a qualquer momento.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Coluna de Checkout */}
          <div className="lg:col-span-2 mt-8 lg:mt-0">
            <Card className="lg:sticky lg:top-8">
              {paymentSuccess ? (
                <CardContent className="pt-6">
                  <div className="py-8 text-center">
                    <div className="text-5xl mb-4">🎉</div>
                    <h3 className="text-xl font-semibold text-primary">
                      Pagamento Confirmado!
                    </h3>
                    <p className="text-muted-foreground mt-2">
                      {selectedPackage?.credits.toLocaleString('pt-BR')} créditos 
                      foram adicionados à sua conta
                    </p>
                    <p className="text-sm text-muted-foreground mt-4">
                      Redirecionando...
                    </p>
                  </div>
                </CardContent>
              ) : pixData ? (
                <CardContent className="pt-6">
                  <PixPaymentDisplay
                    qrCodeBase64={pixData.qrCodeBase64}
                    pixCopiaECola={pixData.pixCopiaECola}
                    expiration={pixData.expiration}
                    onCheckStatus={handleCheckStatus}
                    onSuccess={handlePixSuccess}
                  />
                  <div className="mt-4 pt-4 border-t">
                    <Button 
                      variant="ghost" 
                      className="w-full text-muted-foreground"
                      onClick={handleReset}
                    >
                      Escolher outro pacote
                    </Button>
                  </div>
                </CardContent>
              ) : selectedPackage ? (
                <>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ShoppingCart className="h-5 w-5" />
                      Resumo do Pedido
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Resumo do pacote */}
                    <div className="p-4 rounded-lg bg-muted/50 border">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">{selectedPackage.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {selectedPackage.credits.toLocaleString('pt-BR')} créditos
                          </p>
                        </div>
                        <p className="text-lg font-bold text-primary">
                          {formattedPrice}
                        </p>
                      </div>
                    </div>

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

                    {/* PIX direto */}
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

                    {/* Segurança */}
                    <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1">
                      <Lock className="h-3 w-3" />
                      Pagamento seguro via Mercado Pago
                    </p>
                  </CardContent>
                </>
              ) : (
                <CardContent className="pt-6">
                  <div className="py-12 text-center text-muted-foreground">
                    <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p>Selecione um pacote ao lado</p>
                    <p className="text-sm mt-1">para continuar com a compra</p>
                  </div>
                </CardContent>
              )}
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
