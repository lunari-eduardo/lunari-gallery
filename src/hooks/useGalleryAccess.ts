import { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

// Níveis definem FEATURES disponíveis, não ACESSO
export type AccessLevel = 'admin' | 'pro_gallery' | 'pro' | 'free';

interface GalleryAccessResult {
  hasAccess: boolean;           // Sempre true se logado
  accessLevel: AccessLevel;     // Define features disponíveis
  planName: string | null;
  isLoading: boolean;
  hasGestaoIntegration: boolean; // Helper para integração com Gestão
}

export function useGalleryAccess(user: User | null): GalleryAccessResult {
  const [accessLevel, setAccessLevel] = useState<AccessLevel>('free');
  const [planName, setPlanName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setAccessLevel('free');
      setPlanName(null);
      setIsLoading(false);
      return;
    }

    const checkAccessLevel = async () => {
      setIsLoading(true);
      
      try {
        console.log('🔍 Checking access level for user:', user.id, user.email);

        // 1. Verificar se é admin
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'admin')
          .maybeSingle();

        if (roleData) {
          console.log('✅ User is ADMIN');
          setAccessLevel('admin');
          setPlanName('Administrador');
          setIsLoading(false);
          return;
        }

        // 2. Verificar subscription para nível de features
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
          
          if (planCode.includes('gallery') && planCode.includes('pro')) {
            // Plano Pro + Gallery = integração total
            setAccessLevel('pro_gallery');
            setPlanName(plan.name);
          } else if (planCode.includes('pro')) {
            // Apenas Pro (Gestão)
            setAccessLevel('pro');
            setPlanName(plan.name);
          } else if (planCode.includes('gallery')) {
            // Apenas Gallery básico
            setAccessLevel('free');
            setPlanName(plan.name);
          } else {
            setAccessLevel('free');
            setPlanName(plan.name);
          }
          setIsLoading(false);
          return;
        }

        // 3. Sem plano = acesso básico (free)
        console.log('ℹ️ User has no active plan - granting free access');
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
  }, [user]);

  return {
    hasAccess: user !== null, // SEMPRE true se logado
    accessLevel,
    planName,
    isLoading,
    hasGestaoIntegration: accessLevel === 'admin' || accessLevel === 'pro_gallery',
  };
}
