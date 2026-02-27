

# Plan: Buy Credits button + View/Delete uploaded photos with credit refund

## 1. Fix "Comprar" button in PhotoUploader credit warning (line 251)

Currently the button is `disabled`. Change it to navigate to `/credits` using `useNavigate` from react-router-dom.

**File:** `src/components/PhotoUploader.tsx`
- Import `useNavigate` from react-router-dom
- Add `const navigate = useNavigate()` 
- Replace `disabled` on the Comprar button with `onClick={() => navigate('/credits')}`

## 2. Add "Ver fotos" button + photo grid with delete in GalleryCreate step 4

Currently `uploadedCount > 0` shows a static card with "X fotos enviadas" and no actions. Replace this with:

**File:** `src/pages/GalleryCreate.tsx`

- Add state `showUploadedPhotos` (boolean, default false)
- Add `isDeletingPhoto` state
- Import `deletePhoto` from `useSupabaseGalleries`
- In the "fotos enviadas" card (line ~1416-1430), add a "Ver fotos" button
- When clicked, toggle a collapsible grid showing all `uploadedPhotos` as thumbnails
- Each photo has a delete button (X icon on hover)
- On delete:
  1. Call `deletePhoto({ galleryId: supabaseGalleryId, photoId })` to remove from R2 + DB
  2. Call `supabase.rpc('admin_grant_credits', ...)` — actually, we need a simpler approach. Since `consume_photo_credits` decremented the balance, we need to **refund 1 credit** back. We'll use `admin_grant_credits` RPC which already exists, but it requires admin role. Instead, we should update `photographer_accounts.photo_credits` directly or create a new approach.

**Credit refund approach:** The `r2-upload` edge function already handles credit consumption via `consume_photo_credits` RPC. For refund on delete, we'll call the existing `delete-photos` edge function (which already handles R2 + DB cleanup). For credit refund, we need to add a param `refundCredits: true` to the delete-photos call so it can refund. However, modifying the edge function is complex.

**Simpler approach:** Since the `delete-photos` edge function already runs server-side with service role, we can modify it to accept a `refundCredits` flag and call a new RPC or directly increment `photo_credits`. But since we can't easily deploy edge functions here, we'll handle it client-side by calling the existing delete + a separate RPC call.

Looking at available RPCs: `admin_grant_credits` requires admin role. We need a user-callable refund mechanism. The simplest is to directly update `photographer_accounts` — but RLS only allows own-user access. Let me check:

Actually, `photographer_accounts` has `auth.uid() = user_id` policy for ALL. So users can update their own record. We can increment `photo_credits` by 1 after successful delete. This is what we'll do.

**Revised delete flow in GalleryCreate:**
1. Call `deletePhoto({ galleryId, photoId })` — removes from R2 + DB
2. If `!skipCredits`: increment `photographer_accounts.photo_credits` by 1 via direct update + decrement `credits_consumed_total` by 1
3. Update local state: remove photo from `uploadedPhotos`, decrement `uploadedCount`
4. Refetch credits via `refetchCredits()`
5. Toast: "Foto excluída e crédito devolvido"

## Summary of changes

### `src/components/PhotoUploader.tsx`
- Import `useNavigate`
- Make "Comprar" button functional with `onClick={() => navigate('/credits')}`

### `src/pages/GalleryCreate.tsx`
- Add `showUploadedPhotos` state
- Import `deletePhoto` and `isDeletingPhoto` from `useSupabaseGalleries`  
- Import `usePhotoCredits` for `refetch`
- Add `handleDeleteUploadedPhoto` function that deletes photo, refunds credit, updates local state
- Replace static "fotos enviadas" card with expandable version containing "Ver fotos" button
- Add collapsible photo grid with delete capability on each photo
- Use photo URL from `storageKey` via `getPhotoUrl` helper

