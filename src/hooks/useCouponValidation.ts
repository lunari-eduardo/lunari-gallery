import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CouponResult {
  valid: boolean;
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  description: string | null;
  error?: string;
  calculateDiscount: (originalCents: number) => number;
}

const EMPTY_RESULT: CouponResult = {
  valid: false,
  code: '',
  discountType: 'percentage',
  discountValue: 0,
  description: null,
  calculateDiscount: (c) => c,
};

export function useCouponValidation() {
  const [isValidating, setIsValidating] = useState(false);
  const [coupon, setCoupon] = useState<CouponResult>(EMPTY_RESULT);

  async function validateCoupon(
    code: string,
    planCode?: string,
    productFamily?: string
  ): Promise<CouponResult> {
    if (!code.trim()) {
      const r = { ...EMPTY_RESULT, error: 'Informe um cupom' };
      setCoupon(r);
      return r;
    }

    setIsValidating(true);
    try {
      const now = new Date().toISOString();

      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('code', code.trim().toUpperCase())
        .eq('is_active', true)
        .lte('valid_from', now)
        .single();

      if (error || !data) {
        const r: CouponResult = { ...EMPTY_RESULT, code, error: 'Cupom inválido ou expirado' };
        setCoupon(r);
        return r;
      }

      // Check expiration
      if (data.valid_until && new Date(data.valid_until) < new Date()) {
        const r: CouponResult = { ...EMPTY_RESULT, code, error: 'Cupom expirado' };
        setCoupon(r);
        return r;
      }

      // Check usage limit
      if (data.max_uses !== null && data.current_uses >= data.max_uses) {
        const r: CouponResult = { ...EMPTY_RESULT, code, error: 'Cupom esgotado' };
        setCoupon(r);
        return r;
      }

      // Check applies_to
      if (data.applies_to === 'plan' && planCode) {
        const planCodes = data.plan_codes as string[] | null;
        if (planCodes && planCodes.length > 0 && !planCodes.includes(planCode)) {
          const r: CouponResult = { ...EMPTY_RESULT, code, error: 'Cupom não aplicável a este plano' };
          setCoupon(r);
          return r;
        }
      }

      if (data.applies_to === 'product_family' && productFamily) {
        const planCodes = data.plan_codes as string[] | null;
        if (planCodes && planCodes.length > 0 && !planCodes.includes(productFamily)) {
          const r: CouponResult = { ...EMPTY_RESULT, code, error: 'Cupom não aplicável a esta categoria' };
          setCoupon(r);
          return r;
        }
      }

      const discountType = data.discount_type as 'percentage' | 'fixed';
      const discountValue = data.discount_value;

      const calculateDiscount = (originalCents: number): number => {
        if (discountType === 'percentage') {
          return Math.max(0, Math.round(originalCents * (1 - discountValue / 100)));
        }
        // fixed discount in cents
        return Math.max(0, originalCents - discountValue);
      };

      const result: CouponResult = {
        valid: true,
        code: data.code,
        discountType,
        discountValue,
        description: data.description,
        calculateDiscount,
      };

      setCoupon(result);
      return result;
    } catch {
      const r: CouponResult = { ...EMPTY_RESULT, code, error: 'Erro ao validar cupom' };
      setCoupon(r);
      return r;
    } finally {
      setIsValidating(false);
    }
  }

  function clearCoupon() {
    setCoupon(EMPTY_RESULT);
  }

  return {
    coupon,
    isValidating,
    validateCoupon,
    clearCoupon,
  };
}
