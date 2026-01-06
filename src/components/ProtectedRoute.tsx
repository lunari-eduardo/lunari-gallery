import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuthContext } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading, accessLoading, hasGalleryAccess, accessLevel } = useAuthContext();

  console.log('🛡️ ProtectedRoute check:', {
    user: user?.email,
    loading,
    accessLoading,
    hasGalleryAccess,
    accessLevel
  });

  if (loading || accessLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    console.log('🔒 No user, redirecting to /auth');
    return <Navigate to="/auth" replace />;
  }

  if (!hasGalleryAccess) {
    console.log('🚫 No gallery access, redirecting to /access-denied');
    return <Navigate to="/access-denied" replace />;
  }

  console.log('✅ Access granted, rendering children');
  return <>{children}</>;
}
