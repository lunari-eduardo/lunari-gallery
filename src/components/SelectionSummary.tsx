import { Gallery, DiscountPackage } from '@/types/gallery';
import { Check, AlertCircle, BadgeCheck, Clock, ArrowRight, Wallet, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { calcularPrecoProgressivoComCredito, RegrasCongeladas } from '@/lib/pricingUtils';
import { useDiscountAnalysis, InlineDiscountTiers } from '@/components/DiscountProgressBar';
import { useIsMobile } from '@/hooks/use-mobile';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export type BillingPaymentStatus =
  | 'pago'
  | 'pago_manual'
  | 'pendente'
  | 'aguardando_confirmacao'
  | 'parcial'
  | 'sem_cobranca';

export interface BillingInfo {
  valorTotalVendido: number;
  valorPendente: number;
  statusPagamento: BillingPaymentStatus | string;
  totalExtrasVendidas: number;
  ultimoPagamentoEm?: string | null;
  onVerDetalhes?: () => void;
}

interface SelectionSummaryProps {
  gallery: Gallery;
  onConfirm?: () => void;
  isClient?: boolean;
  variant?: 'default' | 'bottom-bar';
  regrasCongeladas?: RegrasCongeladas | null;
  extrasPagasTotal?: number;
  extrasACobrar?: number;
  valorJaPago?: number;
  saleSettings?: {
    pricingModel?: string;
    discountPackages?: DiscountPackage[];
    fixedPrice?: number;
  } | null;
  billingInfo?: BillingInfo;
  hasPayment?: boolean;
}

function resolveBillingState(b: BillingInfo): {
  label: string;
  badgeClass: string;
  Icon: typeof BadgeCheck;
} {
  const status = b.statusPagamento;
  const paid = b.valorTotalVendido > 0;
  const pending = b.valorPendente > 0;

  if (paid && pending) {
    return {
      label: 'Pagamento parcial',
      badgeClass: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30',
      Icon: Clock,
    };
  }
  if (status === 'pago' || status === 'pago_manual' || (paid && !pending)) {
    return {
      label: status === 'pago_manual' ? 'Pago (manual)' : 'Pago',
      badgeClass: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30',
      Icon: BadgeCheck,
    };
  }
  if (status === 'pendente' || status === 'aguardando_confirmacao' || pending) {
    return {
      label: status === 'aguardando_confirmacao' ? 'Aguardando confirmação' : 'Pendente',
      badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
      Icon: Clock,
    };
  }
  return {
    label: 'Sem cobrança',
    badgeClass: 'bg-muted text-muted-foreground border-border',
    Icon: Wallet,
  };
}

export function SelectionSummary({
  gallery,
  onConfirm,
  isClient = false,
  variant = 'default',
  regrasCongeladas,
  extrasPagasTotal = 0,
  extrasACobrar: extrasACobrarProp,
  valorJaPago = 0,
  saleSettings,
  billingInfo,
  hasPayment = false,
}: SelectionSummaryProps) {
  const { includedPhotos, selectedCount, extraPhotoPrice, selectionStatus } = gallery;
  const extraCount = Math.max(0, selectedCount - includedPhotos);
  const currentExtras = extraCount;
  const isOverLimit = extraCount > 0;
  const isConfirmed = selectionStatus === 'confirmed';
  const isBlocked = selectionStatus === 'blocked';
  const isMobile = useIsMobile();

  const extrasACobrar = extrasACobrarProp ?? Math.max(0, extraCount - extrasPagasTotal);
  const hasPendingCharge = extrasACobrar > 0;
  const hasPaidExtras = extrasPagasTotal > 0;

  const { valorUnitario, valorACobrar, totalExtras } = calcularPrecoProgressivoComCredito(
    extrasACobrar,
    extrasPagasTotal,
    valorJaPago,
    regrasCongeladas,
    extraPhotoPrice
  );

  const displayUnitPrice = valorUnitario;
  const displayTotal = valorACobrar;

  const discountAnalysis = useDiscountAnalysis({
    regrasCongeladas,
    totalExtras: currentExtras,
    extraPhotoPrice,
    saleSettings,
    includedPhotos,
  });

  const showDiscountTiers = discountAnalysis && currentExtras > 0;

  // Bottom bar variant (cliente)
  if (variant === 'bottom-bar') {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 backdrop-blur-xl bg-card/80 border-t border-border/30 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
        <div className={cn(
          'flex items-center justify-between',
          isMobile ? 'px-3 py-2 gap-2' : 'px-4 py-3 gap-4'
        )}>
          <div className={cn('flex items-center shrink-0', isMobile ? 'gap-1.5' : 'gap-3')}>
            <div className="flex items-center gap-1">
              <span className={cn('font-bold', isMobile ? 'text-sm' : 'text-lg')}>{selectedCount}</span>
              <span className={cn('text-muted-foreground', isMobile ? 'text-[10px]' : 'text-sm')}>/ {includedPhotos}</span>
            </div>
            {isOverLimit && (
              <div className={cn('flex items-center gap-1 text-primary', isMobile ? 'text-[10px]' : 'text-sm')}>
                <span className="font-medium">+{currentExtras}</span>
                {extrasPagasTotal > 0 && (
                  <span className={cn('text-muted-foreground font-normal', isMobile ? 'text-[9px]' : 'text-xs')}>
                    (−{extrasPagasTotal} já pagas)
                  </span>
                )}
                {hasPendingCharge && (
                  <span className="font-bold">R$ {displayTotal.toFixed(2)}</span>
                )}
              </div>
            )}
          </div>

          {showDiscountTiers && (
            <div className="flex-1 flex justify-center min-w-0">
              <InlineDiscountTiers
                analysis={discountAnalysis}
                totalExtras={currentExtras}
                isMobile={isMobile}
              />
            </div>
          )}

          <div className="flex items-center shrink-0">
            {isConfirmed ? (
              <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                <Check className={cn(isMobile ? 'h-4 w-4' : 'h-5 w-5')} />
                <span className={cn('font-medium hidden sm:inline', isMobile ? 'text-xs' : 'text-sm')}>Confirmada</span>
              </div>
            ) : isBlocked ? (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <AlertCircle className={cn(isMobile ? 'h-4 w-4' : 'h-5 w-5')} />
                <span className={cn('font-medium hidden sm:inline', isMobile ? 'text-xs' : 'text-sm')}>Bloqueada</span>
              </div>
            ) : (
              <Button
                onClick={onConfirm}
                variant="terracotta"
                size={isMobile ? 'sm' : 'lg'}
                className={cn(isMobile ? 'px-3 text-[11px] h-7' : 'px-6')}
              >
                <Check className={cn(isMobile ? 'h-3 w-3 mr-1' : 'h-4 w-4 mr-2')} />
                Confirmar
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Default card variant
  return (
    <div className="glass p-6 md:p-8 space-y-6 shadow-xl border-white/5">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-light tracking-tight">Resumo da Seleção</h3>
        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
          <Check className="h-4 w-4 text-primary" />
        </div>
      </div>

      <div className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs uppercase tracking-widest opacity-50">
            <span>Progresso da Seleção</span>
            <span>{Math.round((selectedCount / Math.max(includedPhotos, 1)) * 100)}%</span>
          </div>
          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full transition-all duration-1000 ease-out',
                isOverLimit ? 'bg-amber-500' : 'bg-primary'
              )}
              style={{ width: `${Math.min(100, (selectedCount / Math.max(includedPhotos, 1)) * 100)}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 py-2">
          <div className="space-y-1">
            <span className="text-[10px] uppercase tracking-widest opacity-40 block">Fotos Incluídas</span>
            <span className="text-xl font-medium">{includedPhotos}</span>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] uppercase tracking-widest opacity-40 block">Selecionadas</span>
            <span className={cn(
              'text-xl font-bold transition-colors',
              isOverLimit ? 'text-amber-500' : 'text-primary'
            )}>
              {selectedCount}
            </span>
          </div>
        </div>

        {isOverLimit && (
          <div className="space-y-3 pt-4 border-t border-white/5 animate-fade-in">
            <div className="flex items-center justify-between text-sm">
              <span className="opacity-60">Fotos extras (esta seleção)</span>
              <span className="font-semibold text-amber-500">+{currentExtras}</span>
            </div>

            {hasPaidExtras && (
              <div className="flex items-center justify-between text-xs opacity-60">
                <span>Já pagas em ciclos anteriores</span>
                <span>{extrasPagasTotal}</span>
              </div>
            )}

            {hasPendingCharge && (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="opacity-60">A cobrar agora</span>
                  <span className="font-semibold">{extrasACobrar}</span>
                </div>
                {displayUnitPrice > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="opacity-60">Valor unitário</span>
                    <span>R$ {displayUnitPrice.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-2 border-t border-white/5">
                  <span className="text-base font-medium">Total a cobrar</span>
                  <span className="text-2xl font-bold text-primary">
                    R$ {displayTotal.toFixed(2)}
                  </span>
                </div>
              </>
            )}

            {!hasPendingCharge && hasPaidExtras && !isClient && (
              <div className="flex items-center gap-2 pt-2 border-t border-white/5 text-xs text-green-600 dark:text-green-400">
                <BadgeCheck className="h-4 w-4" />
                <span>Todas as extras desta seleção já foram pagas</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Faturamento (apenas para o fotógrafo) */}
      {!isClient && billingInfo && (billingInfo.totalExtrasVendidas > 0 || billingInfo.valorPendente > 0) && (() => {
        const state = resolveBillingState(billingInfo);
        const StateIcon = state.Icon;
        return (
          <div className="space-y-3 pt-4 border-t border-white/5">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-widest opacity-50">Faturamento</span>
              <span className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border',
                state.badgeClass
              )}>
                <StateIcon className="h-3.5 w-3.5" />
                {state.label}
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm opacity-70">Valor total vendido</span>
                <span className="text-lg font-semibold">R$ {billingInfo.valorTotalVendido.toFixed(2)}</span>
              </div>
              {billingInfo.valorPendente > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm opacity-70">Saldo pendente</span>
                  <span className="text-lg font-semibold text-amber-500">
                    R$ {billingInfo.valorPendente.toFixed(2)}
                  </span>
                </div>
              )}
              <p className="text-xs opacity-50">
                {billingInfo.totalExtrasVendidas} foto{billingInfo.totalExtrasVendidas !== 1 ? 's' : ''} extra{billingInfo.totalExtrasVendidas !== 1 ? 's' : ''} vendida{billingInfo.totalExtrasVendidas !== 1 ? 's' : ''}
                {billingInfo.ultimoPagamentoEm && (
                  <> · último pagamento em {format(new Date(billingInfo.ultimoPagamentoEm), "dd 'de' MMM", { locale: ptBR })}</>
                )}
              </p>
            </div>

            {billingInfo.onVerDetalhes && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-between"
                onClick={billingInfo.onVerDetalhes}
              >
                Ver detalhes do pagamento
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        );
      })()}

      {isOverLimit && gallery.settings.allowExtraPhotos && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-sm">
          <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
          <p className="text-amber-500/90 leading-relaxed">
            {isClient
              ? `Você selecionou ${extraCount} foto${extraCount > 1 ? 's' : ''} além do seu pacote original.`
              : `O cliente selecionou ${extraCount} foto${extraCount > 1 ? 's' : ''} extra${extraCount > 1 ? 's' : ''}.`}
          </p>
        </div>
      )}

      {isClient && !isConfirmed && !isBlocked && (
        <Button
          onClick={onConfirm}
          variant="default"
          className="w-full shadow-lg hover:shadow-primary/20 transition-all duration-500 h-14 text-base tracking-wide"
          size="lg"
          style={{
            backgroundColor: 'var(--gallery-primary)',
            color: 'var(--gallery-primary-foreground)',
            borderRadius: 'var(--gallery-radius)',
          }}
        >
          {hasPayment ? (
            <CreditCard className="h-5 w-5 mr-2" />
          ) : (
            <Check className="h-5 w-5 mr-2" />
          )}
          {hasPayment ? 'Confirmar e Pagar' : 'Confirmar Seleção'}
        </Button>
      )}

      {/* Banner "enviada com sucesso" só faz sentido para o cliente */}
      {isClient && isConfirmed && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400 text-sm animate-scale-in">
          <Check className="h-5 w-5 flex-shrink-0" />
          <p className="font-medium">Sua seleção foi enviada com sucesso!</p>
        </div>
      )}

      {/* Versão discreta para o fotógrafo */}
      {!isClient && isConfirmed && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Check className="h-3.5 w-3.5 text-green-500" />
          <span>Seleção confirmada pelo cliente</span>
        </div>
      )}
    </div>
  );
}
