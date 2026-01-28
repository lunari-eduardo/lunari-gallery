import { useAuthContext } from '@/contexts/AuthContext';
import { usePhotographerAccount, getAccountTypeLabel, getAccountStatusLabel } from '@/hooks/usePhotographerAccount';
import { usePhotoCredits } from '@/hooks/usePhotoCredits';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { 
  User, 
  Mail, 
  Calendar,
  CreditCard,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Crown,
  Zap,
  Images,
  Infinity,
  Camera
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Account() {
  const { user, isAdmin } = useAuthContext();
  const { data, isLoading } = usePhotographerAccount();
  const { photoCredits, isLoading: isLoadingCredits } = usePhotoCredits();

  const getStatusBadge = () => {
    if (!data?.account) return null;
    
    const status = data.account.account_status;
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive'; icon: typeof CheckCircle2 }> = {
      active: { variant: 'default', icon: CheckCircle2 },
      suspended: { variant: 'secondary', icon: AlertCircle },
      canceled: { variant: 'destructive', icon: XCircle },
    };
    
    const config = variants[status] || variants.active;
    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {getAccountStatusLabel(status)}
      </Badge>
    );
  };

  const getAccountTypeBadge = () => {
    if (isAdmin) {
      return (
        <Badge variant="default" className="gap-1">
          <Crown className="h-3 w-3" />
          Administrador
        </Badge>
      );
    }
    
    if (!data?.account) return null;
    
    const type = data.account.account_type;
    const isPro = type === 'pro' || type === 'pro_gallery';
    
    return (
      <Badge variant={isPro ? 'default' : 'secondary'} className="gap-1">
        {isPro ? <Crown className="h-3 w-3" /> : <Zap className="h-3 w-3" />}
        {getAccountTypeLabel(type)}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  const credits = data?.credits ?? 0;
  const galleriesPublished = data?.galleriesPublished ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Minha Conta</h1>
        <p className="text-muted-foreground">
          Gerencie suas informações e configurações
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Perfil */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Perfil
            </CardTitle>
            <CardDescription>Suas informações pessoais</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={user?.user_metadata?.avatar_url} />
                <AvatarFallback className="text-lg">
                  {user?.email?.[0]?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">
                  {user?.user_metadata?.full_name || user?.user_metadata?.name || 'Usuário'}
                </p>
                <p className="text-sm text-muted-foreground truncate flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  {user?.email}
                </p>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Membro desde</span>
                <span className="text-sm font-medium flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {user?.created_at 
                    ? format(new Date(user.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                    : '-'
                  }
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Conta */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5" />
              Conta
            </CardTitle>
            <CardDescription>Detalhes do seu plano e status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Tipo de Conta</span>
              {getAccountTypeBadge()}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              {getStatusBadge()}
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Integração Gestão</span>
              <Badge variant={data?.hasGestaoIntegration ? 'default' : 'outline'}>
                {data?.hasGestaoIntegration ? 'Ativa' : 'Não disponível'}
              </Badge>
            </div>

            {data?.account?.created_at && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Conta criada em</span>
                <span className="text-sm">
                  {format(new Date(data.account.created_at), "dd/MM/yyyy", { locale: ptBR })}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Créditos de Foto */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Créditos de Foto
            </CardTitle>
            <CardDescription>1 foto = 1 crédito ao enviar</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
              <>
                <div className="text-center py-4">
                  <div className="text-4xl font-bold text-primary">
                    {isLoadingCredits ? '...' : photoCredits}
                  </div>
                  <p className="text-muted-foreground">créditos disponíveis</p>
                </div>

                <Button className="w-full" variant="default" disabled>
                  <Camera className="h-4 w-4 mr-2" />
                  Comprar Créditos (Em breve)
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Créditos de Galeria (legado) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Créditos de Galeria
            </CardTitle>
            <CardDescription>Créditos para publicar galerias</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isAdmin ? (
              <div className="text-center py-4">
                <div className="flex items-center justify-center gap-2 text-4xl font-bold text-primary">
                  <Infinity className="h-10 w-10" />
                </div>
                <p className="text-muted-foreground mt-2">Créditos ilimitados</p>
              </div>
            ) : (
              <>
                <div className="text-center py-4">
                  <div className="text-4xl font-bold text-primary">{credits}</div>
                  <p className="text-muted-foreground">créditos de galeria</p>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Images className="h-4 w-4" />
                    Galerias publicadas
                  </span>
                  <span className="text-sm font-medium">{galleriesPublished}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Pagamentos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Configuração de Pagamentos
            </CardTitle>
            <CardDescription>Receba pagamentos dos seus clientes</CardDescription>
          </CardHeader>
          <CardContent>
            {data?.hasPaymentConfigured ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Provedor</span>
                  <Badge variant="default" className="capitalize">
                    {data.paymentProvider?.provedor}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <Badge variant="outline" className="capitalize">
                    {data.paymentProvider?.status}
                  </Badge>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <CreditCard className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm">Nenhum provedor configurado</p>
                {data?.hasGestaoIntegration ? (
                  <p className="text-xs mt-1">Configure em Lunari Gestão para receber pagamentos</p>
                ) : (
                  <p className="text-xs mt-1">Disponível no plano Pro + Gallery</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
