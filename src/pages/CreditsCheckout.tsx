import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCreditPackages, CreditPackage } from '@/hooks/useCreditPackages';
import { useAsaasSubscription } from '@/hooks/useAsaasSubscription';
import { useTransferStorage } from '@/hooks/useTransferStorage';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  ArrowLeft, 
  Camera, 
  Check, 
  Image, 
  Users, 
  Palette, 
  ShieldCheck,
  Minus,
  Star,
  HardDrive,
  Info,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ALL_PLAN_PRICES, getPlanDisplayName, getStorageLimitBytes, formatStorageSize } from '@/lib/transferPlans';
import { differenceInDays } from 'date-fns';


/* ═══════════════════════════════════════════
   STATIC DATA
   ═══════════════════════════════════════════ */

const BENEFITS_AVULSO = [
  { icon: Image, label: 'Galerias ilimitadas' },
  { icon: Users, label: 'Clientes ilimitados' },
  { icon: Camera, label: 'Até 2560px de resolução' },
  { icon: Palette, label: 'Presets de galerias' },
  { icon: ShieldCheck, label: 'Sem taxa ou comissão' },
];

const COMBO_PLANS = [
  {
    name: 'Studio Pro + Select 2k',
    monthlyPrice: 4490,
    yearlyPrice: 45259,
    credits: 2000,
    benefits: [
      'Sistema completo de gestão',
      '2.000 créditos mensais',
      'Integração automática com Gallery',
      'Controle de clientes',
      'Fluxo de trabalho',
      'Automações de pagamentos',
    ],
    buttonLabel: 'Assinar',
    highlight: false,
  },
  {
    name: 'Studio Pro + Select 2k + Transfer 20GB',
    monthlyPrice: 6490,
    yearlyPrice: 66198,
    credits: 2000,
    benefits: [
      'Gestão completa',
      '2.000 créditos mensais',
      '20GB de armazenamento profissional',
      'Entrega profissional no seu estilo',
    ],
    buttonLabel: 'Assinar',
    highlight: true,
    tag: 'Mais completo',
  },
];

const COMPARISON_ROWS = [
  { label: 'Preço', avulso: 'A partir de R$ 19,90', pro: 'R$ 44,90/mês', full: 'R$ 64,90/mês' },
  { label: 'Clientes ilimitados', avulso: true, pro: true, full: true },
  { label: 'Galerias ilimitadas', avulso: true, pro: true, full: true },
  { label: 'Resolução até 2560px', avulso: true, pro: true, full: true },
  { label: 'Créditos mensais', avulso: false, pro: '2.000', full: '2.000' },
  { label: 'Armazenamento', avulso: false, pro: false, full: '20GB' },
  { label: 'Gestão de clientes', avulso: false, pro: true, full: true },
  { label: 'Controle financeiro', avulso: false, pro: true, full: true },
  { label: 'Entrega profissional', avulso: false, pro: false, full: true },
];

const TRANSFER_PLANS = [
  { name: '5GB', monthlyPrice: 1290, yearlyPrice: 12384, storage: '5GB', highlight: false },
  { name: '20GB', monthlyPrice: 2490, yearlyPrice: 23904, storage: '20GB', highlight: true, tag: 'Mais escolhido' },
  { name: '50GB', monthlyPrice: 3490, yearlyPrice: 33504, storage: '50GB', highlight: false },
  { name: '100GB', monthlyPrice: 5990, yearlyPrice: 57504, storage: '100GB', highlight: false },
];

const BENEFITS_TRANSFER = [
  { icon: Users, label: 'Galerias atreladas ao cliente' },
  { icon: Camera, label: 'Entrega profissional' },
  { icon: ShieldCheck, label: 'Acesso rápido e estável' },
  { icon: Image, label: 'Expansão conforme necessidade' },
  { icon: Check, label: 'Download do arquivo original' },
];

