import { useState, useEffect, useRef } from 'react';
import { Check, Clock, Info, Loader2, RefreshCw, Shield, Wallet, Eye, ImageIcon, Hourglass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

const SUPABASE_URL = 'https://tlnjspsywycbudhewsfv.supabase.co';
const POLL_MAX_DURATION = 10 * 60 * 1000;
const GET_ADAPTIVE_POLL_INTERVAL = (elapsedMs: number) => {
  if (elapsedMs < 15_000) return 2500;
  if (elapsedMs < 60_000) return 5000;
  if (elapsedMs < 180_000) return 15000;
  return 30000;
};

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
  onRegenerate?: () => void | Promise<void>;
  onPaymentConfirmed: () => void;
}

/* ---------- Ilustração ---------- */
function PendingIllustration() {
  return (
    <svg
      viewBox="0 0 240 180"
      className="mx-auto h-32 sm:h-40 w-auto"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {/* folhagem sutil */}
      <g className="text-[#D9D2C7]" opacity={0.9}>
        <path d="M40 70c8-14 20-18 30-14" />
        <path d="M52 62c-2-5-1-10 2-13" />
        <path d="M60 58c2-4 6-6 10-6" />
        <path d="M200 70c-8-14-20-18-30-14" />
        <path d="M188 62c2-5 1-10-2-13" />
        <path d="M180 58c-2-4-6-6-10-6" />
        <circle cx="35" cy="110" r="1.2" fill="currentColor" />
        <circle cx="210" cy="105" r="1.2" fill="currentColor" />
        <circle cx="120" cy="30" r="1.2" fill="currentColor" />
      </g>

      {/* janela / galeria */}
      <g className="text-[#8A8078]">
        <rect x="70" y="55" width="115" height="80" rx="6" />
        <circle cx="80" cy="65" r="1.5" fill="currentColor" />
        <circle cx="86" cy="65" r="1.5" fill="currentColor" />
        <circle cx="92" cy="65" r="1.5" fill="currentColor" />
        <line x1="70" y1="74" x2="185" y2="74" />
        {/* placeholders */}
        <rect x="80" y="84" width="45" height="42" rx="3" />
        <path d="M83 118l10-10 8 7 6-4 15 15" />
        <circle cx="93" cy="97" r="3" />
        <rect x="130" y="84" width="45" height="42" rx="3" />
        <path d="M133 118l10-10 8 7 6-4 15 15" />
        <circle cx="143" cy="97" r="3" />
      </g>

      {/* selo check */}
      <g className="text-[#8B6F4E]">
        <circle cx="72" cy="52" r="10" fill="#F3EEE7" stroke="currentColor" />
        <path d="M67 52l4 4 6-7" />
      </g>

      {/* cadeado */}
      <g className="text-[#8B6F4E]">
        <rect x="170" y="118" width="22" height="18" rx="3" fill="#F3EEE7" stroke="currentColor" />
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
  const base = 'flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium shrink-0';
  const styles: Record<StepState, string> = {
    done: 'bg-[#0F0F0F] text-white',
    active: 'bg-[#8B6F4E] text-white',
    upcoming: 'bg-white text-[#B0A89E] border border-[#E5E0D9]',
  };
  return (
    <div className={cn(base, styles[step.state])}>
      {step.state === 'done' ? <Check className="h-4 w-4" strokeWidth={2.2} /> : step.index}
    </div>
  );
}

function Timeline({ steps }: { steps: Step[] }) {
  return (
    <div className="rounded-3xl bg-white border border-[#EDE7DE] shadow-[0_8px_32px_-12px_rgba(20,15,10,0.06)] p-6 sm:p-8">
      {/* Desktop */}
      <div className="hidden sm:grid grid-cols-3 gap-4 relative">
        <div className="absolute top-[18px] left-[16%] right-[16%] h-px bg-[#E5E0D9]" />
        {steps.map((s) => (
          <div key={s.index} className="flex flex-col items-center text-center gap-3 relative z-10">
            <TimelineNode step={s} />
            <div>
              <p className="text-sm font-semibold text-[#2C2C2C]">{s.title}</p>
              <p className="text-xs text-[#8A8078] mt-1 leading-relaxed">{s.subtitle}</p>
            </div>
          </div>
        ))}
      </div>
      {/* Mobile */}
      <div className="sm:hidden flex flex-col gap-5">
        {steps.map((s, i) => (
          <div key={s.index} className="flex gap-4 items-start relative">
            <div className="flex flex-col items-center">
              <TimelineNode step={s} />
              {i < steps.length - 1 && <div className="w-px flex-1 min-h-8 bg-[#E5E0D9] mt-2" />}
            </div>
            <div className="pt-1">
              <p className="text-sm font-semibold text-[#2C2C2C]">{s.title}</p>
              <p className="text-xs text-[#8A8078] mt-0.5 leading-relaxed">{s.subtitle}</p>
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
  onRegenerate,
  onPaymentConfirmed,
}: PaymentPendingScreenProps) {
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
            title: awaitingCharge ? 'Gerar link de pagamento' : 'Pagamento pendente',
            subtitle: 'Aguardando conclusão',
            state: 'active',
          },
          {
            index: 3,
            title: 'Continuação do pedido',
            subtitle: 'A próxima etapa será iniciada após a confirmação',
            state: 'upcoming',
          },
        ];

  return (
    <div
      className="min-h-screen w-full text-[#2C2C2C]"
      style={{
        background:
          'radial-gradient(ellipse at top, #FAF6EF 0%, #F5F0E8 55%, #F0EAE0 100%)',
        ...themeStyles,
      }}
    >
      <div className="mx-auto max-w-2xl px-5 py-10 sm:px-8 sm:py-16">
        {/* Header */}
        <div className="flex flex-col items-center text-center mb-8 sm:mb-10">
          {studioLogoUrl ? (
            <div className="h-16 w-16 rounded-full bg-white/80 border border-[#EDE7DE] flex items-center justify-center overflow-hidden shadow-[0_4px_20px_-8px_rgba(20,15,10,0.08)]">
              <img
                src={studioLogoUrl}
                alt={studioName || 'Studio'}
                className="max-h-12 max-w-12 object-contain"
              />
            </div>
          ) : studioName ? (
            <p className="text-sm tracking-[0.2em] uppercase text-[#8A8078]">{studioName}</p>
          ) : null}
        </div>

        {/* Ilustração */}
        <PendingIllustration />

        {/* Título */}
        <div className="text-center mt-6 mb-10 space-y-3 px-2">
          <h1
            className="text-2xl sm:text-3xl font-semibold text-[#0F0F0F] tracking-tight"
            style={{ fontFamily: 'ui-serif, Georgia, "Times New Roman", serif' }}
          >
            {status === 'confirmed'
              ? 'Pagamento confirmado!'
              : status === 'timeout'
              ? 'Verificação em andamento'
              : 'Sua seleção foi salva!'}
          </h1>
          <p className="text-[15px] leading-relaxed text-[#6B6259] max-w-md mx-auto">
            {status === 'confirmed'
              ? 'Sua seleção foi finalizada com sucesso.'
              : status === 'timeout'
              ? 'Ainda não recebemos a confirmação. Se você já pagou, aguarde alguns instantes ou tente verificar novamente.'
              : 'Sua seleção já foi registrada e enviada ao fotógrafo. Para continuar o processo, basta concluir o pagamento, caso ele ainda esteja pendente.'}
          </p>
        </div>

        {/* Timeline */}
        <div className="mb-6">
          <Timeline steps={timelineSteps} />
        </div>

        {/* Card status */}
        <div className="rounded-3xl bg-white border border-[#EDE7DE] shadow-[0_8px_32px_-12px_rgba(20,15,10,0.06)] p-6 sm:p-8 mb-6">
          {status === 'confirmed' ? (
            <div className="flex flex-col items-center text-center gap-4 py-4">
              <div className="h-14 w-14 rounded-full bg-[#F0EDE7] flex items-center justify-center">
                <Check className="h-7 w-7 text-[#4A6B4A]" strokeWidth={1.75} />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-[#8A8078] mb-2">
                  Status do pedido
                </p>
                <h2
                  className="text-xl font-semibold text-[#0F0F0F]"
                  style={{ fontFamily: 'ui-serif, Georgia, serif' }}
                >
                  Pagamento confirmado
                </h2>
                <p className="text-sm text-[#6B6259] mt-2">
                  Você já pode fechar esta página com tranquilidade.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row items-start gap-5">
                <div className="h-14 w-14 rounded-full bg-[#F3EEE7] flex items-center justify-center shrink-0 mx-auto sm:mx-0">
                  <Clock className="h-6 w-6 text-[#8B6F4E]" strokeWidth={1.5} />
                </div>
                <div className="flex-1 text-center sm:text-left">
                  <p className="text-xs uppercase tracking-[0.18em] text-[#8B6F4E] font-medium mb-2">
                    Status do pedido
                  </p>
                  <h2
                    className="text-2xl font-semibold text-[#0F0F0F] leading-tight"
                    style={{ fontFamily: 'ui-serif, Georgia, serif' }}
                  >
                    {awaitingCharge ? 'Link de pagamento necessário' : 'Aguardando pagamento'}
                  </h2>
                  <p className="text-sm text-[#6B6259] mt-2 leading-relaxed">
                    {awaitingCharge
                      ? 'Precisamos gerar um novo link para você concluir o pagamento.'
                      : 'Seu pedido está aguardando a conclusão do pagamento.'}
                  </p>
                </div>
              </div>

              {/* Info neutra */}
              <div className="mt-6 rounded-2xl bg-[#F7F2EA] border border-[#EDE7DE] px-4 py-3 flex items-start gap-3">
                <Info className="h-4 w-4 text-[#8B6F4E] mt-0.5 shrink-0" strokeWidth={1.5} />
                <p className="text-[13px] text-[#6B6259] leading-relaxed">
                  Assim que o pagamento for identificado, o processo continuará automaticamente.
                </p>
              </div>

              {/* Valor */}
              {valorTotal > 0 && (
                <div className="mt-6 flex items-center justify-between border-t border-[#EDE7DE] pt-5">
                  <span className="text-sm text-[#8A8078]">Valor</span>
                  <span className="text-xl font-semibold text-[#0F0F0F] tabular-nums">
                    R$ {valorTotal.toFixed(2).replace('.', ',')}
                  </span>
                </div>
              )}

              {/* Botões */}
              <div className="mt-6 space-y-3">
                {awaitingCharge ? (
                  <Button
                    onClick={handleRegenerate}
                    disabled={isRegenerating}
                    className="w-full h-13 bg-[#0F0F0F] hover:bg-[#1f1f1f] text-white rounded-xl text-[15px] font-medium gap-2 shadow-none"
                    style={{ height: 52 }}
                  >
                    {isRegenerating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Wallet className="h-4 w-4" strokeWidth={1.75} />
                    )}
                    Gerar link de pagamento
                  </Button>
                ) : (
                  checkoutUrl && (
                    <Button
                      asChild
                      className="w-full bg-[#0F0F0F] hover:bg-[#1f1f1f] text-white rounded-xl text-[15px] font-medium gap-2 shadow-none"
                      style={{ height: 52 }}
                    >
                      <a href={checkoutUrl} target="_blank" rel="noopener noreferrer">
                        <Wallet className="h-4 w-4" strokeWidth={1.75} />
                        Ir para pagamento
                      </a>
                    </Button>
                  )
                )}

                <Button
                  variant="outline"
                  onClick={checkPayment}
                  disabled={isChecking}
                  className="w-full rounded-xl text-[15px] font-medium gap-2 bg-white border-[#E5E0D9] text-[#2C2C2C] hover:bg-[#FAF6EF] hover:text-[#0F0F0F]"
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

              {/* Indicador */}
              <div className="mt-5 flex items-center justify-center gap-2 text-xs text-[#8A8078]">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#8B6F4E] opacity-40" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#8B6F4E]" />
                </span>
                Verificação automática ativa
              </div>
            </>
          )}
        </div>

        {/* Próximos passos */}
        {status !== 'confirmed' && (
          <div className="rounded-3xl bg-white border border-[#EDE7DE] shadow-[0_8px_32px_-12px_rgba(20,15,10,0.06)] p-6 sm:p-8 mb-6">
            <h3 className="text-center text-[15px] font-semibold text-[#0F0F0F] mb-6">
              Próximos passos
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {[
                {
                  icon: ImageIcon,
                  title: 'Seleção salva',
                  desc: 'Sua seleção foi registrada com sucesso.',
                },
                {
                  icon: Eye,
                  title: 'Fotógrafo notificado',
                  desc: 'O fotógrafo já pode visualizar sua seleção.',
                },
                {
                  icon: Hourglass,
                  title: 'Pedido em andamento',
                  desc:
                    'Após a conclusão do pagamento (quando aplicável), seu pedido seguirá normalmente.',
                },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="flex flex-col items-center text-center gap-3">
                  <div className="h-11 w-11 rounded-full bg-[#F3EEE7] flex items-center justify-center">
                    <Icon className="h-5 w-5 text-[#8B6F4E]" strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#2C2C2C]">{title}</p>
                    <p className="text-xs text-[#8A8078] mt-1 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rodapé */}
        <div className="rounded-2xl bg-[#F3EEE7]/60 border border-[#EDE7DE] px-5 py-4 flex items-start gap-3">
          <Shield className="h-4 w-4 text-[#8A8078] mt-0.5 shrink-0" strokeWidth={1.5} />
          <p className="text-[12.5px] text-[#6B6259] leading-relaxed text-center sm:text-left flex-1">
            O andamento do seu pedido continuará sendo atualizado nesta página. Em caso de dúvidas,
            entre em contato diretamente com o fotógrafo.
          </p>
        </div>
      </div>
    </div>
  );
}
