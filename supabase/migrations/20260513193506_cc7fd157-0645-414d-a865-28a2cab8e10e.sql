-- 1. Remove jobs duplicados de process-photos
SELECT cron.unschedule(7);
SELECT cron.unschedule(8);

-- 2. Recria job único de process-photos (batchSize=10, sem service_role_key hardcoded)
SELECT cron.schedule(
  'process-photos-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://tlnjspsywycbudhewsfv.supabase.co/functions/v1/process-photos'::text,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{"batchSize": 10}'::jsonb
  ) AS request_id;
  $$
);

-- 3. Limpa histórico antigo do cron (>7 dias) — libera ~330 MB
DELETE FROM cron.job_run_details WHERE start_time < now() - interval '7 days';

-- 4. Cron diário de retention para impedir recorrência
SELECT cron.schedule(
  'cleanup-cron-history-daily',
  '0 3 * * *',
  $$ DELETE FROM cron.job_run_details WHERE start_time < now() - interval '7 days'; $$
);