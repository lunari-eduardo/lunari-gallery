import { useState } from 'react';
import { useAuthContext } from '@/contexts/AuthContext';
import { usePhotoCredits } from '@/hooks/usePhotoCredits';
import { useCreditPackages, CreditPackage } from '@/hooks/useCreditPackages';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Camera, Infinity, ShoppingCart, History, CheckCircle2 } from 'lucide-react';
import { CreditPackageCard } from '@/components/credits/CreditPackageCard';
import { CreditCheckoutModal } from '@/components/credits/CreditCheckoutModal';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Credits() {
  const { isAdmin } = useAuthContext();
  const { photoCredits, isLoading: isLoadingCredits, history, isLoadingHistory, refetch } = usePhotoCredits();
  const { packages, purchases, isLoadingPackages } = useCreditPackages();
  
  const [selectedPackage, setSelectedPackage] = useState<CreditPackage | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const handleSelectPackage = (pkg: CreditPackage) => {
    setSelectedPackage(pkg);
    setCheckoutOpen(true);
  };

  const handleCheckoutSuccess = () => {
    refetch();
    setCheckoutOpen(false);
    setSelectedPackage(null);
  };

  // Encontrar pacote mais popular (mais vendido ou maior economia)
  const popularPackageId = packages?.[2]?.id; // Pro (10.000 créditos)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Créditos</h1>
        <p className="text-muted-foreground">
          Gerencie seus créditos de foto
        </p>
      </div>

      {/* Saldo Atual */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Seu Saldo
          </CardTitle>
          <CardDescription>1 foto = 1 crédito ao enviar</CardDescription>
        </CardHeader>
        <CardContent>
          {isAdmin ? (
            <div className="text-center py-4">
              <div className="flex items-center justify-center gap-2 text-4xl font-bold text-primary">
                <Infinity className="h-10 w-10" />
              </div>
              <p className="text-muted-foreground mt-2">Créditos ilimitados</p>
              <p className="text-xs text-muted-foreground mt-1">
                Como administrador, você tem acesso ilimitado
              </p>
            </div>
          ) : (
            <div className="text-center py-4">
              <div className="text-5xl font-bold text-primary">
                {isLoadingCredits ? (
                  <Skeleton className="h-12 w-32 mx-auto" />
                ) : (
                  photoCredits.toLocaleString('pt-BR')
                )}
              </div>
              <p className="text-muted-foreground mt-1">créditos disponíveis</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pacotes para Compra (apenas para não-admins) */}
      {!isAdmin && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            <h2 className="text-xl font-semibold">Comprar Créditos</h2>
          </div>
          
          {isLoadingPackages ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-64" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {packages?.map((pkg) => (
                <CreditPackageCard
                  key={pkg.id}
                  package_={pkg}
                  isSelected={selectedPackage?.id === pkg.id}
                  onSelect={() => handleSelectPackage(pkg)}
                  isPopular={pkg.id === popularPackageId}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Histórico de Compras */}
      {!isAdmin && purchases && purchases.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5" />
            <h2 className="text-xl font-semibold">Histórico de Compras</h2>
          </div>
          
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-3">
                {purchases.slice(0, 5).map((purchase) => (
                  <div 
                    key={purchase.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${
                        purchase.status === 'approved' 
                          ? 'bg-primary/10 text-primary' 
                          : 'bg-muted-foreground/10 text-muted-foreground'
                      }`}>
                        {purchase.status === 'approved' ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          <Camera className="h-4 w-4" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium">
                          {purchase.credits_amount.toLocaleString('pt-BR')} créditos
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(purchase.created_at), "dd 'de' MMM 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">
                        {(purchase.price_cents / 100).toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        })}
                      </p>
                      <Badge 
                        variant={purchase.status === 'approved' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {purchase.status === 'approved' ? 'Pago' : 
                         purchase.status === 'pending' ? 'Pendente' : 
                         purchase.status === 'rejected' ? 'Rejeitado' : purchase.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Histórico de Uso */}
      {!isAdmin && history && history.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            <h2 className="text-xl font-semibold">Histórico de Uso</h2>
          </div>
          
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {history.slice(0, 10).map((entry) => (
                  <div 
                    key={entry.id}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                  >
                    <div>
                      <p className="text-sm">
                        {entry.description || entry.operation_type}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(entry.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                    <span className={`font-mono font-medium ${
                      entry.amount > 0 ? 'text-primary' : 'text-destructive'
                    }`}>
                      {entry.amount > 0 ? '+' : ''}{entry.amount}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal de Checkout */}
      <CreditCheckoutModal
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        package_={selectedPackage}
        onSuccess={handleCheckoutSuccess}
      />
    </div>
  );
}
