import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Mail, Lock, User, CheckCircle, Gift } from 'lucide-react';
import { useAuthContext } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { AuthInput } from './AuthInput';
import { AuthButton } from './AuthButton';
import { Badge } from '@/components/ui/badge';
import { generateDeviceFingerprint } from '@/lib/deviceFingerprint';

export function SignupForm() {
  const { signUpWithEmail } = useAuthContext();
  const [searchParams] = useSearchParams();
  const referralCode = searchParams.get('ref') || '';
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const validateForm = (): string | null => {
    if (nome.trim().length < 2) return 'Nome deve ter pelo menos 2 caracteres';
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Email inválido';
    if (password.length < 6) return 'Senha deve ter pelo menos 6 caracteres';
    if (password !== confirmPassword) return 'As senhas não coincidem';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateForm();
    if (err) {
      toast.error(err);
      return;
    }
    setIsLoading(true);

    let fingerprint: string | undefined;
    try {
      fingerprint = await generateDeviceFingerprint();
    } catch (err) {
      console.warn('⚠️ Could not generate fingerprint:', err);
    }

    const { error, needsEmailConfirmation } = await signUpWithEmail(
      email.trim(),
      password,
      nome.trim(),
      referralCode || undefined,
      fingerprint,
    );

    if (error) {
      if (error.message?.includes('already registered')) {
        toast.error('Este email já está cadastrado');
      } else if (error.message?.includes('signup_not_allowed')) {
        toast.error('Cadastro não permitido. Entre em contato para solicitar acesso.');
      } else {
        toast.error('Erro ao criar conta. Tente novamente.');
      }
    } else if (needsEmailConfirmation) {
      setEmailSent(true);
    }
    setIsLoading(false);
  };

  if (emailSent) {
    return (
      <div className="text-center py-6 space-y-4">
        <CheckCircle className="h-16 w-16 text-[#C97A4A] mx-auto" />
        <h3 className="text-xl font-medium text-white">Verifique seu email</h3>
        <p className="text-white/60 text-sm">
          Enviamos um link de confirmação para
          <br />
          <span className="text-white font-medium">{email}</span>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {referralCode && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-[#C97A4A]/10 border border-[#C97A4A]/20">
          <Gift className="h-4 w-4 text-[#C97A4A] shrink-0" />
          <span className="text-sm text-[#C97A4A] font-medium">
            Indicação: <Badge variant="secondary" className="ml-1">{referralCode}</Badge>
          </span>
        </div>
      )}
      <AuthInput
        icon={User}
        type="text"
        placeholder="Nome completo"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        disabled={isLoading}
        autoComplete="name"
      />
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
        placeholder="Senha (mínimo 6 caracteres)"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        disabled={isLoading}
        autoComplete="new-password"
      />
      <AuthInput
        icon={Lock}
        type="password"
        placeholder="Confirmar senha"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        disabled={isLoading}
        autoComplete="new-password"
      />

      <AuthButton type="submit" loading={isLoading} className="mt-2">
        Criar conta
      </AuthButton>
    </form>
  );
}
