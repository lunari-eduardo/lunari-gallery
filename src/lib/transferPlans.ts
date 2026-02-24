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
  combo_studio_pro: 0,
};

const PLAN_DISPLAY_NAMES: Record<string, string> = {
  transfer_5gb: 'Transfer 5 GB',
  transfer_20gb: 'Transfer 20 GB',
  transfer_50gb: 'Transfer 50 GB',
  transfer_100gb: 'Transfer 100 GB',
  combo_completo: 'Combo Completo',
  combo_studio_pro: 'Studio Pro',
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
