import { useState, useEffect, useRef } from 'react';
import { Check, Clock, Info, Loader2, RefreshCw, Shield, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { LightPaymentSurface } from '@/components/gallery/LightPaymentSurface';

const SUPABASE_URL = 'https://tlnjspsywycbudhewsfv.supabase.co';
const POLL_MAX_DURATION = 10 * 60 * 1000;
// Polling é apenas fallback: a via primária é Realtime em `cobrancas`.
// Intervalos altos para minimizar egress no plano free.
const GET_ADAPTIVE_POLL_INTERVAL = (elapsedMs: number) => {
  if (elapsedMs < 30_000) return 15000;
  if (elapsedMs < 120_000) return 30000;
  return 60000;
};

export type PendingAction =
  | { kind: 'external_redirect'; checkoutUrl: string; provedor: string }
  | { kind: 'regenerate'; provedor: string }
  | { kind: 'resume_modal'; provedor: string }; // Asaas/PIX modais internos

interface PaymentPendingScreenProps {
  cobrancaId?: string;
  sessionId?: string;
  checkoutUrl?: string;
  valorTotal: number;
  provedor: string;
  studioName?: string;
  studioLogoUrl?: string;
  themeStyles?: React.CSSProperties;
  backgroundMode?: 'light' | 'dark';
  awaitingCharge?: boolean;
  /** Ação canônica devolvida pelo backend. Se ausente, cai no comportamento legado. */
  pendingAction?: PendingAction;
  /** Chamado para abrir modais internos (Asaas/PIX). */
  onResume?: () => void;
  onRegenerate?: () => void | Promise<void>;
  onPaymentConfirmed: () => void;
}


/* ---------- Ilustração ---------- */
function PendingIllustration() {
  return (
    <svg
      viewBox="0 0 240 180"
      className="mx-auto h-28 sm:h-32 w-auto text-muted-foreground"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <g opacity={0.55}>
        <path d="M40 70c8-14 20-18 30-14" />
        <path d="M52 62c-2-5-1-10 2-13" />
        <path d="M60 58c2-4 6-6 10-6" />
        <path d="M200 70c-8-14-20-18-30-14" />
        <path d="M188 62c2-5 1-10-2-13" />
        <path d="M180 58c-2-4-6-6-10-6" />
      </g>

      <g>
        <rect x="70" y="55" width="115" height="80" rx="6" />
        <circle cx="80" cy="65" r="1.5" fill="currentColor" />
        <circle cx="86" cy="65" r="1.5" fill="currentColor" />
        <circle cx="92" cy="65" r="1.5" fill="currentColor" />
        <line x1="70" y1="74" x2="185" y2="74" />
        <rect x="80" y="84" width="45" height="42" rx="3" />
        <path d="M83 118l10-10 8 7 6-4 15 15" />
        <circle cx="93" cy="97" r="3" />
        <rect x="130" y="84" width="45" height="42" rx="3" />
        <path d="M133 118l10-10 8 7 6-4 15 15" />
        <circle cx="143" cy="97" r="3" />
      </g>

      <g className="text-primary">
        <circle cx="72" cy="52" r="10" fill="hsl(var(--card))" stroke="currentColor" />
        <path d="M67 52l4 4 6-7" />
      </g>

      <g className="text-primary">
        <rect x="170" y="118" width="22" height="18" rx="3" fill="hsl(var(--card))" stroke="currentColor" />
        <path d="M174 118v-4a7 7 0 0114 0v4" />
        <circle cx="181" cy="127" r="1.5" fill="currentColor" />
      </g>
    </svg>
  );
}

/* ---------- Timeline ---------- */
type StepState = 'done' | 'active' | 'upcoming';
interface Step {
  title: string;
  subtitle: string;
  state: StepState;
  index: number;
}

function TimelineNode({ step }: { step: Step }) {
  const base = 'flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium shrink-0';
  const styles: Record<StepState, string> = {
    done: 'bg-foreground text-background',
    active: 'bg-primary text-primary-foreground',
    upcoming: 'bg-card text-muted-foreground border border-border',
  };
  return (
    <div className={cn(base, styles[step.state])}>
      {step.state === 'done' ? <Check className="h-3.5 w-3.5" strokeWidth={2.2} /> : step.index}
    </div>
  );
}

function Timeline({ steps }: { steps: Step[] }) {
  return (
    <div className="rounded-2xl bg-card border border-border shadow-[0_4px_20px_-12px_rgba(0,0,0,0.08)] p-4 sm:p-5">
      {/* Desktop */}
      <div className="hidden sm:grid grid-cols-3 gap-3 relative">
        <div className="absolute top-[14px] left-[16%] right-[16%] h-px bg-border" />
        {steps.map((s) => (
          <div key={s.index} className="flex flex-col items-center text-center gap-2 relative z-10">
            <TimelineNode step={s} />
            <div>
              <p className="text-[13px] font-semibold text-foreground leading-tight">{s.title}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{s.subtitle}</p>
            </div>
          </div>
        ))}
      </div>
      {/* Mobile */}
      <div className="sm:hidden flex flex-col gap-2.5">
        {steps.map((s, i) => (
          <div key={s.index} className="flex gap-3 items-start relative">
            <div className="flex flex-col items-center">
              <TimelineNode step={s} />
              {i < steps.length - 1 && <div className="w-px flex-1 min-h-4 bg-border mt-1.5" />}
            </div>
            <div className="pt-0.5 pb-1">
              <p className="text-[13px] font-semibold text-foreground leading-tight">{s.title}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{s.subtitle}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Componente principal ---------- */
export function PaymentPendingScreen({
  cobrancaId,
  sessionId,
  checkoutUrl,
  valorTotal,
  studioName,
  studioLogoUrl,
  themeStyles = {},
  awaitingCharge = false,
  pendingAction,
  onResume,
  onRegenerate,
  onPaymentConfirmed,
}: PaymentPendingScreenProps) {
  // Fonte da verdade: pendingAction quando fornecido; senão inferimos do legado.
  const effectiveAction: PendingAction =
    pendingAction ??
    (awaitingCharge
      ? { kind: 'regenerate', provedor: 'desconhecido' }
      : checkoutUrl
        ? { kind: 'external_redirect', checkoutUrl, provedor: 'externo' }
        : { kind: 'regenerate', provedor: 'desconhecido' });

  const [status, setStatus] = useState<'polling' | 'confirmed' | 'timeout'>('polling');
  const [isChecking, setIsChecking] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const startTimeRef = useRef(Date.now());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkPayment = async () => {
    if (!cobrancaId && !sessionId) return;
    setIsChecking(true);
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/check-payment-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cobrancaId, sessionId, forceUpdate: false }),
      });
      const result = await response.json();
      if (result.status === 'pago') {
        setStatus('confirmed');
        if (intervalRef.current) clearInterval(intervalRef.current);
        setTimeout(() => onPaymentConfirmed(), 2000);
        return;
      }
      if (Date.now() - startTimeRef.current > POLL_MAX_DURATION) {
        setStatus('timeout');
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
    } catch (error) {
      console.error('[PaymentPending] Check error:', error);
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    startTimeRef.current = Date.now();
    let pollTimeout: ReturnType<typeof setTimeout> | null = null;

    const scheduleNextPoll = () => {
      if (pollTimeout) clearTimeout(pollTimeout);
      const elapsed = Date.now() - startTimeRef.current;
      if (elapsed > POLL_MAX_DURATION) {
        setStatus('timeout');
        return;
      }
      pollTimeout = setTimeout(async () => {
        await checkPayment();
        scheduleNextPoll();
      }, GET_ADAPTIVE_POLL_INTERVAL(elapsed));
    };

    checkPayment();
    scheduleNextPoll();

    let channel: ReturnType<typeof supabase.channel> | null = null;
    if (cobrancaId) {
      channel = supabase
        .channel(`payment-${cobrancaId}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'cobrancas', filter: `id=eq.${cobrancaId}` },
          (payload) => {
            const newStatus = (payload.new as any).status;
            if (newStatus === 'pago' || newStatus === 'pago_manual') {
              setStatus('confirmed');
              if (pollTimeout) clearTimeout(pollTimeout);
              setTimeout(() => onPaymentConfirmed(), 2000);
            }
          }
        )
        .subscribe();
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') checkPayment();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (channel) supabase.removeChannel(channel);
      if (pollTimeout) clearTimeout(pollTimeout);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cobrancaId, sessionId]);

  const handleRegenerate = async () => {
    if (!onRegenerate) return;
    setIsRegenerating(true);
    try {
      await onRegenerate();
    } finally {
      setIsRegenerating(false);
    }
  };

  const timelineSteps: Step[] =
    status === 'confirmed'
      ? [
          { index: 1, title: 'Seleção enviada', subtitle: 'Recebida com sucesso', state: 'done' },
          { index: 2, title: 'Pagamento confirmado', subtitle: 'Concluído', state: 'done' },
          { index: 3, title: 'Continuação do pedido', subtitle: 'Em andamento', state: 'active' },
        ]
      : [
          { index: 1, title: 'Seleção enviada', subtitle: 'Recebida com sucesso', state: 'done' },
          {
            index: 2,
            title: 'Aguardando pagamento',
            subtitle: 'Aguardando conclusão',
            state: 'active',
          },

          {
            index: 3,
            title: 'Continuação do pedido',
            subtitle: 'Após a confirmação',
            state: 'upcoming',
          },
        ];

  return (
    <LightPaymentSurface themeStyles={themeStyles} className="bg-background text-foreground">
      <div className="mx-auto max-w-2xl px-5 py-10 sm:px-8 sm:py-14">
        {/* Header - Logo grande, sem borda */}
        <div className="flex flex-col items-center text-center mb-6 sm:mb-8">
          {studioLogoUrl ? (
            <img
              src={studioLogoUrl}
              alt={studioName || 'Studio'}
              className="h-32 sm:h-36 w-auto max-w-[220px] object-contain"
            />
          ) : studioName ? (
            <p className="text-sm tracking-[0.2em] uppercase text-muted-foreground">{studioName}</p>
          ) : null}
        </div>

        {/* Ilustração */}
        <PendingIllustration />

        {/* Título */}
        <div className="text-center mt-6 mb-8 space-y-3 px-2">
          <h1
            className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight"
            style={{ fontFamily: 'ui-serif, Georgia, "Times New Roman", serif' }}
          >
            {status === 'confirmed'
              ? 'Pagamento confirmado!'
              : status === 'timeout'
              ? 'Verificação em andamento'
              : 'Sua seleção foi salva!'}
          </h1>
          <p className="text-[15px] leading-relaxed text-muted-foreground max-w-md mx-auto">
            {status === 'confirmed'
              ? 'Sua seleção foi finalizada com sucesso.'
              : status === 'timeout'
              ? 'Ainda não recebemos a confirmação. Se você já pagou, aguarde alguns instantes ou tente verificar novamente.'
              : 'Sua seleção já foi registrada e enviada ao fotógrafo. Para continuar o processo, basta concluir o pagamento, caso ele ainda esteja pendente.'}
          </p>
        </div>

        {/* Timeline compacta */}
        <div className="mb-5">
          <Timeline steps={timelineSteps} />
        </div>

        {/* Card status */}
        <div className="rounded-2xl bg-card border border-border/60 p-6 sm:p-8">
          {status === 'confirmed' ? (
            <div className="flex flex-col items-center text-center gap-4 py-4">
              <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
                <Check className="h-7 w-7 text-primary" strokeWidth={1.75} />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-2">
                  Status do pedido
                </p>
                <h2
                  className="text-xl font-semibold text-foreground"
                  style={{ fontFamily: 'ui-serif, Georgia, serif' }}
                >
                  Pagamento confirmado
                </h2>
                <p className="text-sm text-muted-foreground mt-2">
                  Você já pode fechar esta página com tranquilidade.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row items-start gap-5">
                <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center shrink-0 mx-auto sm:mx-0">
                  <Clock className="h-6 w-6 text-primary" strokeWidth={1.5} />
                </div>
                <div className="flex-1 text-center sm:text-left">
                  <p className="text-xs uppercase tracking-[0.18em] text-primary font-medium mb-2">
                    Status do pedido
                  </p>
                  <h2
                    className="text-2xl font-semibold text-foreground leading-tight"
                    style={{ fontFamily: 'ui-serif, Georgia, serif' }}
                  >
                    Aguardando pagamento
                  </h2>
                  <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                    Clique abaixo para concluir seu pagamento com segurança.
                  </p>
                </div>
              </div>

              <div className="mt-6 rounded-xl bg-muted/40 border border-border/60 px-4 py-3 flex items-start gap-3">
                <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" strokeWidth={1.5} />
                <p className="text-[13px] text-muted-foreground leading-relaxed">
                  Assim que o pagamento for identificado, o processo continuará automaticamente.
                </p>
              </div>

              {valorTotal > 0 && (
                <div className="mt-6 flex items-center justify-between border-t border-border/60 pt-5">
                  <span className="text-sm text-muted-foreground">Valor</span>
                  <span className="text-xl font-semibold text-foreground tabular-nums">
                    R$ {valorTotal.toFixed(2).replace('.', ',')}
                  </span>
                </div>
              )}

              <div className="mt-6 space-y-3">
                {effectiveAction.kind === 'regenerate' && (
                  <Button
                    onClick={handleRegenerate}
                    disabled={isRegenerating}
                    className="w-full bg-foreground hover:bg-foreground/90 text-background rounded-xl text-[15px] font-medium gap-2 shadow-none"
                    style={{ height: 52 }}
                  >
                    {isRegenerating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Wallet className="h-4 w-4" strokeWidth={1.75} />
                    )}
                    Ir para pagamento
                  </Button>
                )}

                {effectiveAction.kind === 'external_redirect' && (
                  <Button
                    asChild
                    className="w-full bg-foreground hover:bg-foreground/90 text-background rounded-xl text-[15px] font-medium gap-2 shadow-none"
                    style={{ height: 52 }}
                  >
                    <a href={effectiveAction.checkoutUrl} target="_blank" rel="noopener noreferrer">
                      <Wallet className="h-4 w-4" strokeWidth={1.75} />
                      Ir para pagamento
                    </a>
                  </Button>
                )}

                {effectiveAction.kind === 'resume_modal' && (
                  <Button
                    onClick={() => onResume?.()}
                    className="w-full bg-foreground hover:bg-foreground/90 text-background rounded-xl text-[15px] font-medium gap-2 shadow-none"
                    style={{ height: 52 }}
                  >
                    <Wallet className="h-4 w-4" strokeWidth={1.75} />
                    Ir para pagamento
                  </Button>
                )}


                <Button
                  variant="outline"
                  onClick={checkPayment}
                  disabled={isChecking}
                  className="w-full rounded-xl text-[15px] font-medium gap-2 bg-card border-border text-foreground hover:bg-muted"
                  style={{ height: 52 }}
                >
                  {isChecking ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" strokeWidth={1.75} />
                  )}
                  Verificar pagamento agora
                </Button>
              </div>

              <div className="mt-5 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-40" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                </span>
                Verificação automática ativa
              </div>
            </>
          )}
        </div>

        {/* Rodapé */}
        <div className="mt-6 rounded-xl bg-muted/40 border border-border/60 px-5 py-4 flex items-start gap-3">
          <Shield className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" strokeWidth={1.5} />
          <p className="text-[12.5px] text-muted-foreground leading-relaxed text-center sm:text-left flex-1">
            O andamento do seu pedido continuará sendo atualizado nesta página. Em caso de dúvidas,
            entre em contato diretamente com o fotógrafo.
          </p>
        </div>
      </div>
    </LightPaymentSurface>
  );
}
