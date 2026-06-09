import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.2';

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function logAuditEvent(params: {
  correlationId: string;
  eventType: string;
  source: 'edge_function' | 'trigger' | 'rpc';
  sourceName: string;
  userId?: string;
  galleryId?: string;
  sessionId?: string;
  payload?: any;
  status?: 'success' | 'error' | 'warning';
  errorMessage?: string;
}) {
  try {
    const { data, error } = await supabase.from('system_audit_logs').insert({
      correlation_id: params.correlationId,
      event_type: params.eventType,
      source: params.source,
      source_name: params.sourceName,
      user_id: params.userId,
      gallery_id: params.galleryId,
      session_id: params.sessionId,
      payload: params.payload,
      status: params.status || 'success',
      error_message: params.errorMessage
    });
    
    if (error) console.error('Failed to write audit log:', error);
  } catch (err) {
    console.error('Audit log exception:', err);
  }
}

export async function logWebhookEvent(params: {
  correlationId?: string;
  provider: string;
  externalId?: string;
  eventName?: string;
  payload: any;
  status?: string;
  errorLog?: string;
}) {
  try {
    const { data, error } = await supabase.from('webhook_events_audit').insert({
      correlation_id: params.correlationId,
      provider: params.provider,
      external_id: params.externalId,
      event_name: params.eventName,
      payload: params.payload,
      processed_status: params.status || 'pending',
      error_log: params.errorLog
    });
    
    if (error) console.error('Failed to write webhook audit log:', error);
    return data;
  } catch (err) {
    console.error('Webhook audit exception:', err);
  }
}

export function getCorrelationId(req: Request): string {
  return req.headers.get('x-correlation-id') || crypto.randomUUID();
}
