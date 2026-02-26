import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAsaasSubscription, AsaasSubscription } from '@/hooks/useAsaasSubscription';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { ArrowLeft, Loader2, CreditCard, CalendarDays, AlertTriangle, ArrowRight, ArrowDown, X, RotateCcw, Sparkles } from 'lucide-react';
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
      {/* Header */}
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
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
      ) : subscriptions.length === 0 ? (
        <div className="rounded-xl border bg-card p-10 text-center space-y-6">
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

/* ─── Individual Subscription Card ─── */

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
    try {
      await onCancel(subscription.id);
    } catch { /* toast handled */ }
  };

  const handleReactivate = async () => {
    try {
      await onReactivate(subscription.id);
    } catch { /* toast handled */ }
  };

  return (
    <div className="space-y-4">
      {/* Cancelled but still active notice */}
      {isStillActive && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-6 space-y-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1 flex-1">
              <p className="text-sm font-medium text-foreground">Assinatura cancelada</p>
              <p className="text-sm text-muted-foreground">
                Seu plano permanece ativo até{' '}
                <span className="font-semibold text-foreground">
                  {format(nextDueDate!, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </span>
                . Após essa data, você perderá o acesso.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={isReactivating}
            onClick={handleReactivate}
          >
            {isReactivating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
            Desfazer cancelamento
          </Button>
        </div>
      )}

      {/* Plan details card */}
      <div className="rounded-xl border bg-card p-6 space-y-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Plano atual</p>
            <p className="text-xl font-bold text-foreground capitalize">
              {getPlanDisplayName(subscription.plan_type) || subscription.plan_type?.replace(/_/g, ' ') || 'Transfer'}
            </p>
            <p className="text-sm text-muted-foreground">
              {subscription.billing_cycle === 'YEARLY' ? 'Plano anual (20% off)' : 'Plano mensal'}
            </p>
          </div>
          <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
      </div>

      {/* Pending downgrade notice */}
      {!isCancelled && subscription.pending_downgrade_plan && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-6 space-y-3">
          <div className="flex items-start gap-3">
            <ArrowDown className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1 flex-1">
              <p className="text-sm font-medium text-foreground">Downgrade agendado para o próximo ciclo</p>
              <p className="text-sm text-muted-foreground">
                Seu plano será alterado para{' '}
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
        </div>
      )}

      {/* Actions */}
      {!isCancelled && (
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <p className="text-sm font-medium text-foreground">Ações</p>
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
