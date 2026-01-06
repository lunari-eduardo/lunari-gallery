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
        // 1. Check if user is admin
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'admin')
          .maybeSingle();

        if (roleData) {
          setAccessLevel('admin');
          setPlanName('Administrador');
          setIsLoading(false);
          return;
        }

        // 2. Check if email is in allowed_emails (PRO access)
        const { data: allowedEmail } = await supabase
          .from('allowed_emails')
          .select('email')
          .eq('email', user.email)
          .maybeSingle();

        if (allowedEmail) {
          setAccessLevel('pro');
          setPlanName('Pro (Acesso Liberado)');
          setIsLoading(false);
          return;
        }

        // 3. Check subscription for gallery access
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
          // Check if plan includes gallery (code contains 'gallery' or 'galery')
          if (plan.code.toLowerCase().includes('galer')) {
            setAccessLevel('gallery');
            setPlanName(plan.name);
            setIsLoading(false);
            return;
          }
        }

        // No access
        setAccessLevel('none');
        setPlanName(null);
      } catch (error) {
        console.error('Error checking gallery access:', error);
        setAccessLevel('none');
        setPlanName(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkAccess();
  }, [user]);

  return {
    hasAccess: accessLevel !== 'none',
    accessLevel,
    planName,
    isLoading,
  };
}
