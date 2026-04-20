import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthContext } from '@/contexts/AuthContext';

export type EmailDeliveryStatus = 'enviado' | 'erro' | 'ignorado';
export type EmailDeliveryEventType = 'gallery_sent' | 'payment_confirmed';

export interface EmailDeliveryLog {
  id: string;
  clienteNome: string | null;
  clienteEmail: string | null;
  eventType: EmailDeliveryEventType;
  status: EmailDeliveryStatus;
  friendlyMessage: string | null;
  createdAt: Date;
}

export function useEmailLogs(limit = 8) {
  const { user } = useAuthContext();

  return useQuery({
    queryKey: ['email-delivery-logs', user?.id, limit],
    enabled: !!user?.id,
    queryFn: async (): Promise<EmailDeliveryLog[]> => {
      const { data, error } = await (supabase as any)
        .from('email_delivery_logs')
        .select('id, cliente_nome, cliente_email, event_type, status, friendly_message, created_at')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return (data || []).map((log: any) => ({
        id: log.id,
        clienteNome: log.cliente_nome,
        clienteEmail: log.cliente_email,
        eventType: log.event_type,
        status: log.status,
        friendlyMessage: log.friendly_message,
        createdAt: new Date(log.created_at),
      }));
    },
  });
}
