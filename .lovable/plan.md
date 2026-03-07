

# Fix: Upload Pipeline Not Processing Files in GalleryEdit

## Root Cause

The `UploadPipeline` has a `destroyed` flag that, once set to `true`, causes `tick()` to silently return. The `getPipeline()` function only checks if `pipelineRef.current` is `null` or has a mismatched `folderId` — it does NOT check if the pipeline is destroyed. So a destroyed pipeline with matching `folderId` gets reused, and all subsequent `add()` calls silently fail (items are queued but `tick()` exits immediately).

This happens when:
- The `useEffect([folderId])` cleanup destroys the pipeline but a race condition leaves a stale ref
- Or after `onPipelineComplete`, the old pipeline is reused on subsequent uploads

## Changes

### 1. `src/lib/uploadPipeline.ts` — Expose `isDestroyed` getter

Add a public getter so the consumer can check if a pipeline instance has been destroyed:

```typescript
get isDestroyed(): boolean {
  return this.destroyed;
}
```

### 2. `src/components/PhotoUploader.tsx` — Fix `getPipeline` to check destroyed state

Update the `getPipeline` callback to also check if the existing pipeline is destroyed:

```typescript
const getPipeline = useCallback(() => {
  // If pipeline exists but is destroyed or folderId changed, recreate
  if (pipelineRef.current) {
    const shouldRecreate = 
      pipelineRef.current.isDestroyed ||
      (pipelineRef.current.folderId !== folderId && !pipelineRef.current.isActive);
    if (shouldRecreate) {
      pipelineRef.current.destroy();
      pipelineRef.current = null;
    }
  }
  if (!pipelineRef.current) {
    pipelineRef.current = new UploadPipeline({...});
  }
  return pipelineRef.current;
}, [...deps]);
```

### 3. `src/components/PhotoUploader.tsx` — Reset file input after selection

Add `e.target.value = ''` after calling `addFiles` so the same files can be re-selected:

```typescript
onChange={(e) => {
  if (e.target.files) addFiles(e.target.files);
  e.target.value = '';
}}
```

### 4. `src/components/PhotoUploader.tsx` — Clean up pipeline after completion

In `onPipelineComplete`, after finalizing (clearing done items), destroy the pipeline and null the ref so the next upload creates a fresh instance:

```typescript
// After clearing done items
setTimeout(() => {
  setItems(prev => prev.filter(i => i.status !== 'done'));
  // Destroy completed pipeline to ensure fresh state next time
  if (pipelineRef.current && !pipelineRef.current.isActive) {
    pipelineRef.current.destroy();
    pipelineRef.current = null;
  }
}, 2000);
```

## Files Modified

| File | Change |
|---|---|
| `src/lib/uploadPipeline.ts` | Add `isDestroyed` getter |
| `src/components/PhotoUploader.tsx` | Fix `getPipeline` destroyed check, reset file input, cleanup after completion |

