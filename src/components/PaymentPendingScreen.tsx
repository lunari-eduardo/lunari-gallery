import { useState, useEffect, useRef } from 'react';
import { Clock, Check, ExternalLink, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

const SUPABASE_URL = 'https://tlnjspsywycbudhewsfv.supabase.co';
const POLL_MAX_DURATION = 10 * 60 * 1000; // 10 minutes
const GET_ADAPTIVE_POLL_INTERVAL = (elapsedMs: number) => {
  if (elapsedMs < 15_000) return 2500;   // 2.5s nos primeiros 15s
  if (elapsedMs < 60_000) return 5000;   // 5s no primeiro minuto
  if (elapsedMs < 180_000) return 15000; // 15s até 3 min
  return 30000;                         // 30s após
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

export function PaymentPendingScreen({
  cobrancaId,
  sessionId,
  checkoutUrl,
  valorTotal,
  provedor,
  studioName,
  studioLogoUrl,
  themeStyles = {},
  backgroundMode = 'light',
  awaitingCharge = false,
  onRegenerate,
  onPaymentConfirmed,
}: PaymentPendingScreenProps) {

  const [status, setStatus] = useState<'polling' | 'confirmed' | 'timeout'>('polling');
  const [pollCount, setPollCount] = useState(0);
  const [isChecking, setIsChecking] = useState(false);
  const startTimeRef = useRef(Date.now());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const provedorName = provedor === 'infinitepay' ? 'InfinitePay' 
    : provedor === 'mercadopago' ? 'Mercado Pago' 
    : 'pagamento';

  const checkPayment = async () => {
    if (!cobrancaId && !sessionId) return;
    
    setIsChecking(true);
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/check-payment-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          cobrancaId,
          sessionId,
          forceUpdate: false,
        }),
      });
      
      const result = await response.json();
      console.log('[PaymentPending] Poll result:', result);
      
      if (result.status === 'pago') {
        setStatus('confirmed');
        if (intervalRef.current) clearInterval(intervalRef.current);
        
        // Brief delay for success animation
        setTimeout(() => {
          onPaymentConfirmed();
        }, 2000);
        return;
      }
      
      setPollCount(c => c + 1);
      
      // Check if we've exceeded max duration
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

  // Primary: Supabase Realtime subscription on cobrancas table
  // Fallback: polling every 60s if realtime fails
  useEffect(() => {
    startTimeRef.current = Date.now();
    let realtimeActive = false;
    let pollTimeout: ReturnType<typeof setTimeout> | null = null;
    
    const scheduleNextPoll = () => {
      if (pollTimeout) clearTimeout(pollTimeout);
      const elapsed = Date.now() - startTimeRef.current;
      if (elapsed > POLL_MAX_DURATION) {
        setStatus('timeout');
        return;
      }
      
      const nextInterval = GET_ADAPTIVE_POLL_INTERVAL(elapsed);
      pollTimeout = setTimeout(async () => {
        // Poll se realtime não estiver confirmadamente ativo OU como rede de segurança
        await checkPayment();
        scheduleNextPoll();
      }, nextInterval);
    };

    // Immediate check
    checkPayment();
    scheduleNextPoll();

    // Set up Realtime subscription — ONLY se tivermos cobrancaId específico.
    // Sem filter por id, o canal receberia UPDATEs de qualquer cobrança
    // (leak entre clientes), disparando falsos positivos de "confirmed".
    let channel: ReturnType<typeof supabase.channel> | null = null;
    if (cobrancaId) {
      const channelName = `payment-${cobrancaId}`;
      channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'cobrancas',
            filter: `id=eq.${cobrancaId}`,
          },
          (payload) => {
            console.log('[PaymentPending] Realtime update:', payload.new);
            const newStatus = (payload.new as any).status;
            if (newStatus === 'pago' || newStatus === 'pago_manual') {
              setStatus('confirmed');
              if (pollTimeout) clearTimeout(pollTimeout);
              setTimeout(() => onPaymentConfirmed(), 2000);
            }
          }
        )
        .subscribe((status) => {
          console.log('[PaymentPending] Realtime status:', status);
          realtimeActive = status === 'SUBSCRIBED';
        });
    } else {
      console.warn('[PaymentPending] Sem cobrancaId — realtime desabilitado; usando apenas polling.');
    }


    // Handle tab visibility (PWA/Mobile sleep)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[PaymentPending] Tab visible - forcing immediate check');
        checkPayment();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      if (channel) supabase.removeChannel(channel);
      if (pollTimeout) clearTimeout(pollTimeout);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [cobrancaId, sessionId]);

  const isDark = backgroundMode === 'dark';

  return (
    <div 
      className={cn(
        "min-h-screen flex flex-col items-center justify-center p-4",
        isDark ? 'bg-[#1a1a1a] text-white' : 'bg-[#FAFAF8] text-[#2C2C2C]'
      )}
      style={themeStyles}
    >
      <div className="max-w-sm w-full text-center space-y-8">
        {/* Studio logo */}
        {studioLogoUrl && (
          <img 
            src={studioLogoUrl} 
            alt={studioName || 'Studio'} 
            className="h-16 mx-auto object-contain opacity-60"
          />
        )}

        {awaitingCharge && status === 'polling' && (
          <>
            <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center bg-amber-100 dark:bg-amber-900/30">
              <AlertCircle className="h-8 w-8 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="space-y-2">
              <h1 className="text-xl font-semibold">Sua seleção foi finalizada</h1>
              <p className={cn("text-sm", isDark ? 'text-white/60' : 'text-[#8A8078]')}>
                O link de pagamento precisa ser gerado novamente. Clique abaixo para continuar.
              </p>
            </div>
            <div className={cn(
              "rounded-lg p-4 border",
              isDark ? 'border-white/10 bg-white/5' : 'border-[#E5E0D9] bg-white'
            )}>
              <p className={cn("text-xs mb-1", isDark ? 'text-white/40' : 'text-[#8A8078]')}>Valor a pagar</p>
              <p className="text-2xl font-bold">R$ {valorTotal.toFixed(2)}</p>
            </div>
            {onRegenerate && (
              <Button onClick={() => onRegenerate()} className="w-full" variant="terracotta">
                Gerar novo link de pagamento
              </Button>
            )}
            <p className={cn("text-xs", isDark ? 'text-white/40' : 'text-[#8A8078]')}>
              Se o problema persistir, entre em contato com o fotógrafo.
            </p>
          </>
        )}

        {!awaitingCharge && status === 'polling' && (

          <>
            <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center bg-amber-100 dark:bg-amber-900/30">
              <Clock className="h-8 w-8 text-amber-600 dark:text-amber-400 animate-pulse" />
            </div>
            <div className="space-y-2">
              <h1 className="text-xl font-semibold">Aguardando confirmação do pagamento</h1>
              <p className={cn("text-sm", isDark ? 'text-white/60' : 'text-[#8A8078]')}>
                Estamos verificando automaticamente. Isso pode levar alguns minutos.
              </p>
            </div>

            {/* Value */}
            <div className={cn(
              "rounded-lg p-4 border",
              isDark ? 'border-white/10 bg-white/5' : 'border-[#E5E0D9] bg-white'
            )}>
              <p className={cn("text-xs mb-1", isDark ? 'text-white/40' : 'text-[#8A8078]')}>
                Valor via {provedorName}
              </p>
              <p className="text-2xl font-bold">R$ {valorTotal.toFixed(2)}</p>
            </div>

            {/* Polling indicator */}
            <div className={cn("flex items-center justify-center gap-2 text-xs", isDark ? 'text-white/40' : 'text-[#8A8078]')}>
              {isChecking ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              )}
              <span>Verificação automática ativa</span>
            </div>

            {/* Optional: open checkout again */}
            {checkoutUrl && (
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2"
                asChild
              >
                <a href={checkoutUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  Retomar pagamento
                </a>
              </Button>
            )}

            {/* Manual retry */}
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={checkPayment}
              disabled={isChecking}
            >
              {isChecking ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Verificar agora
            </Button>
          </>
        )}

        {status === 'confirmed' && (
          <>
            <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center bg-green-100 dark:bg-green-900/30">
              <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <div className="space-y-2">
              <h1 className="text-xl font-semibold">Pagamento confirmado!</h1>
              <p className={cn("text-sm", isDark ? 'text-white/60' : 'text-[#8A8078]')}>
                Sua seleção foi finalizada com sucesso.
              </p>
            </div>
          </>
        )}

        {status === 'timeout' && (
          <>
            <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center bg-amber-100 dark:bg-amber-900/30">
              <AlertCircle className="h-8 w-8 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="space-y-2">
              <h1 className="text-xl font-semibold">Verificação em andamento</h1>
              <p className={cn("text-sm", isDark ? 'text-white/60' : 'text-[#8A8078]')}>
                Ainda não recebemos a confirmação. Se você já pagou, tente novamente em alguns minutos.
              </p>
            </div>
            <div className="space-y-3">
              <Button
                onClick={() => {
                  startTimeRef.current = Date.now();
                  setStatus('polling');
                  setPollCount(0);
                  checkPayment();
                }}
                className="w-full"
                variant="terracotta"
              >
                Verificar novamente
              </Button>
              {checkoutUrl && (
                <Button variant="outline" className="w-full gap-2" asChild>
                  <a href={checkoutUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    Retomar pagamento
                  </a>
                </Button>
              )}
            </div>
          </>
        )}

        <p className={cn("text-xs", isDark ? 'text-white/30' : 'text-[#B0A89E]')}>
          Pagamento processado por {provedorName}
        </p>
      </div>
    </div>
  );
}
