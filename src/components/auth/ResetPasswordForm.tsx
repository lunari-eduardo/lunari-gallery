import { useState } from 'react';
import { Mail, CheckCircle, ArrowLeft } from 'lucide-react';
import { useAuthContext } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { AuthInput } from './AuthInput';
import { AuthButton } from './AuthButton';

interface ResetPasswordFormProps {
  onBack: () => void;
}

export function ResetPasswordForm({ onBack }: ResetPasswordFormProps) {
  const { resetPassword } = useAuthContext();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Digite um email válido');
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await resetPassword(email.trim());
      if (error) {
        toast.error('Erro ao enviar email. Tente novamente.');
      } else {
        setEmailSent(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (emailSent) {
    return (
      <div className="text-center py-6 space-y-4">
        <CheckCircle className="h-16 w-16 text-[#C97A4A] mx-auto" />
        <h3 className="text-xl font-medium text-white">Email enviado!</h3>
        <p className="text-white/60 text-sm">
          Enviamos um link de recuperação para
          <br />
          <span className="text-white font-medium">{email}</span>
        </p>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-[#C97A4A] hover:text-[#E08B5A] text-sm"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar ao login
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 text-white/60 hover:text-white text-sm transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </button>

      <div className="text-center pb-2">
        <h3 className="text-lg font-medium text-white">Recuperar senha</h3>
        <p className="text-white/60 text-sm mt-1">
          Digite seu email para receber um link de recuperação
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <AuthInput
          icon={Mail}
          type="email"
          placeholder="E-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isLoading}
          autoComplete="email"
          autoFocus
        />
        <AuthButton type="submit" loading={isLoading} className="mt-2">
          Enviar link de recuperação
        </AuthButton>
      </form>
    </div>
  );
}