const TRANSFER_COMBO = {
  name: 'Studio Pro + Select 2k + Transfer 20GB',
  monthlyPrice: 6490,
  yearlyPrice: 66198,
};

/* ═══════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════ */

export default function CreditsCheckout() {
  const navigate = useNavigate();
  const { packages, isLoadingPackages } = useCreditPackages();
  const { subscription: activeSub, subscriptions: allSubs, transferSub, studioSub, downgradeSubscription, isDowngrading } = useAsaasSubscription();
  const { storageUsedBytes } = useTransferStorage();
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') === 'transfer' ? 'transfer' : 'select';
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>(() => {
    const urlCycle = searchParams.get('billing_cycle');
    if (urlCycle === 'YEARLY') return 'yearly';
    return 'monthly';
  });

  // Upgrade mode: auto-detect from hook OR from URL params
  const urlUpgradeMode = searchParams.get('upgrade') === 'true';
  const urlCurrentPlan = searchParams.get('current_plan') || '';
  const urlBillingCycle = searchParams.get('billing_cycle') || 'MONTHLY';
  const urlNextDueDate = searchParams.get('next_due_date') || '';
  const urlSubscriptionId = searchParams.get('subscription_id') || '';

  // Auto-detect: if there's an active subscription (ACTIVE status) and we're on transfer tab
  const hasActiveTransferSub = !!activeSub && activeSub.status === 'ACTIVE' && activeTab === 'transfer';
  const isUpgradeMode = urlUpgradeMode || hasActiveTransferSub;

  const currentPlanType = activeSub?.plan_type || urlCurrentPlan;
  const currentBillingCycle = activeSub?.billing_cycle || urlBillingCycle;
  const nextDueDate = activeSub?.next_due_date || urlNextDueDate;
  const currentSubscriptionId = activeSub?.id || urlSubscriptionId;

  const currentPlanPrices = ALL_PLAN_PRICES[currentPlanType];
  const currentPriceCents = currentPlanPrices
    ? (currentBillingCycle === 'YEARLY' ? currentPlanPrices.yearly : currentPlanPrices.monthly)
    : 0;

  const daysRemaining = nextDueDate ? Math.max(0, differenceInDays(new Date(nextDueDate), new Date())) : 0;
  const totalCycleDays = currentBillingCycle === 'YEARLY' ? 365 : 30;

  const avulsos = packages?.filter(p => p.sort_order < 10) || [];

  const formatPrice = (cents: number) =>
    (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const handleBuy = (pkg: CreditPackage) => {
    navigate('/credits/checkout/pay', {
      state: {
        type: 'select',
        packageId: pkg.id,
        packageName: pkg.name,
        credits: pkg.credits,
        priceCents: pkg.price_cents,
      },
    });
  };

  const handleSubscribe = (planType: string, planName: string, priceCents: number) => {
    // In upgrade mode, the user can change billing cycle via the toggle
    const selectedCycle = billingPeriod === 'monthly' ? 'MONTHLY' : 'YEARLY';

    if (isUpgradeMode && currentSubscriptionId) {
      // Calculate prorata: credit = currentPrice * (daysRemaining / currentCycleDays)
      const newPlanPrices = ALL_PLAN_PRICES[planType];
      const newPriceCentsForCycle = selectedCycle === 'YEARLY'
        ? (newPlanPrices?.yearly || priceCents)
        : (newPlanPrices?.monthly || priceCents);
      const creditCents = Math.round(currentPriceCents * (daysRemaining / totalCycleDays));
      const prorataValueCents = Math.max(0, newPriceCentsForCycle - creditCents);

      navigate('/credits/checkout/pay', {
        state: {
          type: 'subscription',
          planType,
          planName,
          billingCycle: selectedCycle as 'MONTHLY' | 'YEARLY',
          priceCents: newPriceCentsForCycle,
          isUpgrade: true,
          prorataValueCents,
          currentSubscriptionId,
          currentPlanName: getPlanDisplayName(currentPlanType) || currentPlanType,
        },
      });
    } else {
      navigate('/credits/checkout/pay', {
        state: {
          type: 'subscription',
          planType,
          planName,
          billingCycle: selectedCycle as 'MONTHLY' | 'YEARLY',
          priceCents,
        },
      });
    }
  };

  const isHighlighted = (pkg: CreditPackage) => pkg.sort_order === 3;

  // Downgrade state
  const [downgradeDialog, setDowngradeDialog] = useState<{
    planType: string;
    planName: string;
    billingCycle: string;
  } | null>(null);
  const [downgradeConfirmed, setDowngradeConfirmed] = useState(false);

  const handleDowngrade = async () => {
    if (!downgradeDialog || !currentSubscriptionId) return;
    try {
      await downgradeSubscription({
        subscriptionId: currentSubscriptionId,
        newPlanType: downgradeDialog.planType,
        newBillingCycle: downgradeDialog.billingCycle,
      });
      setDowngradeDialog(null);
      setDowngradeConfirmed(false);
      navigate('/credits/subscription');
    } catch {
      // toast handled by hook
    }
  };

  const newDowngradeLimitBytes = downgradeDialog ? getStorageLimitBytes(downgradeDialog.planType) : 0;
  const isOverLimitOnDowngrade = downgradeDialog ? storageUsedBytes > newDowngradeLimitBytes : false;

  return (
    <div className="min-h-screen bg-background">
      {/* Back button */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container max-w-6xl py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/credits')} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
        </div>
      </header>

      {/* ═══ HERO ═══ */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/8 via-primary/3 to-transparent" />
        <div className="relative container max-w-6xl pt-10 pb-24 md:pb-28 text-center space-y-4">
          <Badge variant="secondary" className="text-xs tracking-wider uppercase">
            {activeTab === 'select' ? 'Créditos' : 'Armazenamento'}
          </Badge>
          <h1 className="text-2xl md:text-4xl font-bold tracking-tight text-foreground max-w-2xl mx-auto text-balance">
            {activeTab === 'select'
              ? 'Organize e profissionalize o processo de seleção de fotos'
              : 'Entregue suas fotos com qualidade e profissionalismo'}
          </h1>
          <p className="text-muted-foreground text-base md:text-lg max-w-xl mx-auto">
            {activeTab === 'select'
              ? 'Créditos flexíveis, sem validade e sem mensalidade.'
              : 'Armazenamento seguro com entrega profissional no seu estilo.'}
          </p>
        </div>
      </section>

      {/* ═══════════════════════════════════
           SELECT TAB
         ═══════════════════════════════════ */}
      {activeTab === 'select' && (
        <>
          {/* SELECT AVULSO CARDS */}
          <section className="container max-w-6xl -mt-12 md:-mt-16 relative z-[1] pb-20">
            {isLoadingPackages ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-96 rounded-2xl" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {avulsos.map((pkg) => {
                  const highlighted = isHighlighted(pkg);
                  return (
                    <div
                      key={pkg.id}
                      className={cn(
                        'relative flex flex-col rounded-2xl border bg-card p-8 transition-all hover:shadow-md',
                        highlighted
                          ? 'border-primary shadow-md ring-1 ring-primary/20'
                          : 'border-border shadow-sm'
                      )}
                    >
                      {highlighted && (
                        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs gap-1">
                          <Star className="h-3 w-3" />
                          Mais escolhido
                        </Badge>
                      )}
                      <p className="text-lg font-semibold text-foreground">{pkg.name}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {pkg.credits.toLocaleString('pt-BR')} créditos
                      </p>
                      <p className="text-3xl font-bold text-primary mt-5">
                        {formatPrice(pkg.price_cents)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">pagamento único</p>
                      <Button className="mt-6 px-8" size="lg" onClick={() => handleBuy(pkg)}>
                        Comprar
                      </Button>
                      <ul className="mt-6 space-y-2.5 flex-1">
                        {BENEFITS_AVULSO.map(({ icon: Icon, label }) => (
                          <li key={label} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                            <Icon className="h-4 w-4 text-primary/70 shrink-0" />
                            {label}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* MICRO-TRIGGER */}
          <div className="text-center pb-20">
            <p className="text-sm text-muted-foreground/70 italic">
              Usa créditos com frequência? Um plano mensal pode sair mais vantajoso no longo prazo.
            </p>
          </div>

          {/* COMBOS */}
          <section className="container max-w-5xl pb-20 space-y-10">
            <div className="text-center space-y-3">
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
                Cresça com uma estrutura completa
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                Para quem quer integrar gestão, seleção e armazenamento em um único sistema profissional.
              </p>
            </div>

            {/* Toggle */}
            <div className="flex justify-center">
              <BillingToggle billingPeriod={billingPeriod} onChange={setBillingPeriod} />
            </div>

            {/* Combo cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {COMBO_PLANS.map((plan) => {
                const priceCents = billingPeriod === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice;
                return (
                  <div
                    key={plan.name}
                    className={cn(
                      'relative flex flex-col rounded-2xl border bg-card p-8 transition-all hover:shadow-md',
                      plan.highlight
                        ? 'border-primary shadow-md ring-1 ring-primary/20'
                        : 'border-border shadow-sm'
                    )}
                  >
                    {plan.tag && (
                      <Badge className="absolute -top-3 left-6 text-xs">
                        {plan.tag}
                      </Badge>
                    )}
                    <p className="text-lg font-semibold text-foreground">{plan.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {plan.credits.toLocaleString('pt-BR')} créditos mensais incluídos
                    </p>
                    <ul className="mt-6 space-y-2.5 flex-1">
                      {plan.benefits.map((b) => (
                        <li key={b} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                          <Check className="h-4 w-4 mt-0.5 text-primary/70 shrink-0" />
                          {b}
                        </li>
                      ))}
                    </ul>
                    <p className="text-2xl font-bold text-primary mt-6">
                      {formatPrice(priceCents)}
                      <span className="text-sm font-normal text-muted-foreground">
                        /{billingPeriod === 'monthly' ? 'mês' : 'ano'}
                      </span>
                    </p>
                    {billingPeriod === 'yearly' && (
                      <p className="text-xs text-primary/80 mt-1">
                        Economize 16% em relação ao mensal
                      </p>
                    )}
                    <Button className="mt-6 px-8" size="lg" onClick={() => {
                      const priceCents = billingPeriod === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice;
                      handleSubscribe(
                        plan.highlight ? 'combo_completo' : 'combo_pro_select2k',
                        plan.name,
                        priceCents
                      );
                    }}>
                      {plan.buttonLabel}
                    </Button>
                    {billingPeriod === 'yearly' && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-2">
                        <Info className="h-3 w-3 shrink-0 text-primary" />
                        Renovação manual após 12 meses
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* INSTITUTIONAL BUTTONS */}
          <div className="flex justify-center gap-4 pb-20">
            <Button variant="outline" className="px-6" onClick={() => toast.info('Em breve!')}>
              Conheça o Select
            </Button>
            <Button variant="outline" className="px-6" onClick={() => toast.info('Em breve!')}>
              Conheça o Transfer
            </Button>
          </div>

          {/* COMPARISON TABLE */}
          <section className="container max-w-5xl pb-20 space-y-8">
            <h2 className="text-2xl font-bold tracking-tight text-center text-foreground">
              Comparação de Planos
            </h2>
            <div className="overflow-x-auto rounded-2xl border shadow-sm bg-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-6 py-4 font-medium text-muted-foreground w-1/4">Recurso</th>
                    <th className="text-center px-6 py-4 font-semibold text-foreground">Select Avulso</th>
                    <th className="text-center px-6 py-4 font-semibold text-foreground">Studio Pro + Select</th>
                    <th className="text-center px-6 py-4 font-semibold text-foreground">
                      <div className="flex items-center justify-center gap-2">
                        Studio Pro + Select + Transfer
                        <Badge className="text-[10px]">Completo</Badge>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON_ROWS.map((row, i) => (
                    <tr key={row.label} className={cn('border-b last:border-0', i % 2 === 0 && 'bg-muted/10')}>
                      <td className="px-6 py-4 font-medium text-foreground">{row.label}</td>
                      {(['avulso', 'pro', 'full'] as const).map((col) => {
                        const val = row[col];
                        return (
                          <td key={col} className="px-6 py-4 text-center">
                            {val === true ? (
                              <Check className="h-4 w-4 text-primary mx-auto" />
                            ) : val === false ? (
                              <Minus className="h-4 w-4 text-muted-foreground/40 mx-auto" />
                            ) : (
                              <span className="text-foreground">{val}</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {/* ═══════════════════════════════════
           TRANSFER TAB
         ═══════════════════════════════════ */}
      {activeTab === 'transfer' && (
        <>
          {/* Upgrade banner */}
          {isUpgradeMode && currentPlanType && (
            <section className="container max-w-6xl -mt-12 md:-mt-16 relative z-[2] pb-4">
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-5 flex items-start gap-3">
                <ArrowUp className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    Seu plano atual: <span className="text-primary">{getPlanDisplayName(currentPlanType)}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Você pagará apenas a diferença proporcional ao período restante ({daysRemaining} dias restantes).
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* Billing toggle */}
          <section className={cn("container max-w-6xl relative z-[1] pb-8", !isUpgradeMode && "-mt-12 md:-mt-16")}>
            <div className="flex justify-center">
              <BillingToggle billingPeriod={billingPeriod} onChange={setBillingPeriod} discount="-20%" />
            </div>
          </section>

          {/* Transfer plan cards */}
          <section className="container max-w-6xl pb-20 relative z-[1]">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {TRANSFER_PLANS.map((plan) => {
                const effectiveBilling = billingPeriod === 'monthly' ? 'MONTHLY' : 'YEARLY';
                const price = effectiveBilling === 'YEARLY' ? plan.yearlyPrice : plan.monthlyPrice;
                const altPrice = effectiveBilling === 'YEARLY' ? plan.monthlyPrice : plan.yearlyPrice;
                const monthlyEquiv = effectiveBilling === 'YEARLY'
                  ? formatPrice(Math.round(plan.yearlyPrice / 12))
                  : null;

                const planKey = `transfer_${plan.storage.toLowerCase()}`;
                const isCurrentPlan = isUpgradeMode && planKey === currentPlanType;
                const isDowngrade = isUpgradeMode && currentPlanPrices && (
                  effectiveBilling === 'YEARLY'
                    ? plan.yearlyPrice <= currentPriceCents
                    : plan.monthlyPrice <= currentPriceCents
                );

                // Prorata calculation: credit = currentPrice * (daysRemaining / cycleDays), net = newPrice - credit
                let prorataValue: number | null = null;
                if (isUpgradeMode && !isCurrentPlan && !isDowngrade) {
                  const newPrice = effectiveBilling === 'YEARLY' ? plan.yearlyPrice : plan.monthlyPrice;
                  const creditCents = Math.round(currentPriceCents * (daysRemaining / totalCycleDays));
                  prorataValue = Math.max(0, newPrice - creditCents);
                }

                return (
                  <div
                    key={plan.name}
                    className={cn(
                      'relative flex flex-col rounded-2xl border bg-card p-8 transition-all hover:shadow-md',
                      isCurrentPlan
                        ? 'border-primary/50 bg-primary/5 opacity-80'
                        : isDowngrade
                          ? 'border-border shadow-sm'
                          : plan.highlight
                            ? 'border-primary shadow-md ring-1 ring-primary/20'
                            : 'border-border shadow-sm'
                    )}
                  >
                    {isCurrentPlan && (
                      <Badge variant="secondary" className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs">
                        Plano atual
                      </Badge>
                    )}
                    {!isCurrentPlan && !isDowngrade && plan.tag && (
                      <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs gap-1">
                        <Star className="h-3 w-3" />
                        {plan.tag}
                      </Badge>
                    )}

                    <div className="flex items-center gap-2">
                      <HardDrive className="h-5 w-5 text-primary/70" />
                      <p className="text-lg font-semibold text-foreground">{plan.name}</p>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">Armazenamento mensal</p>

                    <p className="text-3xl font-bold text-primary mt-5">
                      {formatPrice(price)}
                      <span className="text-sm font-normal text-muted-foreground">
                        /{effectiveBilling === 'YEARLY' ? 'ano' : 'mês'}
                      </span>
                    </p>

                    {(
                      billingPeriod === 'monthly' ? (
                        <p className="text-xs text-muted-foreground mt-1">
                          Ou {formatPrice(altPrice)} por ano (20% off)
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground mt-1">
                          Equivale a {monthlyEquiv}/mês
                        </p>
                      )
                    )}

                    {isUpgradeMode && prorataValue !== null && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Crédito do plano atual: {formatPrice(Math.round(currentPriceCents * (daysRemaining / totalCycleDays)))}
                      </p>
                    )}

                    {prorataValue !== null && (
                      <p className="text-sm font-medium text-primary mt-2">
                        Pagar agora: {formatPrice(prorataValue)} <span className="text-xs font-normal text-muted-foreground">(proporcional)</span>
                      </p>
                    )}

                    {isCurrentPlan ? (
                      <Button className="mt-6 px-8" size="lg" disabled>
                        Plano atual
                      </Button>
                    ) : isDowngrade ? (
                      <Button
                        variant="outline"
                        className="mt-6 px-8 gap-1.5"
                        size="lg"
                        onClick={() => {
                          setDowngradeConfirmed(false);
                          setDowngradeDialog({
                            planType: planKey,
                            planName: `Transfer ${plan.name}`,
                            billingCycle: effectiveBilling,
                          });
                        }}
                      >
                        <ArrowDown className="h-4 w-4" />
                        Agendar downgrade
                      </Button>
                    ) : (
                      <Button className="mt-6 px-8" size="lg" onClick={() => {
                        handleSubscribe(
                          planKey,
                          `Transfer ${plan.name}`,
                          price
                        );
                      }}>
                        {isUpgradeMode ? 'Fazer upgrade' : 'Assinar'}
                      </Button>
                    )}

                    {billingPeriod === 'yearly' && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-2">
                        <Info className="h-3 w-3 shrink-0 text-primary" />
                        Renovação manual após 12 meses
                      </p>
                    )}

                    <ul className="mt-6 space-y-2.5 flex-1">
                      {BENEFITS_TRANSFER.map(({ icon: Icon, label }) => (
                        <li key={label} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                          <Icon className="h-4 w-4 text-primary/70 shrink-0" />
                          {label}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Transfer combo block */}
          <section className="container max-w-5xl pb-20 space-y-8">
            <div className="text-center space-y-3">
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
                Integre com gestão e seleção
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                Combine armazenamento com gestão completa e seleção profissional.
              </p>
            </div>

            <div className="rounded-2xl border border-primary/50 bg-primary/5 p-8 transition-all hover:shadow-md">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div className="space-y-2">
                  <p className="text-lg font-semibold text-foreground">{TRANSFER_COMBO.name}</p>
                  <p className="text-3xl font-bold text-primary">
                    {formatPrice(billingPeriod === 'monthly' ? TRANSFER_COMBO.monthlyPrice : TRANSFER_COMBO.yearlyPrice)}
                    <span className="text-sm font-normal text-muted-foreground">
                      /{billingPeriod === 'monthly' ? 'mês' : 'ano'}
                    </span>
                  </p>
                  {billingPeriod === 'yearly' && (
                    <p className="text-xs text-primary/80">
                      Equivale a {formatPrice(Math.round(TRANSFER_COMBO.yearlyPrice / 12))}/mês
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <Button size="lg" className="px-8 shrink-0" onClick={() => {
                    const comboPrice = billingPeriod === 'monthly' ? TRANSFER_COMBO.monthlyPrice : TRANSFER_COMBO.yearlyPrice;
                    handleSubscribe('combo_completo', TRANSFER_COMBO.name, comboPrice);
                  }}>
                    Conhecer plano completo
                  </Button>
                  {billingPeriod === 'yearly' && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Info className="h-3 w-3 shrink-0 text-primary" />
                      Renovação manual após 12 meses
                    </p>
                  )}
                </div>
              </div>
            </div>
          </section>
        </>
      )}

      {/* Downgrade confirmation dialog */}
      <Dialog open={!!downgradeDialog} onOpenChange={(open) => {
        if (!open) {
          setDowngradeDialog(null);
          setDowngradeConfirmed(false);
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Agendar downgrade
            </DialogTitle>
            <DialogDescription className="space-y-3 pt-2">
              <p>
                Seu plano será alterado para{' '}
                <span className="font-semibold text-foreground">
                  {downgradeDialog ? getPlanDisplayName(downgradeDialog.planType) : ''}
                </span>{' '}
                no próximo ciclo de cobrança.
              </p>
              {isOverLimitOnDowngrade && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-2">
                  <p className="text-sm font-medium text-destructive">
                    Seu novo plano permite {formatStorageSize(newDowngradeLimitBytes)}.
                  </p>
                  <p className="text-sm text-destructive/90">
                    Você possui {formatStorageSize(storageUsedBytes)} armazenados.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    As galerias excedentes serão expiradas. Se não forem excluídas manualmente,
                    serão removidas permanentemente em 30 dias.
                  </p>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>

          {isOverLimitOnDowngrade && (
            <div className="flex items-start gap-3 py-2">
              <Checkbox
                id="downgrade-confirm"
                checked={downgradeConfirmed}
                onCheckedChange={(checked) => setDowngradeConfirmed(checked === true)}
              />
              <label
                htmlFor="downgrade-confirm"
                className="text-sm text-muted-foreground cursor-pointer leading-relaxed"
              >
                Entendo que galerias acima do limite poderão ser excluídas após 30 dias.
              </label>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setDowngradeDialog(null);
                setDowngradeConfirmed(false);
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={isDowngrading || (isOverLimitOnDowngrade && !downgradeConfirmed)}
              onClick={handleDowngrade}
            >
              {isDowngrading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Agendando...
                </>
              ) : (
                'Confirmar downgrade'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

/* ═══════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════ */

function BillingToggle({
  billingPeriod,
  onChange,
  discount = '-16%',
}: {
  billingPeriod: 'monthly' | 'yearly';
  onChange: (v: 'monthly' | 'yearly') => void;
  discount?: string;
}) {
  return (
    <div className="inline-flex items-center rounded-full border bg-muted/50 p-1 gap-0.5">
      <button
        onClick={() => onChange('monthly')}
        className={cn(
          'rounded-full px-5 py-2 text-sm font-medium transition-all',
          billingPeriod === 'monthly'
            ? 'bg-card text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        Mensal
      </button>
      <button
        onClick={() => onChange('yearly')}
        className={cn(
          'rounded-full px-5 py-2 text-sm font-medium transition-all flex items-center gap-2',
          billingPeriod === 'yearly'
            ? 'bg-card text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        Anual
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
          {discount}
        </Badge>
      </button>
    </div>
  );
}
