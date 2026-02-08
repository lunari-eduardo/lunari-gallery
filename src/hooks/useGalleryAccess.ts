import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

/**
 * Access levels define FEATURES available, not ACCESS.
 * Gallery access is credit-based, not plan-based.
 * 
 * - admin: Full access, unlimited credits, full Gestão integration
 * - pro_gallery: Credit-based Gallery + Gestão integration
 * - pro: Credit-based Gallery, no Gestão integration (just Gestão access)
 * - starter: Credit-based Gallery, no Gestão integration (limited Gestão)
 * - free: Credit-based Gallery, no Gestão integration, no Gestão access
 */
export type AccessLevel = 'admin' | 'pro_gallery' | 'pro' | 'starter' | 'free';

interface GalleryAccessResult {
  hasAccess: boolean;           // Always true if logged in
  accessLevel: AccessLevel;     // Defines features available
  planName: string | null;
  isLoading: boolean;
  hasGestaoIntegration: boolean; // Only true for admin or pro_gallery
  isAdmin: boolean;             // Helper for admin bypass
}

export function useGalleryAccess(user: User | null, session: Session | null): GalleryAccessResult {
  const [accessLevel, setAccessLevel] = useState<AccessLevel>('free');
  const [planName, setPlanName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // CRITICAL: Only proceed if we have BOTH user AND valid session with token
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

        // 2. Check subscription for plan type (determines Gestão integration only)
        const { data: subscription } = await supabase
          .from('subscriptions')
          .select(`
            status,
            plans (
              code,
              name
            )
          `)
          .eq('user_id', user.id)
          .eq('status', 'active')
          .maybeSingle();

        if (subscription?.plans) {
          const plan = subscription.plans as { code: string; name: string };
          const planCode = plan.code.toLowerCase();
          
          console.log('📋 User has active plan:', planCode);
          
          if (planCode.includes('galery') || planCode.includes('gallery')) {
            // Pro + Gallery = Gestão integration enabled
            setAccessLevel('pro_gallery');
            setPlanName(plan.name);
          } else if (planCode.includes('pro')) {
            // Pro only = Gestão access, no Gallery integration
            setAccessLevel('pro');
            setPlanName(plan.name);
          } else if (planCode.includes('starter')) {
            // Starter = limited Gestão, no Gallery integration
            setAccessLevel('starter');
            setPlanName(plan.name);
          } else {
            setAccessLevel('free');
            setPlanName(plan.name);
          }
          setIsLoading(false);
          return;
        }

        // 3. No plan = free access (still uses credits for Gallery)
        console.log('ℹ️ User has no active plan - free tier');
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
  const hasGestaoIntegration = isAdmin || accessLevel === 'pro_gallery';

  return {
    hasAccess: user !== null, // Always true if logged in
    accessLevel,
    planName,
    isLoading,
    hasGestaoIntegration,
    isAdmin,
  };
}
