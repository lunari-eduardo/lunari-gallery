import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuthContext } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuthContext();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Preserva pathname + search (ex: /gallery/new?session_id=...&cliente_id=...)
  // para restaurar após login. Crítico para fluxo Studio → Gallery em PWA mobile.
  if (!user) {
    const redirectTarget = `${location.pathname}${location.search}${location.hash}`;
    const redirect = redirectTarget && redirectTarget !== '/'
      ? `?redirect=${encodeURIComponent(redirectTarget)}`
      : '';
    return <Navigate to={`/auth${redirect}`} replace />;
  }

  return <>{children}</>;
}
