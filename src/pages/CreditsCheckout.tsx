import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCreditPackages, CreditPackage } from '@/hooks/useCreditPackages';
import { usePhotoCredits } from '@/hooks/usePhotoCredits';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft,
  Camera,
  Check,
  Image,
  Users,
  Palette,
  ShieldCheck,
  Minus,
  Star } from
'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const BENEFITS_AVULSO = [
{ icon: Image, label: 'Galerias ilimitadas' },
{ icon: Users, label: 'Clientes ilimitados' },
{ icon: Camera, label: 'Até 2560px de resolução' },
{ icon: Palette, label: 'Presets de galerias' },
{ icon: ShieldCheck, label: 'Sem taxa ou comissão' }];


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
  'Automações de pagamentos'],

  buttonLabel: 'Assinar',
  highlight: false
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
  'Entrega profissional no seu estilo'],

  buttonLabel: 'Assinar',
  highlight: true,
  tag: 'Mais completo'
}];


const COMPARISON_ROWS = [
{ label: 'Preço', avulso: 'A partir de R$ 19,90', pro: 'R$ 44,90/mês', full: 'R$ 64,90/mês' },
{ label: 'Clientes ilimitados', avulso: true, pro: true, full: true },
{ label: 'Galerias ilimitadas', avulso: true, pro: true, full: true },
{ label: 'Resolução até 2560px', avulso: true, pro: true, full: true },
{ label: 'Créditos mensais', avulso: false, pro: '2.000', full: '2.000' },
{ label: 'Armazenamento', avulso: false, pro: false, full: '20GB' },
{ label: 'Gestão de clientes', avulso: false, pro: true, full: true },
{ label: 'Controle financeiro', avulso: false, pro: true, full: true },
{ label: 'Entrega profissional', avulso: false, pro: false, full: true }];


