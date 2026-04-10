import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { getPlanDisplayName, PLAN_INCLUDES, getHighestActivePlan } from '@/lib/transferPlans';

/**
 * Access levels define FEATURES available, not ACCESS.
 * Gallery access is credit-based, not plan-based.
 * 
 * - admin: Full access, unlimited credits, full Gestão integration
 * - pro_gallery: Credit-based Gallery + Gestão integration (combos)
 * - pro: Credit-based Gallery + Gestão integration (studio_pro or active trial)
 * - starter: Credit-based Gallery, no Gestão integration
 * - free: Credit-based Gallery, no Gestão integration
 */
export type AccessLevel = 'admin' | 'pro_gallery' | 'pro' | 'starter' | 'free';

interface GalleryAccessResult {
  hasAccess: boolean;
  accessLevel: AccessLevel;
  planName: string | null;
  isLoading: boolean;
  hasGestaoIntegration: boolean;
  isAdmin: boolean;
}

export function useGalleryAccess(user: User | null, session: Session | null): GalleryAccessResult {
  const [accessLevel, setAccessLevel] = useState<AccessLevel>('free');
  const [planName, setPlanName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user || !session?.access_token) {
      setAccessLevel('free');
      setPlanName(null);
      setIsLoading(false);
      return;
    }

    const checkAccessLevel = async () => {
      setIsLoading(true);
      
      try {
        console.log('🔍 Checking access level for user:', user.id, user.email);

        // 1. Check if user is admin
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'admin')
          .maybeSingle();

        if (roleData) {
          console.log('✅ User is ADMIN - unlimited access');
          setAccessLevel('admin');
          setPlanName('Administrador');
          setIsLoading(false);
          return;
        }

        // 1.5. Check allowed_emails (admin-authorized users)
        const { data: allowedEmail } = await supabase
          .from('allowed_emails')
          .select('plan_code')
          .eq('email', user.email!)
          .maybeSingle();

        if (allowedEmail) {
          const planCode = allowedEmail.plan_code || 'combo_completo';
          const includes = PLAN_INCLUDES[planCode];
          
          console.log('✅ User authorized via allowed_emails with plan:', planCode);

          if (includes?.studio && includes?.select) {
            setAccessLevel('pro_gallery');
          } else if (includes?.studio) {
            setAccessLevel('pro');
          } else if (planCode === 'studio_starter') {
            setAccessLevel('starter');
          } else {
            setAccessLevel('free');
          }
          setPlanName(getPlanDisplayName(planCode));
          setIsLoading(false);
          return;
        }

        // 2. Check subscriptions_asaas for active plan
        const { data: subs } = await supabase
          .from('subscriptions_asaas')
          .select('plan_type, status, next_due_date')
          .eq('user_id', user.id);

        const activeSubs = (subs || []).filter(s => {
          if (['ACTIVE', 'PENDING', 'OVERDUE'].includes(s.status)) return true;
          if (s.status === 'CANCELLED' && s.next_due_date && new Date(s.next_due_date) > new Date()) return true;
          return false;
        });

        if (activeSubs.length > 0) {
          const bestPlanType = getHighestActivePlan(activeSubs) || activeSubs[0].plan_type;
          const includes = PLAN_INCLUDES[bestPlanType];
          
          console.log('📋 User has active plan:', bestPlanType, includes);

          if (includes?.studio && includes?.select) {
            // Combo plans with studio + select = full integration
            setAccessLevel('pro_gallery');
          } else if (includes?.studio || bestPlanType === 'studio_pro') {
            // Studio Pro = Gestão integration
            setAccessLevel('pro');
          } else if (bestPlanType === 'studio_starter') {
            setAccessLevel('starter');
          } else {
            // Transfer-only plans
            setAccessLevel('free');
          }
          setPlanName(getPlanDisplayName(bestPlanType));
          setIsLoading(false);
          return;
        }

        // 3. No active subscription — check studio trial
        const { data: profile } = await supabase
          .from('profiles')
          .select('studio_trial_ends_at')
          .eq('id', user.id)
          .maybeSingle();

        if (profile?.studio_trial_ends_at && new Date(profile.studio_trial_ends_at) > new Date()) {
          console.log('🆓 User has active studio trial until', profile.studio_trial_ends_at);
          setAccessLevel('pro');
          setPlanName('Período de teste');
          setIsLoading(false);
          return;
        }

        // 4. No plan, no trial = free
        console.log('ℹ️ User has no active plan or trial - free tier');
        setAccessLevel('free');
        setPlanName(null);
        
      } catch (error) {
        console.error('Error checking access level:', error);
        setAccessLevel('free');
        setPlanName(null);
      } finally {
        setIsLoading(false);
      }
    };

    const timer = setTimeout(checkAccessLevel, 0);
    return () => clearTimeout(timer);
  }, [user, session]);

  const isAdmin = accessLevel === 'admin';
  const hasGestaoIntegration = isAdmin || accessLevel === 'pro_gallery' || accessLevel === 'pro';

  return {
    hasAccess: user !== null,
    accessLevel,
    planName,
    isLoading,
    hasGestaoIntegration,
    isAdmin,
  };
}
