
# Fix: Watermark Defaults + Favicon Card Verification

## Problem 1: Watermark defaults not loading

There are two separate watermark storage systems that are out of sync:

- **Personalization page** saves to `photographer_accounts` table (via `useWatermarkSettings`) -- columns: `watermark_mode`, `watermark_opacity`, `watermark_path`
- **GalleryCreate** reads defaults from `gallery_settings.default_watermark` JSON (via `useGallerySettings`) -- which has hardcoded defaults of `type: 'standard'`, `opacity: 40`

When the photographer sets "Minha Marca" with 75% opacity in Personalization, it saves to `photographer_accounts`. But when creating a new gallery, the code reads from the wrong table (`gallery_settings`), getting stale defaults instead.

## Solution

In `GalleryCreate.tsx`, replace the watermark initialization from `settings.defaultWatermark` with values from `useWatermarkSettings`:

### File: `src/pages/GalleryCreate.tsx`

The hook `useWatermarkSettings` is already imported (line 37). The fix:

1. Call the hook to get watermark settings: `const { settings: watermarkGlobalSettings } = useWatermarkSettings();`
2. In the `useEffect` that initializes from settings (lines 198-220), replace:
   ```
   if (settings.defaultWatermark) {
     setWatermarkType(settings.defaultWatermark.type);
     setWatermarkOpacity(settings.defaultWatermark.opacity || 40);
   }
   ```
   with reading from `watermarkGlobalSettings`:
   ```
   // Map mode names: useWatermarkSettings uses 'system', GalleryCreate uses 'standard'
   const modeToType = { system: 'standard', custom: 'custom', none: 'none' };
   setWatermarkType(modeToType[watermarkGlobalSettings.mode] as WatermarkType);
   setWatermarkOpacity(watermarkGlobalSettings.opacity);
   ```
3. Add `watermarkGlobalSettings` to the useEffect dependency array so it updates when the data loads from the database.

### Mapping between the two naming conventions

| Personalization (useWatermarkSettings) | GalleryCreate (WatermarkType) |
|---------------------------------------|-------------------------------|
| `mode: 'system'`                       | `type: 'standard'`           |
| `mode: 'custom'`                       | `type: 'custom'`             |
| `mode: 'none'`                         | `type: 'none'`               |

## Problem 2: Favicon/Logo cards

The code already has both components inside one card (confirmed in `PersonalizationSettings.tsx` lines 26-36). The screenshot may be from a cached version. No code changes needed -- will verify visually after deploying.

## Files Changed

| File | Change |
|------|--------|
| `src/pages/GalleryCreate.tsx` | Read watermark defaults from `useWatermarkSettings` instead of `settings.defaultWatermark` |