export default function CreditsCheckout() {
  const navigate = useNavigate();
  const { packages, isLoadingPackages } = useCreditPackages();
  const { photoCredits } = usePhotoCredits();
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');

  const avulsos = packages?.filter((p) => p.sort_order < 10) || [];

  const formatPrice = (cents: number) =>
  (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const handleBuy = (pkg: CreditPackage) => {
    navigate('/credits/checkout/pay', {
      state: {
        packageId: pkg.id,
        packageName: pkg.name,
        credits: pkg.credits,
        priceCents: pkg.price_cents
      }
    });
  };

  const handleComboSubscribe = () => {
    toast.info('Em breve!');
  };

  // Select 10k highlight (sort_order === 3 typically)
  const isHighlighted = (pkg: CreditPackage) => pkg.sort_order === 3;

  return (
    <div className="min-h-screen bg-gray-50">
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
        <div className="absolute inset-0 bg-gradient-to-b from-primary/8 via-primary/3 to-transparent bg-gray-50" />
        <div className="relative container max-w-6xl pt-16 pb-40 md:pb-48 text-center space-y-6">
          <Badge variant="secondary" className="text-xs tracking-wider uppercase">
            Créditos
          </Badge>
          <h1 className="text-2xl md:text-4xl font-bold tracking-tight text-foreground max-w-2xl mx-auto text-balance">
            Organize e profissionalize o processo de seleção de fotos
          </h1>
          <p className="text-muted-foreground text-base md:text-lg max-w-xl mx-auto">
            Créditos flexíveis, sem validade e sem mensalidade.
          </p>

          {/* Balance pill */}
          <div className="inline-flex flex-col items-center gap-1.5 rounded-2xl border bg-card/80 backdrop-blur-sm px-8 py-4 shadow-sm">
            <span className="text-sm text-muted-foreground">Créditos disponíveis</span>
            <span className="text-2xl font-bold text-foreground">
              {photoCredits.toLocaleString('pt-BR')}
            </span>
            <span className="text-xs text-muted-foreground">
              Seus créditos não expiram e podem ser usados a qualquer momento.
            </span>
          </div>
        </div>
      </section>

      {/* ═══ SELECT AVULSO CARDS ═══ */}
      <section className="container max-w-6xl -mt-28 md:-mt-32 relative z-[1] pb-20">
        {isLoadingPackages ?
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) =>
          <Skeleton key={i} className="h-96 rounded-2xl" />
          )}
          </div> :

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {avulsos.map((pkg) => {
            const highlighted = isHighlighted(pkg);
            return (
              <div
                key={pkg.id}
                className={cn("relative flex flex-col rounded-2xl border p-8 transition-all hover:shadow-md bg-gray-50",

                highlighted ?
                'border-primary shadow-md ring-1 ring-primary/20' :
                'border-border shadow-sm'
                )}>

                  {highlighted &&
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs gap-1">
                      <Star className="h-3 w-3" />
                      Mais escolhido
                    </Badge>
                }

                  <p className="text-lg font-semibold text-foreground">{pkg.name}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {pkg.credits.toLocaleString('pt-BR')} créditos
                  </p>

                  <p className="text-3xl font-bold text-primary mt-5">
                    {formatPrice(pkg.price_cents)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">pagamento único</p>

                  <Button
                  className="mt-6 px-8"
                  size="lg"
                  onClick={() => handleBuy(pkg)}>

                    Comprar
                  </Button>

                  <ul className="mt-6 space-y-2.5 flex-1">
                    {BENEFITS_AVULSO.map(({ icon: Icon, label }) =>
                  <li key={label} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                        <Icon className="h-4 w-4 text-primary/70 shrink-0" />
                        {label}
                      </li>
                  )}
                  </ul>
                </div>);

          })}
          </div>
        }
      </section>

      {/* ═══ MICRO-TRIGGER ═══ */}
      <div className="text-center pb-20">
        <p className="text-sm text-muted-foreground/70 italic">
          Usa créditos com frequência? Um plano mensal pode sair mais vantajoso no longo prazo.
        </p>
      </div>

      {/* ═══ COMBOS ═══ */}
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
          <div className="inline-flex items-center rounded-full border bg-muted/50 p-1 gap-0.5">
            <button
              onClick={() => setBillingPeriod('monthly')}
              className={cn(
                'rounded-full px-5 py-2 text-sm font-medium transition-all',
                billingPeriod === 'monthly' ?
                'bg-card text-foreground shadow-sm' :
                'text-muted-foreground hover:text-foreground'
              )}>

              Mensal
            </button>
            <button
              onClick={() => setBillingPeriod('yearly')}
              className={cn(
                'rounded-full px-5 py-2 text-sm font-medium transition-all flex items-center gap-2',
                billingPeriod === 'yearly' ?
                'bg-card text-foreground shadow-sm' :
                'text-muted-foreground hover:text-foreground'
              )}>

              Anual
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                -16%
              </Badge>
            </button>
          </div>
        </div>

        {/* Combo cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {COMBO_PLANS.map((plan) => {
            const priceCents = billingPeriod === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice;
            const priceLabel = formatPrice(priceCents);
            return (
              <div
                key={plan.name}
                className={cn("relative flex flex-col rounded-2xl border p-8 transition-all hover:shadow-md bg-gray-50",

                plan.highlight ?
                'border-primary shadow-md ring-1 ring-primary/20' :
                'border-border shadow-sm'
                )}>

                {plan.tag &&
                <Badge className="absolute -top-3 left-6 text-xs">
                    {plan.tag}
                  </Badge>
                }

                <p className="text-lg font-semibold text-foreground">{plan.name}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {plan.credits.toLocaleString('pt-BR')} créditos mensais incluídos
                </p>

                <ul className="mt-6 space-y-2.5 flex-1">
                  {plan.benefits.map((b) =>
                  <li key={b} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                      <Check className="h-4 w-4 mt-0.5 text-primary/70 shrink-0" />
                      {b}
                    </li>
                  )}
                </ul>

                <p className="text-2xl font-bold text-primary mt-6">
                  {priceLabel}
                  <span className="text-sm font-normal text-muted-foreground">
                    /{billingPeriod === 'monthly' ? 'mês' : 'ano'}
                  </span>
                </p>
                {billingPeriod === 'yearly' &&
                <p className="text-xs text-primary/80 mt-1">
                    Economize 16% em relação ao mensal
                  </p>
                }

                <Button className="mt-6 px-8" size="lg" onClick={handleComboSubscribe}>
                  {plan.buttonLabel}
                </Button>
              </div>);

          })}
        </div>
      </section>

      {/* ═══ INSTITUTIONAL BUTTONS ═══ */}
      <div className="flex justify-center gap-4 pb-20">
        <Button variant="outline" className="px-6" onClick={() => toast.info('Em breve!')}>
          Conheça o Select
        </Button>
        <Button variant="outline" className="px-6" onClick={() => toast.info('Em breve!')}>
          Conheça o Transfer
        </Button>
      </div>

      {/* ═══ COMPARISON TABLE ═══ */}
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
              {COMPARISON_ROWS.map((row, i) =>
              <tr key={row.label} className={cn('border-b last:border-0', i % 2 === 0 && 'bg-muted/10')}>
                  <td className="px-6 py-4 font-medium text-foreground">{row.label}</td>
                  {(['avulso', 'pro', 'full'] as const).map((col) => {
                  const val = row[col];
                  return (
                    <td key={col} className="px-6 py-4 text-center">
                        {val === true ?
                      <Check className="h-4 w-4 text-primary mx-auto" /> :
                      val === false ?
                      <Minus className="h-4 w-4 text-muted-foreground/40 mx-auto" /> :

                      <span className="text-foreground">{val}</span>
                      }
                      </td>);

                })}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>);

}