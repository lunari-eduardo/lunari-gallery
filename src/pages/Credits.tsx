import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '@/contexts/AuthContext';
import { usePhotoCredits } from '@/hooks/usePhotoCredits';
import { useCreditPackages } from '@/hooks/useCreditPackages';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Camera, Infinity, ShoppingCart, History, CheckCircle2, Sparkles, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

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

      {/* Texto de posicionamento */}
      <div className="p-4 rounded-lg bg-primary/5 border border-primary/10">
        <p className="text-sm text-foreground/80 leading-relaxed">
          O Gallery Select transforma sua entrega em experiência profissional.
          <br />
          <span className="text-muted-foreground">
            Créditos flexíveis, sem validade e sem mensalidade.
          </span>
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

      {/* Seção de Upgrades */}
      {!isAdmin && (
        <div className="space-y-4 pt-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-medium text-muted-foreground">
              Leve seu Gallery para o próximo nível
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Upgrade 1 - Studio */}
            <Card className="border-dashed">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Integração com Lunari Studio</CardTitle>
                <CardDescription>
                  Studio Pro + Gallery Select 2k
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Integre seleção com gestão completa. Controle clientes, orçamentos, agenda e fluxo de trabalho em um único sistema.
                </p>
                <p className="text-lg font-semibold">
                  R$ 44,90<span className="text-sm font-normal text-muted-foreground">/mês</span>
                </p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full gap-2"
                  onClick={() => toast.info('Em breve!')}
                >
                  Conhecer Studio
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </CardContent>
            </Card>

            {/* Upgrade 2 - Completo */}
            <Card className="border-dashed">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Estrutura Profissional Completa</CardTitle>
                <CardDescription>
                  Studio Pro + Select 2k + Transfer 20GB
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Gestão, seleção e armazenamento integrados. Mais controle, mais segurança e uma operação profissional do início ao fim.
                </p>
                <p className="text-lg font-semibold">
                  R$ 64,90<span className="text-sm font-normal text-muted-foreground">/mês</span>
                </p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full gap-2"
                  onClick={() => toast.info('Em breve!')}
                >
                  Ver plano completo
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
