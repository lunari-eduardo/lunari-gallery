

# Fix: Show free storage on Credits page + data location answer

## Problem
Credits.tsx only checks `hasTransferPlan` (paid plans). When user has only free 0.5GB, it shows "Ative um plano..." marketing text instead of showing the free storage bar. The hook already exposes `hasFreeStorageOnly` and `freeTransferBytes` but Credits.tsx doesn't use them.

## Fix: `src/pages/Credits.tsx`

1. Destructure `hasFreeStorageOnly` and `freeTransferBytes` from `useTransferStorage()`
2. Add a new condition branch between `hasTransferPlan` and the fallback marketing text:

```
hasTransferPlan → show plan name + storage bar (existing)
hasFreeStorageOnly → show "Armazenamento gratuito" + 0.5GB bar + used/limit
else → show "Ative um plano..." marketing (existing)
```

The free storage block will show:
- Label: "Armazenamento gratuito"
- Usage: "X MB de 512 MB usados"
- Progress bar
- Small note: "Incluído no cadastro"

## Data location answer

Credits and storage limits are stored in `photographer_accounts`:
- `photo_credits` — Select credit balance
- `free_transfer_bytes` — free storage (0.5GB default)
- `credits_purchased_total` / `credits_consumed_total` — aggregates

The `profiles` table only stores identity data (email, name). Mixing billing data into `profiles` is not recommended — `photographer_accounts` is the correct place and already has a 1:1 relationship with `user_id`. Both projects query the same table.

