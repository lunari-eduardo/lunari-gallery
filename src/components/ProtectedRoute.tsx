import { ReactNode, useRef, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuthContext } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuthContext();
  const location = useLocation();

  // Guarda o estado indicando que estamos num callback OAuth
  // (evita Race Condition entre React Router limando a URL e Supabase pegando o PKCE code)
  const isOauthPending = useRef(
    location.search.includes('code=') || location.hash.includes('access_token=')
  );

  useEffect(() => {
    // Quando o usuário for carregado ou o load terminar falhando
    if (user || (!loading && !user)) {
      const timer = setTimeout(() => {
        isOauthPending.current = false;
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [user, loading]);

  // Seguramos no Spinner se a trava de OAuth estiver ativa (isOauthPending.current === true)
  if (loading || isOauthPending.current) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Preserva pathname + search para restaurar após login. 
  // Também garante que flags de erro OAuth (error_description) não sejam apagadas pelo Redirect.
  if (!user) {
    const redirectTarget = `${location.pathname}${location.search}${location.hash}`;
    const params = new URLSearchParams(location.search);
    
    if (redirectTarget && redirectTarget !== '/') {
      params.set('redirect', redirectTarget);
    }
    
    const searchString = params.toString() ? `?${params.toString()}` : '';

    return (
      <Navigate 
        to={{ pathname: '/auth', search: searchString, hash: location.hash }} 
        replace 
      />
    );
  }

  return <>{children}</>;
}
