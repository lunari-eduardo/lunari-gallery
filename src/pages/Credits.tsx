import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '@/contexts/AuthContext';
import { usePhotoCredits } from '@/hooks/usePhotoCredits';
import { useCreditPackages } from '@/hooks/useCreditPackages';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Camera, Infinity, ShoppingCart, History, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Credits() {
  const navigate = useNavigate();
  const { isAdmin } = useAuthContext();
  const { photoCredits, isLoading: isLoadingCredits, refetch } = usePhotoCredits();
  const { purchases } = useCreditPackages();

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
          
          {/* Botão Comprar Créditos dentro do card de saldo */}
          {!isAdmin && (
            <div className="pt-4 border-t">
              <Button 
                onClick={() => navigate('/credits/checkout')} 
                className="w-full"
                size="lg"
              >
                <ShoppingCart className="h-4 w-4 mr-2" />
                Comprar Créditos
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

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
    </div>
  );
}
