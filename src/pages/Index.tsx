import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

/**
 * Redirecionamento Inteligente da Raiz (gallery.lunarihub.com)
 * Se houver sessão, vai para o dashboard.
 * Se não houver, vai para o login (/auth).
 */
const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        navigate('/dashboard', { replace: true });
      } else {
        navigate('/auth', { replace: true });
      }
    };

    checkSession();
  }, [navigate]);

  // Enquanto verifica a sessão, mostra um estado neutro ou vazio
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
};

export default Index;
