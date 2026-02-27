

# Enforce Transfer Storage Limits During Upload

## Problem
Storage limits exist in `photographer_accounts.free_transfer_bytes` but are never checked during photo uploads. Users can upload beyond their limit. The Dashboard's `TransferStorageIndicator` also hides when there's no paid plan (line 41: `!hasTransferPlan` returns null), so free-storage users never see warnings.

## Changes

### 1. `src/components/PhotoUploader.tsx` — Add storage limit props and enforcement

- Add optional props: `storageLimit?: number`, `storageUsed?: number`, `onStorageLimitHit?: () => void`
- In `addFiles()`, when `skipCredits` is true (Transfer mode), estimate total bytes of selected files and check against remaining storage
- If files would exceed limit: calculate how many fit, toast warning "Galeria será salva com X de Y fotos. Faça upgrade ou exclua galerias antigas para liberar espaço.", only queue the files that fit
- If storage is already full: block upload entirely with toast error
- Add a storage warning banner (like the credit warning) when storage is ≥90% full

### 2. `src/pages/DeliverCreate.tsx` — Pass storage props to PhotoUploader

- Pass `storageLimit={storageLimitBytes}`, `storageUsed={storageUsedBytes}` and a callback `onStorageLimitHit` to the PhotoUploader on line 482-489
- The callback will show a toast and refetch storage data

### 3. `src/pages/DeliverDetail.tsx` — Same storage props for edit page

- Import `useTransferStorage` and pass the same storage props to PhotoUploader on line 276

### 4. `src/pages/Dashboard.tsx` — Show indicator for free storage users too

- Line 41: Change condition from `!hasTransferPlan` to `!hasTransferPlan && !hasFreeStorageOnly`
- Add `hasFreeStorageOnly` to the destructured values
- Show storage full badge (destructive) when `storageUsedPercent >= 100`

### 5. `src/pages/Credits.tsx` — Add storage full badge

- When `storageUsedPercent >= 100` (for both paid and free), show a small destructive badge "Armazenamento cheio" next to the progress bar

### Technical detail
- Storage check is approximate (uses `file.size` of originals as estimate) — matches how `get_transfer_storage_bytes` RPC counts `original_file_size`
- The server-side (r2-upload edge function) should ideally also enforce limits, but client-side enforcement provides immediate UX feedback

