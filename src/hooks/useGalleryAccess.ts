import { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export type AccessLevel = 'admin' | 'pro' | 'gallery' | 'none';

interface GalleryAccessResult {
  hasAccess: boolean;
  accessLevel: AccessLevel;
  planName: string | null;
  isLoading: boolean;
}

export function useGalleryAccess(user: User | null): GalleryAccessResult {
  const [accessLevel, setAccessLevel] = useState<AccessLevel>('none');
  const [planName, setPlanName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setAccessLevel('none');
      setPlanName(null);
      setIsLoading(false);
      return;
    }

    const checkAccess = async () => {
      setIsLoading(true);
      
      try {
        // Verify session is active
        const { data: { session } } = await supabase.auth.getSession();
        console.log('🔐 Gallery Access - Session check:', session?.user?.id);
        
        if (!session) {
          console.warn('⚠️ No active session found');
          setAccessLevel('none');
          setPlanName(null);
          setIsLoading(false);
          return;
        }

        console.log('🔍 Checking access for user:', user.id, user.email);

        // 1. Check if user is admin
        const { data: roleData, error: roleError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'admin')
          .maybeSingle();

        console.log('📋 Role check result:', { roleData, roleError });

        if (roleData) {
          console.log('✅ User is ADMIN - Full access granted');
          setAccessLevel('admin');
          setPlanName('Administrador');
          setIsLoading(false);
          return;
        }

        // 2. Check if email is in allowed_emails (PRO access)
        const { data: allowedEmail, error: emailError } = await supabase
          .from('allowed_emails')
          .select('email')
          .eq('email', user.email)
          .maybeSingle();

        console.log('📧 Allowed email check:', { allowedEmail, emailError });

        if (allowedEmail) {
          console.log('✅ User email in allowed_emails - PRO access granted');
          setAccessLevel('pro');
          setPlanName('Pro (Acesso Liberado)');
          setIsLoading(false);
          return;
        }

        // 3. Check subscription for gallery access
        const { data: subscription, error: subError } = await supabase
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

        console.log('💳 Subscription check:', { subscription, subError });

        if (subscription?.plans) {
          const plan = subscription.plans as { code: string; name: string };
          if (plan.code.toLowerCase().includes('galer')) {
            console.log('✅ User has gallery subscription - Gallery access granted');
            setAccessLevel('gallery');
            setPlanName(plan.name);
            setIsLoading(false);
            return;
          }
        }

        // No access
        console.log('❌ No gallery access found for user');
        setAccessLevel('none');
        setPlanName(null);
      } catch (error) {
        console.error('❌ Error checking gallery access:', error);
        setAccessLevel('none');
        setPlanName(null);
      } finally {
        setIsLoading(false);
      }
    };

    // Use setTimeout(0) to avoid potential deadlocks with auth state
    const timer = setTimeout(() => {
      checkAccess();
    }, 0);

    return () => clearTimeout(timer);
  }, [user]);

  return {
    hasAccess: accessLevel !== 'none',
    accessLevel,
    planName,
    isLoading,
  };
}
