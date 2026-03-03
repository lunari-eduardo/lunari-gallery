import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '@/contexts/AuthContext';
import { usePhotoCredits } from '@/hooks/usePhotoCredits';
import { useCreditPackages } from '@/hooks/useCreditPackages';
import { useTransferStorage } from '@/hooks/useTransferStorage';
import { formatStorageSize } from '@/lib/transferPlans';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Infinity, ShoppingCart, CheckCircle2, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import selectLogo from '@/assets/gallery-select-logo.png';
import transferLogo from '@/assets/gallery-transfer-logo.png';

export default function Credits() {
  const navigate = useNavigate();
  const { isAdmin } = useAuthContext();
  const { photoCredits, creditsPurchased, creditsSubscription, isLoading: isLoadingCredits } = usePhotoCredits();
  const { purchases } = useCreditPackages();
  const { storageUsedBytes, storageLimitBytes, storageUsedPercent, hasTransferPlan, hasFreeStorageOnly, planName, isLoading: isLoadingTransfer } = useTransferStorage();

  return (
    <div className="space-y-10">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Planos e Créditos</h1>
        <p className="text-muted-foreground text-sm">
          Gerencie seus créditos e armazenamento
        </p>
      </div>

      {/* Two-column grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
        {/* Gallery Select block */}
        <div className="space-y-5 md:pr-12">
          <div className="space-y-1">
            <img src={selectLogo} alt="Gallery Select" className="h-10 object-contain" />
            <p className="text-xs text-muted-foreground/70">Créditos pré-pagos para galerias de seleção</p>
          </div>

          {isAdmin ? (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-3xl font-bold text-primary">
                <Infinity className="h-7 w-7" />
                <span>Ilimitado</span>
              </div>
              <p className="text-xs text-muted-foreground">Acesso administrativo</p>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="text-3xl font-bold text-primary">
                {isLoadingCredits ? (
                  <Skeleton className="h-9 w-24" />
                ) : (
                  photoCredits.toLocaleString('pt-BR')
                )}
              </div>
              <p className="text-sm text-muted-foreground">créditos disponíveis</p>
              {creditsSubscription > 0 ? (
                <p className="text-xs text-muted-foreground/60">
                  {creditsSubscription.toLocaleString('pt-BR')} do plano · {creditsPurchased.toLocaleString('pt-BR')} avulsos
                </p>
              ) : (
                <p className="text-xs text-muted-foreground/60">
                  Seus créditos não vencem
                </p>
              )}
            </div>
          )}

          {!isAdmin && (
            <Button
              size="sm"
              variant="default"
              onClick={() => navigate('/credits/checkout?tab=select')}
              className="gap-1.5"
            >
              <ShoppingCart className="h-3.5 w-3.5" />
              Comprar Créditos
            </Button>
          )}

          {/* Purchase history */}
          {!isAdmin && purchases && purchases.filter(p => p.status === 'approved').length > 0 && (
            <div className="space-y-2 pt-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Últimas compras</p>
              <div className="space-y-0">
                {purchases.filter(p => p.status === 'approved').slice(0, 3).map((purchase, i) => (
                  <div
                    key={purchase.id}
                    className={`flex items-center justify-between py-2.5 ${i < Math.min(purchases.length, 3) - 1 ? 'border-b border-border/50' : ''}`}
                  >
                    <div className="flex items-center gap-2">
                      {purchase.status === 'approved' && (
                        <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                      )}
                      <span className="text-sm">
                        {purchase.credits_amount.toLocaleString('pt-BR')} créditos
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      <span>
                        {(purchase.price_cents / 100).toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        })}
                      </span>
                      <span className="text-xs">
                        {format(new Date(purchase.created_at), "dd MMM", { locale: ptBR })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Mobile separator */}
        <div className="md:hidden border-t border-border/30 my-2" />

        {/* Gallery Transfer block */}
        <div className="space-y-5 md:border-l md:border-border md:pl-12 pt-4 md:pt-0">
          <div className="space-y-1">
            <img src={transferLogo} alt="Gallery Transfer" className="h-10 object-contain" />
            <p className="text-xs text-muted-foreground/70">Plano mensal de armazenamento</p>
          </div>

          {isAdmin ? (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-3xl font-bold text-primary">
                <Infinity className="h-7 w-7" />
                <span>Ilimitado</span>
              </div>
              <p className="text-xs text-muted-foreground">Acesso administrativo</p>
            </div>
          ) : isLoadingTransfer ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
          ) : hasTransferPlan ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <p className="text-sm font-medium">{planName}</p>
                <p className="text-xs text-muted-foreground">
                  {formatStorageSize(storageUsedBytes)} de {formatStorageSize(storageLimitBytes)} usados
                </p>
              </div>
              {storageUsedPercent >= 100 && (
                <Badge variant="destructive" className="text-xs">Armazenamento cheio</Badge>
              )}
              <Progress value={storageUsedPercent} className="h-2" />
            </div>
          ) : hasFreeStorageOnly ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <p className="text-sm font-medium">Armazenamento gratuito</p>
                <p className="text-xs text-muted-foreground">
                  {formatStorageSize(storageUsedBytes)} de {formatStorageSize(storageLimitBytes)} usados
                </p>
              </div>
              {storageUsedPercent >= 100 && (
                <Badge variant="destructive" className="text-xs">Armazenamento cheio</Badge>
              )}
              <Progress value={storageUsedPercent} className="h-2" />
              <p className="text-xs text-muted-foreground/60">Incluído no cadastro</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-lg font-semibold text-foreground">
                Ative um plano e entregue galerias que geram valor.
              </p>
              <p className="text-xs text-muted-foreground/60">
                Armazenamento seguro com entrega profissional no seu estilo.
              </p>
            </div>
          )}

          {!isAdmin && (
            <div className="space-y-1">
              <Button
                size="sm"
                variant="default"
                onClick={() => navigate('/credits/checkout?tab=transfer')}
                className="gap-1.5"
              >
                <ArrowRight className="h-3.5 w-3.5" />
                Ver planos de armazenamento
              </Button>
              {hasTransferPlan && (
                <button
                  onClick={() => navigate('/credits/subscription')}
                  className="block text-xs text-primary hover:underline"
                >
                  Gerenciar assinatura
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Strategic expansion section */}
      {!isAdmin && (
        <div className="bg-muted/30 -mx-4 px-4 md:-mx-6 md:px-6 py-12 md:py-16 rounded-2xl space-y-10">
          {/* Header centrado — landing page style */}
          <div className="text-center max-w-2xl mx-auto space-y-4">
            <p className="text-sm text-muted-foreground">
              Você usa créditos com frequência?{' '}
              <span className="text-muted-foreground/60">
                Talvez um plano integrado faça mais sentido no longo prazo.
              </span>
            </p>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Estruture seu negócio para crescer</h2>
            <p className="text-sm md:text-base text-muted-foreground max-w-lg mx-auto">
              Gestão, galerias de seleção e entrega integrados para quem quer escalar com organização.
            </p>
          </div>

          {/* Cards grid lado a lado */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {/* Card 1 — Studio Pro + Select 2k */}
            <div className="rounded-xl border border-border/60 bg-background p-7 md:p-8 flex flex-col gap-5">
              <div className="space-y-2">
                <p className="text-base font-semibold">Studio Pro + Gallery Select 2k</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Para quem quer profissionalizar o fluxo de atendimento e seleção com gestão integrada.
                </p>
              </div>
              <ul className="space-y-2 flex-1">
                {['Gestão completa com Lunari Studio', '2.000 créditos mensais incluídos', 'Integração automática com galerias no workflow'].map((b) => (
                  <li key={b} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                    {b}
                  </li>
                ))}
              </ul>
              <div className="pt-2 space-y-3">
                <p className="text-2xl font-bold text-foreground">
                  R$ 44,90<span className="text-sm font-normal text-muted-foreground">/mês</span>
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate('/credits/checkout?tab=select')}
                  className="w-full"
                >
                  Conhecer planos
                </Button>
                <button
                  onClick={() => navigate('/credits/checkout?tab=select')}
                  className="block w-full text-center text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  Assinar agora →
                </button>
              </div>
            </div>

            {/* Card 2 — Combo Completo */}
            <div className="relative rounded-xl border border-primary/20 bg-background p-7 md:p-8 flex flex-col gap-5">
              <Badge variant="secondary" className="absolute -top-2.5 left-5 text-[10px] font-medium">
                Mais completo
              </Badge>
              <div className="space-y-2">
                <p className="text-base font-semibold">Studio Pro + Select 2k + Transfer 20GB</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Tudo integrado: gestão, seleção e entrega profissional no seu estilo — para quem quer escalar de verdade.
                </p>
              </div>
              <ul className="space-y-2 flex-1">
                {['Gestão completa', 'Créditos mensais incluídos', 'Entrega profissional personalizada'].map((b) => (
                  <li key={b} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                    {b}
                  </li>
                ))}
              </ul>
              <div className="pt-2 space-y-3">
                <p className="text-2xl font-bold text-foreground">
                  R$ 64,90<span className="text-sm font-normal text-muted-foreground">/mês</span>
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate('/credits/checkout?tab=select')}
                  className="w-full"
                >
                  Conhecer estrutura completa
                </Button>
                <button
                  onClick={() => navigate('/credits/checkout?tab=select')}
                  className="block w-full text-center text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  Assinar agora →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
