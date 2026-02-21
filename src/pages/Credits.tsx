import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '@/contexts/AuthContext';
import { usePhotoCredits } from '@/hooks/usePhotoCredits';
import { useCreditPackages } from '@/hooks/useCreditPackages';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Camera, Infinity, ShoppingCart, History, CheckCircle2, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

export default function Credits() {
  const navigate = useNavigate();
  const { isAdmin } = useAuthContext();
  const { photoCredits, isLoading: isLoadingCredits } = usePhotoCredits();
  const { purchases } = useCreditPackages();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Créditos</h1>
        <p className="text-muted-foreground text-sm">
          Gerencie seus créditos de foto
        </p>
      </div>

      {/* Texto de posicionamento */}
      <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
        <p className="text-sm text-foreground/80 leading-relaxed">
          O Gallery Select organiza e valoriza a seleção das fotos.
          <br />
          <span className="text-muted-foreground">
            Mais controle para você, mais clareza para seu cliente.
          </span>
        </p>
      </div>

      {/* Saldo Atual - sem Card wrapper */}
      <div className="rounded-lg border p-4">
        {isAdmin ? (
          <div className="text-center py-2">
            <div className="flex items-center justify-center gap-2 text-3xl font-bold text-primary">
              <Infinity className="h-8 w-8" />
            </div>
            <p className="text-muted-foreground text-sm mt-1">Créditos ilimitados</p>
            <p className="text-xs text-muted-foreground">
              Como administrador, você tem acesso ilimitado
            </p>
          </div>
        ) : (
          <div className="text-center py-2">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Camera className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Seu Saldo</span>
            </div>
            <div className="text-4xl font-bold text-primary">
              {isLoadingCredits ? (
                <Skeleton className="h-10 w-28 mx-auto" />
              ) : (
                photoCredits.toLocaleString('pt-BR')
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">créditos disponíveis</p>
            <p className="text-xs text-muted-foreground/70 mt-0.5">
              Seus créditos não vencem e podem ser usados a qualquer momento
            </p>
          </div>
        )}
        
        {!isAdmin && (
          <div className="pt-3 border-t mt-3">
            <Button 
              onClick={() => navigate('/credits/checkout')} 
              className="w-full"
              size="default"
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              Comprar Créditos
            </Button>
          </div>
        )}
      </div>

      {/* Histórico de Compras - lista simples */}
      {!isAdmin && purchases && purchases.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-base font-semibold">Histórico de Compras</h2>
          </div>
          
          <div className="space-y-2">
            {purchases.slice(0, 5).map((purchase) => (
              <div 
                key={purchase.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-card"
              >
                <div className="flex items-center gap-2.5">
                  <div className={`p-1.5 rounded-full ${
                    purchase.status === 'approved' 
                      ? 'bg-primary/10 text-primary' 
                      : 'bg-muted-foreground/10 text-muted-foreground'
                  }`}>
                    {purchase.status === 'approved' ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      <Camera className="h-3.5 w-3.5" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {purchase.credits_amount.toLocaleString('pt-BR')} créditos
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(purchase.created_at), "dd 'de' MMM 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">
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
        </div>
      )}

      {/* Seção de Upgrades - simplificada */}
      {!isAdmin && (
        <div className="space-y-3 pt-2">
          <Separator />
          <p className="text-sm text-muted-foreground">
            Leve seu Gallery para o próximo nível
          </p>

          <div className="space-y-2">
            {/* Upgrade 1 - Studio */}
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Integração com Lunari Studio</p>
                <p className="text-xs text-muted-foreground">
                  Studio Pro + Gallery Select 2k
                </p>
                <p className="text-sm font-semibold mt-1">
                  R$ 44,90<span className="text-xs font-normal text-muted-foreground">/mês</span>
                </p>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="ml-3 shrink-0 gap-1"
                onClick={() => toast.info('Em breve!')}
              >
                Conhecer
                <ArrowRight className="h-3 w-3" />
              </Button>
            </div>

            {/* Upgrade 2 - Completo */}
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Estrutura Profissional Completa</p>
                <p className="text-xs text-muted-foreground">
                  Studio Pro + Select 2k + Transfer 20GB
                </p>
                <p className="text-sm font-semibold mt-1">
                  R$ 64,90<span className="text-xs font-normal text-muted-foreground">/mês</span>
                </p>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="ml-3 shrink-0 gap-1"
                onClick={() => toast.info('Em breve!')}
              >
                Ver plano
                <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
