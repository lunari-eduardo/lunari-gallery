const GB = 1024 * 1024 * 1024;

/**
 * Maps plan_type from subscriptions_asaas to storage limit in bytes.
 * To add a new plan, just add an entry here.
 */
export const TRANSFER_STORAGE_LIMITS: Record<string, number> = {
  transfer_5gb: 5 * GB,
  transfer_20gb: 20 * GB,
  transfer_50gb: 50 * GB,
  transfer_100gb: 100 * GB,
  combo_completo: 20 * GB,
  combo_pro_select2k: 0,
};

/** Plan prices in cents for prorata calculation — ALL plan families. */
export const ALL_PLAN_PRICES: Record<string, { monthly: number; yearly: number }> = {
  // Studio
  studio_starter: { monthly: 1490, yearly: 15198 },
  studio_pro: { monthly: 3590, yearly: 36618 },
  // Transfer
  transfer_5gb: { monthly: 1290, yearly: 12384 },
  transfer_20gb: { monthly: 2490, yearly: 23904 },
  transfer_50gb: { monthly: 3490, yearly: 33504 },
  transfer_100gb: { monthly: 5990, yearly: 57504 },
  // Combos
  combo_pro_select2k: { monthly: 4490, yearly: 45259 },
  combo_completo: { monthly: 6490, yearly: 66198 },
};

/** Backwards-compatible alias for Transfer-only prices. */
export const TRANSFER_PLAN_PRICES = ALL_PLAN_PRICES;

const PLAN_DISPLAY_NAMES: Record<string, string> = {
  // Studio
  studio_starter: 'Lunari Starter',
  studio_pro: 'Lunari Pro',
  // Transfer
  transfer_5gb: 'Transfer 5 GB',
  transfer_20gb: 'Transfer 20 GB',
  transfer_50gb: 'Transfer 50 GB',
  transfer_100gb: 'Transfer 100 GB',
  // Combos
  combo_pro_select2k: 'Studio Pro + Select 2k',
  combo_completo: 'Combo Completo',
};

/** Product family for each plan_type. */
export const PLAN_FAMILIES: Record<string, string> = {
  studio_starter: 'studio',
  studio_pro: 'studio',
  transfer_5gb: 'transfer',
  transfer_20gb: 'transfer',
  transfer_50gb: 'transfer',
  transfer_100gb: 'transfer',
  combo_pro_select2k: 'combo',
  combo_completo: 'combo',
};

/** Which product capabilities each plan includes. */
export const PLAN_INCLUDES: Record<string, { studio: boolean; select: boolean; transfer: boolean }> = {
  studio_starter: { studio: true, select: false, transfer: false },
  studio_pro: { studio: true, select: false, transfer: false },
  transfer_5gb: { studio: false, select: false, transfer: true },
  transfer_20gb: { studio: false, select: false, transfer: true },
  transfer_50gb: { studio: false, select: false, transfer: true },
  transfer_100gb: { studio: false, select: false, transfer: true },
  combo_pro_select2k: { studio: true, select: true, transfer: false },
  combo_completo: { studio: true, select: true, transfer: true },
};

/** Returns storage limit in bytes for a given plan_type, or 0 if unknown. */
export function getStorageLimitBytes(planType: string | null | undefined): number {
  if (!planType) return 0;
  return TRANSFER_STORAGE_LIMITS[planType] ?? 0;
}

/** Returns human-readable plan name. */
export function getPlanDisplayName(planType: string | null | undefined): string | null {
  if (!planType) return null;
  return PLAN_DISPLAY_NAMES[planType] ?? planType;
}

/** Checks if the plan includes Transfer storage. */
export function hasTransferStorage(planType: string | null | undefined): boolean {
  if (!planType) return false;
  const limit = TRANSFER_STORAGE_LIMITS[planType];
  return limit !== undefined && limit > 0;
}

/** Checks if the plan includes Studio access. */
export function hasStudioAccess(planType: string | null | undefined): boolean {
  if (!planType) return false;
  return PLAN_INCLUDES[planType]?.studio ?? false;
}

/** Checks if the plan includes Select credits. */
export function hasSelectCredits(planType: string | null | undefined): boolean {
  if (!planType) return false;
  return PLAN_INCLUDES[planType]?.select ?? false;
}

/** Formats bytes to human-readable string (e.g. "12.4 GB"). */
export function formatStorageSize(bytes: number): string {
  if (bytes === 0) return '0 GB';
  const gb = bytes / GB;
  if (gb >= 1) {
    return gb % 1 === 0 ? `${gb} GB` : `${gb.toFixed(1)} GB`;
  }
  const mb = bytes / (1024 * 1024);
  return `${Math.round(mb)} MB`;
}

/** Free storage for all users (0.5GB). */
export const FREE_TRANSFER_BYTES = 536870912; // 0.5GB

/** Monthly subscription credits granted per plan (only plans that include Select). */
export const PLAN_SUBSCRIPTION_CREDITS: Record<string, number> = {
  combo_pro_select2k: 2000,
  combo_completo: 2000,
};

/** Returns how many subscription credits a plan grants per cycle, or 0. */
export function getPlanSubscriptionCredits(planType: string | null | undefined): number {
  if (!planType) return 0;
  return PLAN_SUBSCRIPTION_CREDITS[planType] ?? 0;
}
