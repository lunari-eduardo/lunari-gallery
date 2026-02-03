# Plan: Checkout and Download Flow Fixes — COMPLETED ✅

## Summary of Changes

All 4 bugs identified have been fixed:

### Bug 1: `chargeType` in Edge Function ✅
- Modified `supabase/functions/confirm-selection/index.ts`
- Now reads `chargeType` from `configuracoes.saleSettings`
- When `chargeType === 'all_selected'`, charges for ALL selected photos
- When `chargeType === 'only_extras'`, charges only photos beyond included limit

### Bug 2: `chargeType` in ClientGallery ✅
- Updated `src/pages/ClientGallery.tsx`
- Fixed extras calculation to respect `chargeType` setting
- Fixed `handleConfirm()` to use correct calculation

### Bug 3: State Update Order ✅
- Reordered `onSuccess` handler in confirmMutation
- `setIsConfirmed(true)` now happens AFTER determining payment route
- Prevents flash between confirmation and payment screens

### Bug 4: Auto-Open Download Modal ✅
- Added `useEffect` to auto-open download modal after confirmation
- Only triggers when `isConfirmed && currentStep === 'confirmed' && allowDownload`
- Uses `hasAutoOpenedDownload` flag to prevent reopening on reloads

### Gallery URL Utility ✅
- Created `src/lib/galleryUrl.ts` with production domain
- All gallery links now use `https://gallery.lunarihub.com` instead of `window.location.origin`
- Updated components:
  - `src/pages/GalleryDetail.tsx`
  - `src/pages/GalleryEdit.tsx`
  - `src/components/SendGalleryModal.tsx`

## Files Modified

| File | Changes |
|------|---------|
| `supabase/functions/confirm-selection/index.ts` | Added chargeType logic for extras calculation |
| `src/pages/ClientGallery.tsx` | Fixed chargeType, state order, auto-open modal |
| `src/lib/galleryUrl.ts` | NEW: Production URL utility |
| `src/pages/GalleryDetail.tsx` | Use getGalleryUrl() |
| `src/pages/GalleryEdit.tsx` | Use getGalleryUrl() |
| `src/components/SendGalleryModal.tsx` | Use getGalleryUrl() |

## Expected Behavior After Fix

1. **Public galleries with `chargeType: 'all_selected'`** will redirect to checkout before showing download
2. **Gallery links** shared via WhatsApp/Email will use production domain
3. **Download modal** opens automatically after payment confirmation
4. **No flash** between confirmation and payment screens
