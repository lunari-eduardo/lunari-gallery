

# Fix: Prorata Calculation + Annual Option in Upgrades

## Problems

1. **Frontend prorata formula is wrong**: Currently calculates `(newPrice - currentPrice) * daysRemaining / cycleDays`. Backend correctly calculates `newPrice - (currentPrice * daysRemaining / cycleDays)`. These give different results.
   - Example: current=R$12,90, new=R$24,90, 28 days left
   - Frontend (wrong): (2490-1290) × 28/30 = R$11,20
   - Backend (correct): 2490 - (1290 × 28/30) = 2490 - 1204 = R$12,86
   - The frontend shows misleading "Pagar agora" values

2. **No annual option in upgrade mode**: Billing toggle is hidden when upgrading, locking user to current cycle. Need to allow monthly→annual upgrades with cycle restart logic.

## Fix Details

### `src/pages/CreditsCheckout.tsx`

**Prorata display fix** — change the calculation to match backend:
```
credit = currentPrice * (daysRemaining / currentCycleDays)
netCharge = newPrice - credit
```

**Annual option in upgrade mode** — show billing toggle even in upgrade mode:
- Monthly→Monthly: `net = newMonthlyPrice - (currentMonthly × daysRemaining/30)`, keeps same cycle
- Monthly→Annual: `net = annualPrice - (currentMonthly × daysRemaining/30)`, restarts cycle
- Annual→Annual: `net = newAnnualPrice - (currentAnnual × daysRemaining/365)`, keeps same cycle

Pass `billingCycle` (the NEW cycle) to the checkout pay page, along with credit info.

### `supabase/functions/asaas-upgrade-subscription/index.ts`

The edge function already calculates correctly (`credit = currentPrice × daysRemaining/cycleDays`, then `net = newPrice - credit`). Only change needed: when new billing cycle differs from old (monthly→annual), set `nextDueDate` to a new date (now + 1 year) instead of reusing the old subscription's `nextDueDate`.

## Files

| File | Change |
|---|---|
| `src/pages/CreditsCheckout.tsx` | Fix prorata formula; show billing toggle in upgrade mode; pass correct billingCycle |
| `supabase/functions/asaas-upgrade-subscription/index.ts` | Handle cycle change: set new nextDueDate when billingCycle differs |

