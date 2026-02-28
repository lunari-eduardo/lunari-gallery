import { useNavigate } from 'react-router-dom';
import { useAsaasSubscription, AsaasSubscription } from '@/hooks/useAsaasSubscription';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { ArrowLeft, Loader2, CreditCard, CalendarDays, AlertTriangle, ArrowRight, ArrowDown, X, RotateCcw, Sparkles, Package } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getPlanDisplayName, PLAN_FAMILIES } from '@/lib/transferPlans';

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  ACTIVE: { label: 'Ativa', variant: 'default' },
  PENDING: { label: 'Pendente', variant: 'secondary' },
  OVERDUE: { label: 'Vencida', variant: 'destructive' },
  CANCELLED: { label: 'Cancelada', variant: 'outline' },
};

export default function SubscriptionManagement() {
  const navigate = useNavigate();
  const {
    subscriptions,
    isLoading,
    cancelSubscription,
    isCancelling,
    cancelDowngrade,
    isCancellingDowngrade,
    reactivateSubscription,
    isReactivating,
  } = useAsaasSubscription();

  const formatPrice = (cents: number) =>
    (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/credits')} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        <div className="h-4 w-px bg-border" />
        <h1 className="text-lg font-semibold">Gerenciar Assinaturas</h1>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-48 rounded-lg" />
          <Skeleton className="h-48 rounded-lg" />
        </div>
      ) : subscriptions.length === 0 ? (
        <div className="lunari-card p-10 text-center space-y-6">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <div className="space-y-2">
            <p className="text-lg font-semibold text-foreground">Nenhum plano ativo</p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Ative um plano e faça entregas que geram valor à sua fotografia.
            </p>
          </div>
          <Button onClick={() => navigate('/credits/checkout?tab=transfer')} className="gap-1.5">
            <ArrowRight className="h-4 w-4" />
            Ver planos de armazenamento
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {subscriptions.map((sub) => (
            <SubscriptionCard
              key={sub.id}
              subscription={sub}
              formatPrice={formatPrice}
              onCancel={cancelSubscription}
              isCancelling={isCancelling}
              onCancelDowngrade={cancelDowngrade}
              isCancellingDowngrade={isCancellingDowngrade}
              onReactivate={reactivateSubscription}
              isReactivating={isReactivating}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Unified Subscription Card ─── */

function SubscriptionCard({
  subscription,
  formatPrice,
  onCancel,
  isCancelling,
  onCancelDowngrade,
  isCancellingDowngrade,
  onReactivate,
  isReactivating,
}: {
  subscription: AsaasSubscription;
  formatPrice: (cents: number) => string;
  onCancel: (id: string) => Promise<any>;
  isCancelling: boolean;
  onCancelDowngrade: (id: string) => Promise<any>;
  isCancellingDowngrade: boolean;
  onReactivate: (id: string) => Promise<any>;
  isReactivating: boolean;
}) {
  const navigate = useNavigate();
  const isCancelled = subscription.status === 'CANCELLED';
  const nextDueDate = subscription.next_due_date ? new Date(subscription.next_due_date) : null;
  const isStillActive = isCancelled && nextDueDate && nextDueDate > new Date();
  const statusInfo = STATUS_MAP[subscription.status] || { label: subscription.status || '—', variant: 'outline' as const };
  const family = PLAN_FAMILIES[subscription.plan_type] || 'transfer';

  const handleCancel = async () => {
    try { await onCancel(subscription.id); } catch { /* toast handled */ }
  };
  const handleReactivate = async () => {
    try { await onReactivate(subscription.id); } catch { /* toast handled */ }
  };

  return (
    <div className="lunari-card overflow-hidden">
      {/* Header */}
      <div className="p-6 flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Package className="h-5 w-5 text-primary" />
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Plano atual</p>
            <p className="text-xl font-bold text-foreground capitalize">
              {getPlanDisplayName(subscription.plan_type) || subscription.plan_type?.replace(/_/g, ' ') || 'Transfer'}
            </p>
            <p className="text-sm text-muted-foreground">
              {subscription.billing_cycle === 'YEARLY' ? 'Plano anual (20% off)' : 'Plano mensal'}
            </p>
          </div>
        </div>
        <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
      </div>

      <Separator />

      {/* Details grid */}
      <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <DetailItem
          icon={CreditCard}
          label="Valor"
          value={formatPrice(subscription.value_cents)}
          sub={subscription.billing_cycle === 'MONTHLY' ? '/mês' : '/ano'}
        />
        <DetailItem
          icon={CalendarDays}
          label={isCancelled ? 'Acesso até' : 'Próxima cobrança'}
          value={
            subscription.next_due_date
              ? format(new Date(subscription.next_due_date), "dd 'de' MMMM, yyyy", { locale: ptBR })
              : '—'
          }
        />
        <DetailItem
          icon={CalendarDays}
          label="Assinante desde"
          value={format(new Date(subscription.created_at), "dd MMM yyyy", { locale: ptBR })}
        />
      </div>

      {/* Cancelled but still active banner */}
      {isStillActive && (
        <>
          <Separator />
          <div className="px-6 py-4 bg-amber-500/5 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-start gap-3 flex-1">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground">
                Assinatura cancelada — acesso ativo até{' '}
                <span className="font-semibold text-foreground">
                  {format(nextDueDate!, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </span>
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 shrink-0"
              disabled={isReactivating}
              onClick={handleReactivate}
            >
              {isReactivating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
              Desfazer cancelamento
            </Button>
          </div>
        </>
      )}

      {/* Pending downgrade banner */}
      {!isCancelled && subscription.pending_downgrade_plan && (
        <>
          <Separator />
          <div className="px-6 py-4 bg-amber-500/5 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-start gap-3 flex-1">
              <ArrowDown className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground">
                Downgrade agendado para{' '}
                <span className="font-semibold text-foreground">
                  {getPlanDisplayName(subscription.pending_downgrade_plan)}
                </span>{' '}
                na próxima renovação.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 gap-1.5 text-amber-700 hover:text-amber-800 hover:bg-amber-500/10"
              disabled={isCancellingDowngrade}
              onClick={async () => { try { await onCancelDowngrade(subscription.id); } catch {} }}
            >
              {isCancellingDowngrade ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
              Cancelar downgrade
            </Button>
          </div>
        </>
      )}

      {/* Actions */}
      {!isCancelled && (
        <>
          <Separator />
          <div className="p-6 space-y-3">
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/credits/checkout?tab=${family === 'studio' ? 'select' : 'transfer'}`)}
                className="gap-1.5"
              >
                <ArrowRight className="h-3.5 w-3.5" />
                Upgrade / Downgrade
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/5">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Cancelar assinatura
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancelar assinatura</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tem certeza que deseja cancelar sua assinatura de{' '}
                      <span className="font-semibold">{getPlanDisplayName(subscription.plan_type)}</span>?
                      Você manterá o acesso até o final do período vigente.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Manter assinatura</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleCancel}
                      disabled={isCancelling}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {isCancelling ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Cancelando...</>
                      ) : (
                        'Confirmar cancelamento'
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
            <p className="text-xs text-muted-foreground">
              Alterações de plano são ajustadas proporcionalmente ao período atual.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function DetailItem({ icon: Icon, label, value, sub }: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="rounded-lg bg-muted p-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground">
          {value}
          {sub && <span className="text-xs text-muted-foreground ml-0.5">{sub}</span>}
        </p>
      </div>
    </div>
  );
}
