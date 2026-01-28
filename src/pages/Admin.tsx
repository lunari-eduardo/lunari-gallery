import { useAuthContext } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { UserCreditsManager } from '@/components/admin/UserCreditsManager';
import { Shield } from 'lucide-react';

export default function Admin() {
  const { isAdmin, accessLoading } = useAuthContext();

  if (accessLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Shield className="h-6 w-6" />
          Painel Administrativo
        </h1>
        <p className="text-muted-foreground">
          Gerencie usuários e créditos do sistema
        </p>
      </div>

      {/* Admin Components */}
      <div className="grid gap-6 lg:grid-cols-2">
        <UserCreditsManager />
      </div>
    </div>
  );
}
