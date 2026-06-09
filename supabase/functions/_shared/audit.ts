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
    const { data, error } = await supabase.from('webhook_events_audit').upsert({
      correlation_id: params.correlationId,
      provider: params.provider,
      external_id: params.externalId,
      event_name: params.eventName,
      payload: params.payload,
      processed_status: params.status || 'pending',
      error_log: params.errorLog,
      processed_at: (params.status === 'success' || params.status === 'error') ? new Date().toISOString() : null
    }, { onConflict: 'provider,external_id,event_name' });
    
    if (error) console.error('Failed to write webhook audit log:', error);
    return data;
  } catch (err) {
    console.error('Webhook audit exception:', err);
  }
}

/**
 * Checks if a webhook event has already been successfully processed.
 * Uses a database-level lock to prevent concurrent processing of the same event.
 */
export async function acquireWebhookLock(provider: string, externalId: string, eventName: string): Promise<{
  isAlreadyProcessed: boolean;
  lockAcquired: boolean;
}> {
  try {
    // 1. Check if already processed (status = 'success')
    const { data: existing } = await supabase
      .from('webhook_events_audit')
      .select('processed_status')
      .eq('provider', provider)
      .eq('external_id', externalId)
      .eq('event_name', eventName)
      .maybeSingle();

    if (existing?.processed_status === 'success') {
      return { isAlreadyProcessed: true, lockAcquired: false };
    }

    // 2. Try to acquire a pg_advisory_lock for this specific webhook event
    // Using a hash of the combined identifiers
    const lockKey = `${provider}:${externalId}:${eventName}`;
    const { data: lockResult, error: lockError } = await supabase.rpc('try_acquire_advisory_lock', {
      lock_key: lockKey
    });

    if (lockError || !lockResult) {
      return { isAlreadyProcessed: false, lockAcquired: false };
    }

    return { isAlreadyProcessed: false, lockAcquired: true };
  } catch (err) {
    console.error('Error acquiring webhook lock:', err);
    return { isAlreadyProcessed: false, lockAcquired: false };
  }
}

export function getCorrelationId(req: Request): string {
  return req.headers.get('x-correlation-id') || crypto.randomUUID();
}
