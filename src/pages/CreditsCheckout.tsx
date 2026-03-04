import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCreditPackages, CreditPackage } from '@/hooks/useCreditPackages';
import { useAsaasSubscription, AsaasSubscription } from '@/hooks/useAsaasSubscription';
import { useTransferStorage } from '@/hooks/useTransferStorage';
import { useUnifiedPlans } from '@/hooks/useUnifiedPlans';
import { useCouponValidation } from '@/hooks/useCouponValidation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
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
  Tag,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getStorageLimitBytes, formatStorageSize, getPlanHierarchyLevel, isSubActiveForPlan, getPlanDisplayName } from '@/lib/transferPlans';
import { differenceInDays } from 'date-fns';


/* ═══════════════════════════════════════════
   STATIC DATA (non-price)
   ═══════════════════════════════════════════ */

const BENEFITS_AVULSO = [
  { icon: Image, label: 'Galerias ilimitadas' },
  { icon: Users, label: 'Clientes ilimitados' },
  { icon: Camera, label: 'Até 2560px de resolução' },
  { icon: Palette, label: 'Presets de galerias' },
  { icon: ShieldCheck, label: 'Sem taxa ou comissão' },
];

const BENEFITS_TRANSFER = [
  { icon: Users, label: 'Galerias atreladas ao cliente' },
  { icon: Camera, label: 'Entrega profissional' },
  { icon: ShieldCheck, label: 'Acesso rápido e estável' },
  { icon: Image, label: 'Expansão conforme necessidade' },
  { icon: Check, label: 'Download do arquivo original' },
];

