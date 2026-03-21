
-- ============================================================
-- 1. Drop old 3-arg signature to prevent future ambiguity
-- ============================================================
DROP FUNCTION IF EXISTS finalize_gallery_payment(uuid, text, timestamptz);

-- ============================================================
-- 2. Fix Antônia 4 anos: update cobrança with payment data
--    from confirmed webhook logs, then finalize via RPC
-- ============================================================
UPDATE cobrancas
SET ip_receipt_url = 'https://recibo.infinitepay.io/77cc7ac0-baa4-4684-b597-28fd07a89acd',
    ip_transaction_nsu = '77cc7ac0-baa4-4684-b597-28fd07a89acd'
WHERE id = '25b5dfd1-d696-4ce8-85d8-ca946cb5e445'
  AND ip_receipt_url IS NULL;

SELECT finalize_gallery_payment(
  '25b5dfd1-d696-4ce8-85d8-ca946cb5e445'::uuid,
  'https://recibo.infinitepay.io/77cc7ac0-baa4-4684-b597-28fd07a89acd'::text,
  '2026-03-21T14:02:14Z'::timestamptz,
  NULL::text,
  NULL::text
);

-- ============================================================
-- 3. Mark failed webhook attempts as recovered for audit
-- ============================================================
UPDATE webhook_logs
SET status = 'recovered',
    error_message = COALESCE(error_message, '') || ' [recovered via migration 2026-03-21]'
WHERE order_nsu = 'gallery-1774101734173-jr3t9g'
  AND status = 'error';
