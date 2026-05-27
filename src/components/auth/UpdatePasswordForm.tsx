import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, CheckCircle } from 'lucide-react';
import { useAuthContext } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { AuthInput } from './AuthInput';
import { AuthButton } from './AuthButton';

export function UpdatePasswordForm() {
  const navigate = useNavigate();
  const { updatePassword } = useAuthContext();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error('Senha deve ter no mínimo 6 caracteres');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }

    setIsLoading(true);
    const { error } = await updatePassword(password);

    if (error) {
      toast.error('Erro ao atualizar senha. Tente novamente.');
    } else {
      setSuccess(true);
      const url = new URL(window.location.href);
      url.searchParams.delete('reset');
      window.history.replaceState({}, '', url.pathname);
      setTimeout(() => {
        navigate('/', { replace: true });
      }, 2000);
    }
    setIsLoading(false);
  };

  if (success) {
    return (
      <div className="text-center py-6 space-y-4">
        <CheckCircle className="h-16 w-16 text-[#C97A4A] mx-auto" />
        <h3 className="text-xl font-medium text-white">Senha atualizada!</h3>
        <p className="text-white/60 text-sm">Você será redirecionado em instantes...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center pb-2">
        <h3 className="text-lg font-medium text-white">Nova senha</h3>
        <p className="text-white/60 text-sm mt-1">Digite sua nova senha abaixo.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <AuthInput
          icon={Lock}
          type="password"
          placeholder="Nova senha (mínimo 6 caracteres)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isLoading}
          autoComplete="new-password"
        />
        <AuthInput
          icon={Lock}
          type="password"
          placeholder="Confirmar nova senha"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          disabled={isLoading}
          autoComplete="new-password"
        />
        <AuthButton type="submit" loading={isLoading} className="mt-2">
          Salvar nova senha
        </AuthButton>
      </form>
    </div>
  );
}
