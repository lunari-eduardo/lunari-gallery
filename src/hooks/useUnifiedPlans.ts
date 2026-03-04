import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  ALL_PLAN_PRICES as FALLBACK_PRICES,
  PLAN_FAMILIES as FALLBACK_FAMILIES,
  PLAN_INCLUDES as FALLBACK_INCLUDES,
  TRANSFER_STORAGE_LIMITS as FALLBACK_STORAGE,
  PLAN_SUBSCRIPTION_CREDITS as FALLBACK_CREDITS,
} from '@/lib/transferPlans';

export interface UnifiedPlan {
  id: string;
  code: string;
  name: string;
  monthly_price_cents: number;
  yearly_price_cents: number;
  is_active: boolean;
  product_family: string;
  includes_studio: boolean;
  includes_select: boolean;
  includes_transfer: boolean;
  select_credits_monthly: number;
  transfer_storage_bytes: number;
  sort_order: number;
  description: string | null;
}

export function useUnifiedPlans() {
  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['unified-plans'],
    queryFn: async (): Promise<UnifiedPlan[]> => {
      const { data, error } = await supabase
        .from('unified_plans')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (error) {
        console.error('Error fetching unified_plans:', error);
        return [];
      }

      return (data || []).map((p: any) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        monthly_price_cents: p.monthly_price_cents ?? 0,
        yearly_price_cents: p.yearly_price_cents ?? 0,
        is_active: p.is_active ?? true,
        product_family: p.product_family ?? 'transfer',
        includes_studio: p.includes_studio ?? false,
        includes_select: p.includes_select ?? false,
        includes_transfer: p.includes_transfer ?? false,
        select_credits_monthly: p.select_credits_monthly ?? 0,
        transfer_storage_bytes: p.transfer_storage_bytes ?? 0,
        sort_order: p.sort_order ?? 0,
        description: p.description ?? null,
      }));
    },
    staleTime: 5 * 60 * 1000, // 5 min
    retry: 2,
  });

  const hasDynamicData = plans.length > 0;

  /** Get plan by code */
  function getPlanByCode(code: string): UnifiedPlan | undefined {
    return plans.find((p) => p.code === code);
  }

  /** Get price for a plan code and cycle. Falls back to hardcoded. */
  function getPlanPrice(code: string, cycle: 'monthly' | 'yearly'): number {
    const plan = getPlanByCode(code);
    if (plan) {
      return cycle === 'monthly' ? plan.monthly_price_cents : plan.yearly_price_cents;
    }
    const fb = FALLBACK_PRICES[code];
    return fb ? (cycle === 'monthly' ? fb.monthly : fb.yearly) : 0;
  }

  /** Get plan display name. Falls back to hardcoded. */
  function getPlanName(code: string | null | undefined): string | null {
    if (!code) return null;
    const plan = getPlanByCode(code);
    if (plan) return plan.name;
    // Fallback
    return code.replace(/_/g, ' ');
  }

  /** Backward-compat: Record<code, {monthly, yearly}> */
  function getAllPlanPrices(): Record<string, { monthly: number; yearly: number }> {
    if (!hasDynamicData) return { ...FALLBACK_PRICES };
    const result: Record<string, { monthly: number; yearly: number }> = {};
    for (const p of plans) {
      result[p.code] = { monthly: p.monthly_price_cents, yearly: p.yearly_price_cents };
    }
    // Merge fallback for any missing codes
    for (const [code, prices] of Object.entries(FALLBACK_PRICES)) {
      if (!result[code]) result[code] = prices;
    }
    return result;
  }

  /** Backward-compat: PLAN_FAMILIES */
  function getPlanFamilies(): Record<string, string> {
    if (!hasDynamicData) return { ...FALLBACK_FAMILIES };
    const result: Record<string, string> = {};
    for (const p of plans) {
      result[p.code] = p.product_family;
    }
    for (const [code, fam] of Object.entries(FALLBACK_FAMILIES)) {
      if (!result[code]) result[code] = fam;
    }
    return result;
  }

  /** Backward-compat: PLAN_INCLUDES */
  function getPlanIncludes(): Record<string, { studio: boolean; select: boolean; transfer: boolean }> {
    if (!hasDynamicData) return { ...FALLBACK_INCLUDES };
    const result: Record<string, { studio: boolean; select: boolean; transfer: boolean }> = {};
    for (const p of plans) {
      result[p.code] = {
        studio: p.includes_studio,
        select: p.includes_select,
        transfer: p.includes_transfer,
      };
    }
    for (const [code, inc] of Object.entries(FALLBACK_INCLUDES)) {
      if (!result[code]) result[code] = inc;
    }
    return result;
  }

  /** Storage limits from dynamic data */
  function getStorageLimits(): Record<string, number> {
    if (!hasDynamicData) return { ...FALLBACK_STORAGE };
    const result: Record<string, number> = {};
    for (const p of plans) {
      if (p.transfer_storage_bytes > 0) {
        result[p.code] = p.transfer_storage_bytes;
      }
    }
    for (const [code, bytes] of Object.entries(FALLBACK_STORAGE)) {
      if (!result[code]) result[code] = bytes;
    }
    return result;
  }

  /** Subscription credits from dynamic data */
  function getSubscriptionCredits(): Record<string, number> {
    if (!hasDynamicData) return { ...FALLBACK_CREDITS };
    const result: Record<string, number> = {};
    for (const p of plans) {
      if (p.select_credits_monthly > 0) {
        result[p.code] = p.select_credits_monthly;
      }
    }
    for (const [code, credits] of Object.entries(FALLBACK_CREDITS)) {
      if (!result[code]) result[code] = credits;
    }
    return result;
  }

  /** Transfer plans only, sorted */
  function getTransferPlans() {
    if (!hasDynamicData) return null;
    return plans
      .filter((p) => p.product_family === 'transfer')
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  }

  /** Combo plans only, sorted */
  function getComboPlans() {
    if (!hasDynamicData) return null;
    return plans
      .filter((p) => p.product_family === 'combo')
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  }

  return {
    plans,
    isLoading,
    hasDynamicData,
    getPlanByCode,
    getPlanPrice,
    getPlanName,
    getAllPlanPrices,
    getPlanFamilies,
    getPlanIncludes,
    getStorageLimits,
    getSubscriptionCredits,
    getTransferPlans,
    getComboPlans,
  };
}