/* Fallback static data used when dynamic plans haven't loaded */
const FALLBACK_COMBO_PLANS = [
  {
    code: 'combo_pro_select2k',
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
    code: 'combo_completo',
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

const FALLBACK_TRANSFER_PLANS = [
  { code: 'transfer_5gb', name: '5GB', monthlyPrice: 1290, yearlyPrice: 12384, storage: '5GB', highlight: false },
  { code: 'transfer_20gb', name: '20GB', monthlyPrice: 2490, yearlyPrice: 23904, storage: '20GB', highlight: true, tag: 'Mais escolhido' },
  { code: 'transfer_50gb', name: '50GB', monthlyPrice: 3490, yearlyPrice: 33504, storage: '50GB', highlight: false },
  { code: 'transfer_100gb', name: '100GB', monthlyPrice: 5990, yearlyPrice: 57504, storage: '100GB', highlight: false },
];

const COMPARISON_ROWS = [
  { label: 'Preço', avulso: 'A partir de R$ 19,90', pro: '', full: '' }, // prices filled dynamically
  { label: 'Clientes ilimitados', avulso: true, pro: true, full: true },
  { label: 'Galerias ilimitadas', avulso: true, pro: true, full: true },
  { label: 'Resolução até 2560px', avulso: true, pro: true, full: true },
  { label: 'Créditos mensais', avulso: false, pro: '2.000', full: '2.000' },
  { label: 'Armazenamento', avulso: false, pro: false, full: '20GB' },
  { label: 'Gestão de clientes', avulso: false, pro: true, full: true },
  { label: 'Controle financeiro', avulso: false, pro: true, full: true },
  { label: 'Entrega profissional', avulso: false, pro: false, full: true },
];

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

  // Dynamic pricing from unified_plans
  const { getPlanPrice, getPlanName: dynamicPlanName, getAllPlanPrices, getPlanIncludes, getTransferPlans, getComboPlans, isLoading: isLoadingPlans } = useUnifiedPlans();

  // Coupon
  const { coupon, isValidating: isValidatingCoupon, validateCoupon, clearCoupon } = useCouponValidation();
  const [couponInput, setCouponInput] = useState('');

  // Dynamic plan prices (backward compat)
  const ALL_PLAN_PRICES = getAllPlanPrices();
  const PLAN_INCLUDES = getPlanIncludes();

  // Build transfer plans from dynamic data or fallback
  const dynamicTransfer = getTransferPlans();
  const TRANSFER_PLANS = dynamicTransfer
    ? dynamicTransfer.map((p) => ({
        code: p.code,
        name: p.name.replace('Transfer ', '').replace('transfer_', ''),
        monthlyPrice: p.monthly_price_cents,
        yearlyPrice: p.yearly_price_cents,
        storage: formatStorageSize(p.transfer_storage_bytes),
        highlight: p.code === 'transfer_20gb',
        tag: p.code === 'transfer_20gb' ? 'Mais escolhido' : undefined,
      }))
    : FALLBACK_TRANSFER_PLANS;

  // Build combo plans from dynamic data or fallback
  const dynamicCombos = getComboPlans();
  const COMBO_PLANS = dynamicCombos
    ? dynamicCombos.map((p) => ({
        code: p.code,
        name: p.name,
        monthlyPrice: p.monthly_price_cents,
        yearlyPrice: p.yearly_price_cents,
        credits: p.select_credits_monthly,
        benefits: p.code === 'combo_completo'
          ? ['Gestão completa', `${p.select_credits_monthly.toLocaleString('pt-BR')} créditos mensais`, `${formatStorageSize(p.transfer_storage_bytes)} de armazenamento profissional`, 'Entrega profissional no seu estilo']
          : ['Sistema completo de gestão', `${p.select_credits_monthly.toLocaleString('pt-BR')} créditos mensais`, 'Integração automática com Gallery', 'Controle de clientes', 'Fluxo de trabalho', 'Automações de pagamentos'],
        buttonLabel: 'Assinar',
        highlight: p.code === 'combo_completo',
        tag: p.code === 'combo_completo' ? 'Mais completo' : undefined,
      }))
    : FALLBACK_COMBO_PLANS;

  // Transfer combo card
  const comboCompletoData = COMBO_PLANS.find((p) => p.code === 'combo_completo');
  const TRANSFER_COMBO = {
    name: comboCompletoData?.name || 'Studio Pro + Select 2k + Transfer 20GB',
    monthlyPrice: comboCompletoData?.monthlyPrice || 6490,
    yearlyPrice: comboCompletoData?.yearlyPrice || 66198,
  };

  // Comparison row prices (dynamic)
  const proMonthly = getPlanPrice('combo_pro_select2k', 'monthly');
  const fullMonthly = getPlanPrice('combo_completo', 'monthly');
  const comparisonRows = COMPARISON_ROWS.map((row) => {
    if (row.label === 'Preço') {
      return {
        ...row,
        pro: `R$ ${(proMonthly / 100).toFixed(2).replace('.', ',')}/mês`,
        full: `R$ ${(fullMonthly / 100).toFixed(2).replace('.', ',')}/mês`,
      };
    }
    return row;
  });

  // Upgrade mode: auto-detect from hook OR from URL params
  const urlUpgradeMode = searchParams.get('upgrade') === 'true';
  const urlCurrentPlan = searchParams.get('current_plan') || '';
  const urlBillingCycle = searchParams.get('billing_cycle') || 'MONTHLY';
  const urlNextDueDate = searchParams.get('next_due_date') || '';
  const urlSubscriptionId = searchParams.get('subscription_id') || '';

  // Auto-detect: if there's an active transfer sub and we're on transfer tab
  const hasActiveTransferSub = !!transferSub && (transferSub.status === 'ACTIVE' || transferSub.status === 'PENDING' || transferSub.status === 'OVERDUE') && activeTab === 'transfer';
  const isUpgradeMode = urlUpgradeMode || hasActiveTransferSub;

  // All active subs for cross-product detection
  const activeSubs = allSubs.filter(s => s.status === 'ACTIVE' || s.status === 'PENDING' || s.status === 'OVERDUE');

  // For transfer tab, the "current" sub is the transfer sub specifically
  const currentPlanType = activeTab === 'transfer'
    ? (transferSub?.plan_type || urlCurrentPlan)
    : (activeSub?.plan_type || urlCurrentPlan);
  const currentSub = activeTab === 'transfer' ? transferSub : activeSub;
  const currentBillingCycle = currentSub?.billing_cycle || urlBillingCycle;
  const nextDueDate = currentSub?.next_due_date || urlNextDueDate;
  const currentSubscriptionId = currentSub?.id || urlSubscriptionId;

  const currentPlanPrices = ALL_PLAN_PRICES[currentPlanType];
  const currentPriceCents = currentPlanPrices
    ? (currentBillingCycle === 'YEARLY' ? currentPlanPrices.yearly : currentPlanPrices.monthly)
    : 0;

  const stdCycleDays = currentBillingCycle === 'YEARLY' ? 365 : 30;
  const daysRemaining = nextDueDate ? Math.min(Math.max(0, differenceInDays(new Date(nextDueDate), new Date())), stdCycleDays) : 0;
  const totalCycleDays = stdCycleDays;

  /** Find active subs whose capabilities overlap with the target plan */
  function getOverlappingSubs(targetPlanType: string): AsaasSubscription[] {
    const targetIncludes = PLAN_INCLUDES[targetPlanType];
    if (!targetIncludes) return [];
    return activeSubs.filter(sub => {
      if (sub.plan_type === targetPlanType) return false;
      const subIncludes = PLAN_INCLUDES[sub.plan_type];
      if (!subIncludes) return false;
      return (targetIncludes.studio && subIncludes.studio) ||
             (targetIncludes.select && subIncludes.select) ||
             (targetIncludes.transfer && subIncludes.transfer);
    });
  }

  /** Calculate combined prorata credit from overlapping subs */
  function getCrossProductProrata(targetPlanType: string, targetPriceCents: number) {
    const overlapping = getOverlappingSubs(targetPlanType);
    if (overlapping.length === 0) return null;
    let totalCreditCents = 0;
    const idsToCancel: string[] = [];
    for (const sub of overlapping) {
      const subPrices = ALL_PLAN_PRICES[sub.plan_type];
      if (!subPrices) continue;
      const subPriceCents = sub.billing_cycle === 'YEARLY' ? subPrices.yearly : subPrices.monthly;
      const subDaysRemaining = sub.next_due_date
        ? Math.max(0, differenceInDays(new Date(sub.next_due_date), new Date()))
        : 0;
      const subCycleDays = sub.billing_cycle === 'YEARLY' ? 365 : 30;
      const cappedSubDays = Math.min(subDaysRemaining, subCycleDays);
      const rawCredit = Math.round(subPriceCents * (cappedSubDays / subCycleDays));
      totalCreditCents += Math.min(rawCredit, subPriceCents);
      idsToCancel.push(sub.id);
    }
    return {
      creditCents: totalCreditCents,
      prorataValueCents: Math.max(0, targetPriceCents - totalCreditCents),
      subscriptionIdsToCancel: idsToCancel,
    };
  }

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
    const selectedCycle = billingPeriod === 'monthly' ? 'MONTHLY' : 'YEARLY';

    // Detect cycle upgrade: same plan, different cycle (e.g. monthly→yearly)
    const existingSubForPlan = allSubs.find(s =>
      s.plan_type === planType &&
      ['ACTIVE', 'PENDING', 'OVERDUE'].includes(s.status)
    );
    const isCycleUpgrade = !!existingSubForPlan && existingSubForPlan.billing_cycle !== selectedCycle;

    // Guard: block only if exact same plan AND same cycle
    if (!isCycleUpgrade && isSubActiveForPlan(allSubs, planType)) {
      toast.error('Você já possui este plano ativo.');
      return;
    }

    // Handle cycle upgrade (e.g. combo_completo MONTHLY → YEARLY)
    if (isCycleUpgrade && existingSubForPlan) {
      const newCyclePriceCents = getPlanPrice(planType, selectedCycle === 'YEARLY' ? 'yearly' : 'monthly');
      
      // Calculate prorata credit from existing sub
      const existingPriceCents = getPlanPrice(existingSubForPlan.plan_type, existingSubForPlan.billing_cycle === 'YEARLY' ? 'yearly' : 'monthly');
      const existingCycleDays = existingSubForPlan.billing_cycle === 'YEARLY' ? 365 : 30;
      const existingDaysRemaining = existingSubForPlan.next_due_date
        ? Math.min(Math.max(0, differenceInDays(new Date(existingSubForPlan.next_due_date), new Date())), existingCycleDays)
        : 0;
      const creditCents = Math.min(Math.round(existingPriceCents * (existingDaysRemaining / existingCycleDays)), existingPriceCents);
      const finalProrata = Math.max(0, newCyclePriceCents - creditCents);

      navigate('/credits/checkout/pay', {
        state: {
          type: 'subscription',
          planType,
          planName,
          billingCycle: selectedCycle as 'MONTHLY' | 'YEARLY',
          priceCents: newCyclePriceCents,
          isUpgrade: true,
          prorataValueCents: finalProrata,
          currentSubscriptionId: existingSubForPlan.id,
          subscriptionIdsToCancel: [existingSubForPlan.id],
          currentPlanName: dynamicPlanName(existingSubForPlan.plan_type) || getPlanDisplayName(existingSubForPlan.plan_type) || existingSubForPlan.plan_type,
          ...(coupon.valid ? { couponCode: coupon.code } : {}),
        },
      });
      return;
    }

    const newPriceCentsForCycle = getPlanPrice(planType, selectedCycle === 'YEARLY' ? 'yearly' : 'monthly');

    if (isUpgradeMode && currentSubscriptionId) {
      // Same-family upgrade
      const creditCents = Math.min(Math.round(currentPriceCents * (daysRemaining / totalCycleDays)), currentPriceCents);
      const crossProduct = getCrossProductProrata(planType, newPriceCentsForCycle);
      const allIdsToCancel = [currentSubscriptionId];
      let combinedCredit = creditCents;
      if (crossProduct) {
        const extraIds = crossProduct.subscriptionIdsToCancel.filter(id => id !== currentSubscriptionId);
        allIdsToCancel.push(...extraIds);
        combinedCredit += crossProduct.creditCents - (crossProduct.subscriptionIdsToCancel.includes(currentSubscriptionId) ? creditCents : 0);
      }
      const finalProrata = Math.max(0, newPriceCentsForCycle - combinedCredit);

      const cancelNames = allIdsToCancel
        .map(id => activeSubs.find(s => s.id === id))
        .filter(Boolean)
        .map(s => dynamicPlanName(s!.plan_type) || getPlanDisplayName(s!.plan_type))
        .join(' + ');

      navigate('/credits/checkout/pay', {
        state: {
          type: 'subscription',
          planType,
          planName,
          billingCycle: selectedCycle as 'MONTHLY' | 'YEARLY',
          priceCents: newPriceCentsForCycle,
          isUpgrade: true,
          prorataValueCents: finalProrata,
          currentSubscriptionId,
          subscriptionIdsToCancel: allIdsToCancel,
          currentPlanName: cancelNames || dynamicPlanName(currentPlanType) || getPlanDisplayName(currentPlanType) || currentPlanType,
          ...(coupon.valid ? { couponCode: coupon.code } : {}),
        },
      });
    } else {
      // No current sub in this family — check cross-product
      const crossProduct = getCrossProductProrata(planType, newPriceCentsForCycle);
      if (crossProduct && crossProduct.subscriptionIdsToCancel.length > 0) {
        const cancelNames = crossProduct.subscriptionIdsToCancel
          .map(id => activeSubs.find(s => s.id === id))
          .filter(Boolean)
          .map(s => dynamicPlanName(s!.plan_type) || getPlanDisplayName(s!.plan_type))
          .join(' + ');

        navigate('/credits/checkout/pay', {
          state: {
            type: 'subscription',
            planType,
            planName,
            billingCycle: selectedCycle as 'MONTHLY' | 'YEARLY',
            priceCents: newPriceCentsForCycle,
            isUpgrade: true,
            prorataValueCents: crossProduct.prorataValueCents,
            subscriptionIdsToCancel: crossProduct.subscriptionIdsToCancel,
            currentPlanName: cancelNames,
            ...(coupon.valid ? { couponCode: coupon.code } : {}),
          },
        });
      } else {
        navigate('/credits/checkout/pay', {
          state: {
            type: 'subscription',
            planType,
            planName,
            billingCycle: selectedCycle as 'MONTHLY' | 'YEARLY',
            priceCents: newPriceCentsForCycle,
            ...(coupon.valid ? { couponCode: coupon.code } : {}),
          },
        });
      }
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

  // Loading state
  if (isLoadingPlans) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="container max-w-6xl py-3 flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/credits')} className="gap-1.5">
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
          </div>
        </header>
        <div className="container max-w-6xl py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-96 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

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

            {/* Coupon input for subscriptions */}
            <CouponField
              couponInput={couponInput}
              setCouponInput={setCouponInput}
              coupon={coupon}
              isValidating={isValidatingCoupon}
              onValidate={() => validateCoupon(couponInput)}
              onClear={clearCoupon}
            />

            {/* Combo cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {COMBO_PLANS.map((plan) => {
                const priceCents = billingPeriod === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice;
                const comboPlanType = plan.code || (plan.highlight ? 'combo_completo' : 'combo_pro_select2k');
                const isCurrentCombo = isSubActiveForPlan(allSubs, comboPlanType);
                const userHighestLevel = Math.max(...allSubs.filter(s => ['ACTIVE', 'PENDING', 'OVERDUE'].includes(s.status) || (s.status === 'CANCELLED' && s.next_due_date && new Date(s.next_due_date) > new Date())).map(s => getPlanHierarchyLevel(s.plan_type)), 0);
                const cardLevel = getPlanHierarchyLevel(comboPlanType);
                const isInferiorToActive = !isCurrentCombo && userHighestLevel > cardLevel && userHighestLevel >= 100;

                // Cycle upgrade detection
                const activeComboSub = allSubs.find(s => s.plan_type === comboPlanType && ['ACTIVE', 'PENDING', 'OVERDUE'].includes(s.status));
                const currentComboCycle = activeComboSub?.billing_cycle || 'MONTHLY';
                const viewingCycle = billingPeriod === 'monthly' ? 'MONTHLY' : 'YEARLY';
                const isCycleUpgrade = isCurrentCombo && currentComboCycle === 'MONTHLY' && viewingCycle === 'YEARLY';

                // Apply coupon discount for display
                const displayPrice = coupon.valid ? coupon.calculateDiscount(priceCents) : priceCents;

                return (
                  <div
                    key={plan.name}
                    className={cn(
                      'relative flex flex-col rounded-2xl border bg-card p-8 transition-all hover:shadow-md',
                      isCurrentCombo && !isCycleUpgrade
                        ? 'border-primary/50 bg-primary/5 opacity-80'
                        : plan.highlight
                          ? 'border-primary shadow-md ring-1 ring-primary/20'
                          : 'border-border shadow-sm'
                    )}
                  >
                    {isCurrentCombo && !isCycleUpgrade && (
                      <Badge variant="secondary" className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs">
                        Plano atual
                      </Badge>
                    )}
                    {isCycleUpgrade && (
                      <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs gap-1">
                        <ArrowUp className="h-3 w-3" />
                        Mudar para anual
                      </Badge>
                    )}
                    {!isCurrentCombo && plan.tag && (
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
                    <div className="mt-6">
                      {coupon.valid && displayPrice !== priceCents ? (
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground line-through">
                            {formatPrice(priceCents)}
                          </p>
                          <p className="text-2xl font-bold text-primary">
                            {formatPrice(displayPrice)}
                            <span className="text-sm font-normal text-muted-foreground">
                              /{billingPeriod === 'monthly' ? 'mês' : 'ano'}
                            </span>
                          </p>
                        </div>
                      ) : (
                        <p className="text-2xl font-bold text-primary">
                          {formatPrice(priceCents)}
                          <span className="text-sm font-normal text-muted-foreground">
                            /{billingPeriod === 'monthly' ? 'mês' : 'ano'}
                          </span>
                        </p>
                      )}
                    </div>
                    {billingPeriod === 'yearly' && (
                      <p className="text-xs text-primary/80 mt-1">
                        Economize 16% em relação ao mensal
                      </p>
                    )}
                    {isCycleUpgrade ? (
                      <Button className="mt-6 px-8" size="lg" onClick={() => {
                        handleSubscribe(comboPlanType, plan.name, priceCents);
                      }}>
                        <ArrowUp className="h-4 w-4 mr-1.5" />
                        Mudar para anual
                      </Button>
                    ) : isCurrentCombo ? (
                      <Button className="mt-6 px-8" size="lg" variant="outline" onClick={() => navigate('/credits/subscription')}>
                        Gerenciar assinatura
                      </Button>
                    ) : isInferiorToActive ? (
                      <Button className="mt-6 px-8" size="lg" variant="outline" disabled>
                        <ArrowDown className="h-4 w-4 mr-1.5" />
                        Plano inferior ao atual
                      </Button>
                    ) : (
                      <Button className="mt-6 px-8" size="lg" onClick={() => {
                        handleSubscribe(comboPlanType, plan.name, priceCents);
                      }}>
                        {plan.buttonLabel}
                      </Button>
                    )}
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
                  {comparisonRows.map((row, i) => (
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
                    Seu plano atual: <span className="text-primary">{dynamicPlanName(currentPlanType) || getPlanDisplayName(currentPlanType)}</span>
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

          {/* Coupon input for transfer subscriptions */}
          <section className="container max-w-6xl pb-6 relative z-[1]">
            <CouponField
              couponInput={couponInput}
              setCouponInput={setCouponInput}
              coupon={coupon}
              isValidating={isValidatingCoupon}
              onValidate={() => validateCoupon(couponInput)}
              onClear={clearCoupon}
            />
          </section>

          {/* Transfer plan cards */}
          <section className="container max-w-6xl pb-20 relative z-[1]">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {TRANSFER_PLANS.map((plan) => {
                const effectiveBilling = billingPeriod === 'monthly' ? 'MONTHLY' : 'YEARLY';
                const price = effectiveBilling === 'YEARLY' ? plan.yearlyPrice : plan.monthlyPrice;
                const monthlyEquiv = effectiveBilling === 'YEARLY'
                  ? formatPrice(Math.round(plan.yearlyPrice / 12))
                  : null;

                const planKey = plan.code || `transfer_${plan.storage.toLowerCase()}`;
                const isCurrentPlan = isUpgradeMode && planKey === currentPlanType;

                // Hierarchy-based downgrade
                const cardHierarchy = getPlanHierarchyLevel(planKey);
                const highestActiveLevel = Math.max(
                  ...activeSubs.map(s => getPlanHierarchyLevel(s.plan_type)), 0
                );
                const isDowngrade = isUpgradeMode && !isCurrentPlan && highestActiveLevel > cardHierarchy;

                // Prorata calculation
                let prorataValue: number | null = null;
                let creditDisplay: number | null = null;
                if (isUpgradeMode && !isCurrentPlan && !isDowngrade) {
                  const newPrice = effectiveBilling === 'YEARLY' ? plan.yearlyPrice : plan.monthlyPrice;
                  const transferCreditCents = Math.min(Math.round(currentPriceCents * (daysRemaining / totalCycleDays)), currentPriceCents);
                  const crossProduct = getCrossProductProrata(planKey, newPrice);
                  let combinedCredit = transferCreditCents;
                  if (crossProduct) {
                    const extraCredit = crossProduct.creditCents - (crossProduct.subscriptionIdsToCancel.includes(currentSubscriptionId) ? transferCreditCents : 0);
                    combinedCredit += extraCredit;
                  }
                  creditDisplay = combinedCredit;
                  prorataValue = Math.max(0, newPrice - combinedCredit);
                }

                // Apply coupon discount for display
                const displayPrice = coupon.valid ? coupon.calculateDiscount(price) : price;

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

                    <div className="mt-5">
                      <div className="flex items-center gap-2 flex-wrap">
                        {coupon.valid && displayPrice !== price ? (
                          <div className="space-y-1">
                            <p className="text-sm text-muted-foreground line-through">
                              {formatPrice(price)}
                            </p>
                            <p className="text-3xl font-bold text-primary">
                              {formatPrice(displayPrice)}
                              <span className="text-sm font-normal text-muted-foreground">
                                /{effectiveBilling === 'YEARLY' ? 'ano' : 'mês'}
                              </span>
                            </p>
                          </div>
                        ) : (
                          <p className="text-3xl font-bold text-primary">
                            {formatPrice(price)}
                            <span className="text-sm font-normal text-muted-foreground">
                              /{effectiveBilling === 'YEARLY' ? 'ano' : 'mês'}
                            </span>
                          </p>
                        )}
                        {effectiveBilling === 'YEARLY' && (
                          <Badge variant="secondary" className="text-[10px] px-2 py-0.5">
                            Até 12x sem juros
                          </Badge>
                        )}
                      </div>
                      {effectiveBilling === 'YEARLY' && (
                        <p className="text-xs text-muted-foreground mt-1">
                          apenas {monthlyEquiv}/mês
                        </p>
                      )}
                    </div>

                    {isUpgradeMode && creditDisplay !== null && creditDisplay > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Crédito de planos ativos: {formatPrice(creditDisplay)}
                      </p>
                    )}

                    {prorataValue !== null && (
                      <p className="text-sm font-medium text-primary mt-2">
                        Pagar agora: {formatPrice(prorataValue)}
                      </p>
                    )}

                    <div className="mt-auto pt-6">
                    {isCurrentPlan ? (
                      <Button className="w-full px-8" size="lg" disabled>
                        Plano atual
                      </Button>
                    ) : isDowngrade ? (
                      <Button
                        variant="outline"
                        className="w-full px-8 gap-1.5"
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
                      <Button className="w-full px-8" size="lg" onClick={() => {
                        handleSubscribe(
                          planKey,
                          `Transfer ${plan.name}`,
                          price
                        );
                      }}>
                        {isUpgradeMode ? 'Fazer upgrade' : 'Assinar'}
                      </Button>
                    )}
                    </div>

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

            {(() => {
              const isCurrentComboCompleto = isSubActiveForPlan(allSubs, 'combo_completo');
              const comboPrice = billingPeriod === 'monthly' ? TRANSFER_COMBO.monthlyPrice : TRANSFER_COMBO.yearlyPrice;

              // Cycle upgrade
              const activeComboSub = allSubs.find(s => s.plan_type === 'combo_completo' && ['ACTIVE', 'PENDING', 'OVERDUE'].includes(s.status));
              const currentComboCycle = activeComboSub?.billing_cycle || 'MONTHLY';
              const viewingCycle = billingPeriod === 'monthly' ? 'MONTHLY' : 'YEARLY';
              const isCycleUpgrade = isCurrentComboCompleto && currentComboCycle === 'MONTHLY' && viewingCycle === 'YEARLY';

              const displayComboPrice = coupon.valid ? coupon.calculateDiscount(comboPrice) : comboPrice;

              return (
                <div className={cn(
                  "rounded-2xl border p-8 transition-all hover:shadow-md",
                  isCurrentComboCompleto && !isCycleUpgrade
                    ? "border-primary/50 bg-primary/5 opacity-80"
                    : "border-primary/50 bg-primary/5"
                )}>
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                    <div className="space-y-2">
                      {isCurrentComboCompleto && !isCycleUpgrade && (
                        <Badge variant="secondary" className="text-xs mb-2">
                          Plano atual
                        </Badge>
                      )}
                      {isCycleUpgrade && (
                        <Badge className="text-xs mb-2 gap-1">
                          <ArrowUp className="h-3 w-3" />
                          Mudar para anual
                        </Badge>
                      )}
                      <p className="text-lg font-semibold text-foreground">{TRANSFER_COMBO.name}</p>
                      {coupon.valid && displayComboPrice !== comboPrice ? (
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground line-through">{formatPrice(comboPrice)}</p>
                          <p className="text-3xl font-bold text-primary">
                            {formatPrice(displayComboPrice)}
                            <span className="text-sm font-normal text-muted-foreground">
                              /{billingPeriod === 'monthly' ? 'mês' : 'ano'}
                            </span>
                          </p>
                        </div>
                      ) : (
                        <p className="text-3xl font-bold text-primary">
                          {formatPrice(comboPrice)}
                          <span className="text-sm font-normal text-muted-foreground">
                            /{billingPeriod === 'monthly' ? 'mês' : 'ano'}
                          </span>
                        </p>
                      )}
                      {billingPeriod === 'yearly' && (
                        <>
                          <Badge variant="secondary" className="text-[10px] px-2 py-0.5 w-fit">
                            Até 12x sem juros
                          </Badge>
                          <p className="text-xs text-muted-foreground">
                            apenas {formatPrice(Math.round(TRANSFER_COMBO.yearlyPrice / 12))}/mês
                          </p>
                        </>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      {isCycleUpgrade ? (
                        <Button size="lg" className="px-8 shrink-0" onClick={() => {
                          handleSubscribe('combo_completo', TRANSFER_COMBO.name, comboPrice);
                        }}>
                          <ArrowUp className="h-4 w-4 mr-1.5" />
                          Mudar para anual
                        </Button>
                      ) : isCurrentComboCompleto ? (
                        <Button size="lg" className="px-8 shrink-0" variant="outline" onClick={() => navigate('/credits/subscription')}>
                          Gerenciar assinatura
                        </Button>
                      ) : (
                        <Button size="lg" className="px-8 shrink-0" onClick={() => {
                          handleSubscribe('combo_completo', TRANSFER_COMBO.name, comboPrice);
                        }}>
                          Conhecer plano completo
                        </Button>
                      )}
                      {billingPeriod === 'yearly' && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <Info className="h-3 w-3 shrink-0 text-primary" />
                          Renovação manual após 12 meses
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
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
                  {downgradeDialog ? (dynamicPlanName(downgradeDialog.planType) || getPlanDisplayName(downgradeDialog.planType)) : ''}
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

function CouponField({
  couponInput,
  setCouponInput,
  coupon,
  isValidating,
  onValidate,
  onClear,
}: {
  couponInput: string;
  setCouponInput: (v: string) => void;
  coupon: { valid: boolean; code: string; discountType: string; discountValue: number; error?: string };
  isValidating: boolean;
  onValidate: () => void;
  onClear: () => void;
}) {
  if (coupon.valid) {
    return (
      <div className="flex items-center justify-center gap-2">
        <div className="inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2">
          <Tag className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-primary">{coupon.code}</span>
          <span className="text-xs text-muted-foreground">
            ({coupon.discountType === 'percentage' ? `${coupon.discountValue}% off` : `R$ ${(coupon.discountValue / 100).toFixed(2)} off`})
          </span>
          <button
            onClick={() => {
              onClear();
              setCouponInput('');
            }}
            className="ml-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-2">
      <div className="flex items-center gap-2 max-w-xs">
        <Input
          placeholder="Cupom de desconto"
          value={couponInput}
          onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === 'Enter' && onValidate()}
          className="h-9 text-sm"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={onValidate}
          disabled={isValidating || !couponInput.trim()}
          className="gap-1.5 shrink-0"
        >
          {isValidating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Tag className="h-3.5 w-3.5" />}
          Aplicar
        </Button>
      </div>
      {coupon.error && (
        <p className="text-xs text-destructive">{coupon.error}</p>
      )}
    </div>
  );
}
