import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Loader2, Link2, X } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface OrphanPayment {
  id: string;
  created_at: string;
  valor: number;
  descricao: string | null;
  provedor: string | null;
  status: string;
}

interface OrphanPaymentsBannerProps {
  galleryId: string;
  sessionId: string | null | undefined;
  userId: string;
}

/**
 * Detecta cobranças pagas cuja `session_id` casa com a galeria mas que
 * estão sem `galeria_id` / `finalidade='fotos_extras'` (tipicamente
 * criadas pelo Studio sem declarar o vínculo). Permite à fotógrafa
 * vincular manualmente em um clique.
 */
export function OrphanPaymentsBanner({
  galleryId,
  sessionId,
  userId,
}: OrphanPaymentsBannerProps) {
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data: orphans = [], refetch } = useQuery({
    queryKey: ['gallery-orphan-payments', galleryId, sessionId],
    queryFn: async (): Promise<OrphanPayment[]> => {
      if (!sessionId) return [];
      const { data, error } = await supabase
        .from('cobrancas')
        .select('id, created_at, valor, descricao, provedor, status, dados_extras')
        .eq('user_id', userId)
        .eq('session_id', sessionId)
        .is('galeria_id', null)
        .in('status', ['pago', 'pago_manual'])
        .neq('finalidade', 'fotos_extras')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching orphan payments:', error);
        return [];
      }
      // Filtra os que a fotógrafa já marcou como "ignorar" para esta galeria
      return (data || []).filter((c: any) => {
        const ignoredFor = c?.dados_extras?.ignored_by_gallery_id;
        return ignoredFor !== galleryId;
      });
    },
    enabled: !!sessionId && !!userId,
  });

  if (!sessionId || orphans.length === 0) return null;

  const handleVincular = async (cobrancaId: string) => {
    setBusyId(cobrancaId);
    try {
      const { data, error } = await supabase.rpc('claim_orphan_payment_for_gallery', {
        p_cobranca_id: cobrancaId,
        p_galeria_id: galleryId,
      });

      if (error) throw error;
      const result = data as { success: boolean; error?: string };
      if (!result?.success) {
        throw new Error(result?.error || 'Falha ao vincular pagamento');
      }

      toast.success('Pagamento vinculado à galeria com sucesso');
      queryClient.invalidateQueries({ queryKey: ['galerias'] });
      queryClient.invalidateQueries({ queryKey: ['galeria-cobrancas-pagas'] });
      queryClient.invalidateQueries({ queryKey: ['galeria-cobranca-pendente'] });
      queryClient.invalidateQueries({ queryKey: ['gallery-orphan-payments'] });
      refetch();
    } catch (err) {
      console.error('Erro ao vincular cobrança:', err);
      toast.error(err instanceof Error ? err.message : 'Erro ao vincular pagamento');
    } finally {
      setBusyId(null);
    }
  };

  const handleIgnorar = async (cobrancaId: string) => {
    setBusyId(cobrancaId);
    try {
      // Lê dados_extras atual e adiciona a flag
      const { data: current, error: readErr } = await supabase
        .from('cobrancas')
        .select('dados_extras')
        .eq('id', cobrancaId)
        .single();
      if (readErr) throw readErr;

      const next = {
        ...(current?.dados_extras as Record<string, unknown> | null ?? {}),
        ignored_by_gallery_id: galleryId,
      };

      const { error: updErr } = await supabase
        .from('cobrancas')
        .update({ dados_extras: next })
        .eq('id', cobrancaId);
      if (updErr) throw updErr;

      toast.success('Pagamento ignorado para esta galeria');
      refetch();
    } catch (err) {
      console.error('Erro ao ignorar cobrança:', err);
      toast.error('Não foi possível ignorar este pagamento');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="lunari-card border-amber-500/40 bg-amber-500/5 p-5 space-y-4 md:col-span-2">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
        <div className="flex-1 space-y-1">
          <h3 className="font-medium text-sm">
            {orphans.length === 1
              ? 'Detectamos 1 pagamento na sessão que não está vinculado a esta galeria'
              : `Detectamos ${orphans.length} pagamentos na sessão que não estão vinculados a esta galeria`}
          </h3>
          <p className="text-xs text-muted-foreground">
            Esses pagamentos foram registrados na mesma sessão, mas sem indicar que são
            fotos extras desta galeria. Se forem extras, vincule abaixo — caso contrário,
            ignore para que o aviso desapareça.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {orphans.map((c) => (
          <div
            key={c.id}
            className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-md bg-background/50 border border-amber-500/20"
          >
            <div className="flex-1 min-w-0 text-sm">
              <div className="font-medium truncate">
                {c.descricao || 'Sem descrição'}
              </div>
              <div className="text-xs text-muted-foreground">
                {format(new Date(c.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                {' · '}
                R$ {Number(c.valor).toFixed(2).replace('.', ',')}
                {c.provedor ? ` · ${c.provedor}` : ''}
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <Button
                size="sm"
                variant="default"
                disabled={busyId === c.id}
                onClick={() => handleVincular(c.id)}
              >
                {busyId === c.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Link2 className="h-3.5 w-3.5" />
                )}
                <span className="ml-1.5">Vincular como fotos extras</span>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busyId === c.id}
                onClick={() => handleIgnorar(c.id)}
              >
                <X className="h-3.5 w-3.5" />
                <span className="ml-1.5">Ignorar</span>
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
