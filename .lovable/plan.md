
# Fix: Download sends wrong path (R2 instead of B2)

## Root Cause (definitively identified)

The download flow has a data pipeline break:

```text
Database row:
  storage_key   = "galleries/.../1770651939351-16b939c4.jpg"  (R2 preview)
  original_path = "galleries/.../1770651936153-70ee9c55.jpg"  (B2 original)

ClientGallery.tsx transforms photos at line 326-355:
  storageKey = photo.storage_key       -- mapped
  original_path = ???                  -- NEVER MAPPED (lost here)

DownloadModal.tsx receives GalleryPhoto:
  sends storageKey (R2 path) to Edge Function

Edge Function b2-download-url:
  queries galeria_fotos WHERE original_path IN (storageKeys)
  R2 paths don't match any original_path
  Result: "No valid photos found" --> 404
```

The `GalleryPhoto` type doesn't have an `originalPath` field, so even though the database has the correct B2 path, it gets lost during transformation.

## Fix (3 files, surgical changes)

### 1. Add `originalPath` to `GalleryPhoto` type

**File: `src/types/gallery.ts`**

Add optional `originalPath` field to the `GalleryPhoto` interface:
```typescript
originalPath?: string | null; // B2 path for download (only when allowDownload=true)
```

### 2. Map `original_path` during photo transformation

**File: `src/pages/ClientGallery.tsx` (lines 326-355)**

In the `useMemo` that transforms `supabasePhotos` to `GalleryPhoto[]`, add:
```typescript
originalPath: photo.original_path || null,
```

### 3. Fix DownloadModal to use `originalPath` instead of `storageKey`

**File: `src/components/DownloadModal.tsx` (lines 43-48)**

Change from:
```typescript
const downloadablePhotos: DownloadablePhoto[] = photos
  .filter(p => p.storageKey)
  .map(p => ({
    storageKey: p.storageKey!,           // WRONG: sends R2 path
    filename: p.originalFilename || p.filename,
  }));
```

To:
```typescript
const downloadablePhotos: DownloadablePhoto[] = photos
  .filter(p => p.originalPath)           // Only photos with B2 original
  .map(p => ({
    storageKey: p.originalPath!,          // CORRECT: sends B2 path
    filename: p.originalFilename || p.filename,
  }));
```

## Why this is the definitive fix

The data is already correct in the database (verified):
- Gallery `8e72918e` has 2 photos, both with `original_path` set
- The B2 files exist (signed URLs return 200)
- The Edge Function works correctly when given the right paths

The ONLY problem is that `original_path` gets dropped during the frontend transformation and the wrong field (`storage_key`) is sent instead.

## No other files need changes

- `b2-download-url` Edge Function: works correctly (verified with curl)
- `downloadUtils.ts`: works correctly (passes data through)
- `FinalizedPreviewScreen.tsx`: already handles `originalPath` correctly (line 97-101)
- `PhotoUploader.tsx`: upload logic is correct
