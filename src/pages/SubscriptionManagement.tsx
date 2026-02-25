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
import { ArrowLeft, Loader2, CreditCard, CalendarDays, AlertTriangle, ArrowRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  ACTIVE: { label: 'Ativa', variant: 'default' },
  PENDING: { label: 'Pendente', variant: 'secondary' },
  OVERDUE: { label: 'Vencida', variant: 'destructive' },
  CANCELLED: { label: 'Cancelada', variant: 'outline' },
};

export default function SubscriptionManagement() {
  const navigate = useNavigate();
  const { subscription, isLoading, cancelSubscription, isCancelling } = useAsaasSubscription();

  const handleCancel = async () => {
    if (!subscription?.asaas_subscription_id) return;
    try {
      await cancelSubscription(subscription.asaas_subscription_id);
      navigate('/credits');
    } catch {
      // toast already handled by hook
    }
  };

  const formatPrice = (cents: number) =>
    (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const statusInfo = STATUS_MAP[subscription?.status || ''] || { label: subscription?.status || '—', variant: 'outline' as const };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/credits')} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        <div className="h-4 w-px bg-border" />
        <h1 className="text-lg font-semibold">Gerenciar Assinatura</h1>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
      ) : !subscription ? (
        <div className="rounded-xl border bg-card p-8 text-center space-y-4">
          <p className="text-muted-foreground">Nenhuma assinatura ativa encontrada.</p>
          <Button onClick={() => navigate('/credits/checkout?tab=transfer')} className="gap-1.5">
            <ArrowRight className="h-4 w-4" />
            Ver planos de armazenamento
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Plan details card */}
          <div className="rounded-xl border bg-card p-6 space-y-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Plano atual</p>
                <p className="text-xl font-bold text-foreground capitalize">
                  {subscription.plan_type?.replace(/_/g, ' ') || 'Transfer'}
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
                label="Próxima cobrança"
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

          {/* Actions */}
          <div className="rounded-xl border bg-card p-6 space-y-4">
            <p className="text-sm font-medium text-foreground">Ações</p>

            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/credits/checkout?tab=transfer&upgrade=true&current_plan=${subscription.plan_type}&billing_cycle=${subscription.billing_cycle}&next_due_date=${subscription.next_due_date || ''}&subscription_id=${subscription.id}`)}
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
                      Tem certeza que deseja cancelar sua assinatura? Você perderá o acesso ao armazenamento no final do período vigente.
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
