import { useAuthContext } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, Mail } from 'lucide-react';
import { ChangeEmailForm } from '@/components/account/ChangeEmailForm';

export default function Account() {
  const { user } = useAuthContext();

  // Verificar se é usuário de email/senha (não OAuth)
  const isEmailUser = user?.app_metadata?.provider === 'email' || 
                      user?.app_metadata?.providers?.includes('email');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Minha Conta</h1>
        <p className="text-muted-foreground">
          Gerencie suas informações
        </p>
      </div>

      <div className="max-w-md space-y-6">
        {/* Perfil */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Perfil
            </CardTitle>
            <CardDescription>Suas informações pessoais</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={user?.user_metadata?.avatar_url} />
                <AvatarFallback className="text-lg">
                  {user?.email?.[0]?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">
                  {user?.user_metadata?.full_name || user?.user_metadata?.name || 'Usuário'}
                </p>
                <p className="text-sm text-muted-foreground truncate flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  {user?.email}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Alterar Email - apenas para usuários email/senha */}
        {isEmailUser && user?.email && (
          <ChangeEmailForm currentEmail={user.email} />
        )}
      </div>
    </div>
  );
}
