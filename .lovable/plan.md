
# Fix: Welcome Modal Blocking Clicks After Close

## Problem

After clicking "Ver minhas fotos", the modal's exit animation plays (2 seconds), then `onClose()` is called which sets `open=false`. However, the conditional return on line 20 checks `if (!open && stage === 'visible') return null` -- but at that point `stage` is still `'closing'`, so the overlay div remains in the DOM with `z-50 fixed inset-0`, blocking all interactions underneath.

## Solution

**File: `src/components/deliver/DeliverWelcomeModal.tsx`**

Change the early return condition from:

```
if (!open && stage === 'visible') return null;
```

to:

```
if (!open) return null;
```

When `open` becomes `false` (after the 2s animation completes and `onClose` is called), the component should always unmount regardless of the internal `stage` state. The animation has already finished visually by the time `open` flips to `false`, so there's no reason to keep the overlay in the DOM.

## Technical Details

- Single line change in `DeliverWelcomeModal.tsx`, line 20
- No other files affected
- The animation flow remains: click button -> stage='closing' (2s fade) -> onClose() -> open=false -> component returns null
