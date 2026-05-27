import { useState } from 'react';
import { Mail, Lock } from 'lucide-react';
import { useAuthContext } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { AuthInput } from './AuthInput';
import { AuthButton } from './AuthButton';

interface LoginFormProps {
  onForgotPassword: () => void;
}

export function LoginForm({ onForgotPassword }: LoginFormProps) {
  const { signInWithEmail } = useAuthContext();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error('Preencha todos os campos');
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await signInWithEmail(email.trim(), password);
      if (error) {
        if (error.message?.includes('Invalid login credentials')) {
          toast.error('Email ou senha incorretos');
        } else if (error.message?.includes('Email not confirmed')) {
          toast.error('Por favor, confirme seu email antes de fazer login');
        } else {
          toast.error('Erro ao fazer login. Tente novamente.');
        }
      }
    } catch {
      toast.error('Erro inesperado. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <AuthInput
        icon={Mail}
        type="email"
        placeholder="E-mail"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={isLoading}
        autoComplete="email"
      />
      <AuthInput
        icon={Lock}
        type="password"
        placeholder="Senha"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        disabled={isLoading}
        autoComplete="current-password"
      />

      <div className="flex justify-end pt-1 pb-1">
        <button
          type="button"
          onClick={onForgotPassword}
          className="text-sm text-[#C97A4A] hover:text-[#E08B5A] transition-colors"
        >
          Esqueci minha senha
        </button>
      </div>

      <AuthButton type="submit" loading={isLoading} className="mt-2">
        Entrar
      </AuthButton>
    </form>
  );
}
