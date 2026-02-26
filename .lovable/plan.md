

# Fix: "Cannot access 'm' before initialization" crash

## Root Cause

In `src/pages/CreditsCheckout.tsx` lines 129-134, `searchParams` is referenced inside the `useState` initializer (line 130) **before** it's declared (line 134):

```typescript
// Line 129-133: uses searchParams
const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>(() => {
    const urlCycle = searchParams.get('billing_cycle'); // ← used here
    ...
});
// Line 134: declared here
const [searchParams] = useSearchParams(); // ← too late
```

Since `CreditsCheckout` is eagerly imported in `App.tsx`, this crashes the entire application — including the Credits page.

## Fix

Move `const [searchParams] = useSearchParams()` **before** the `useState` that references it — swap lines 129-134 so `searchParams` is declared first.

### File: `src/pages/CreditsCheckout.tsx`

Reorder to:
```typescript
const [searchParams] = useSearchParams();
const activeTab = searchParams.get('tab') === 'transfer' ? 'transfer' : 'select';
const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>(() => {
    const urlCycle = searchParams.get('billing_cycle');
    if (urlCycle === 'YEARLY') return 'yearly';
    return 'monthly';
});
```

One file, one change.

