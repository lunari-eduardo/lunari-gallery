import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuthContext } from '@/contexts/AuthContext';
import { LoginForm } from '@/components/auth/LoginForm';
import { SignupForm } from '@/components/auth/SignupForm';
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm';
import { UpdatePasswordForm } from '@/components/auth/UpdatePasswordForm';
import { AuthGoogleButton } from '@/components/auth/AuthGoogleButton';
import { toast } from 'sonner';
import lunariLogo from '@/assets/auth/lunari-gallery-logo.png';
import loginBackground from '@/assets/auth/login-background.jpg';

type AuthMode = 'login' | 'signup' | 'forgot';

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading, accessLoading, hasGalleryAccess, signInWithGoogle } = useAuthContext();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isProcessingCallback, setIsProcessingCallback] = useState(false);
  const [mode, setMode] = useState<AuthMode>('login');
  const [showUpdatePassword, setShowUpdatePassword] = useState(false);

  // Processa OAuth callback / email change
  useEffect(() => {
    const hash = window.location.hash;

    if (hash && hash.includes('access_token')) {
      const params = new URLSearchParams(hash.substring(1));
      const type = params.get('type');

      if (type === 'email_change') {
        window.history.replaceState(null, '', '/');
        navigate('/', { replace: true });
        return;
      }

      setIsProcessingCallback(true);
      localStorage.removeItem('auth_origin');
    }
  }, [navigate]);

  // Password reset callback
  useEffect(() => {
    const hash = window.location.hash;
    const resetParam = searchParams.get('reset');

    if (hash && hash.includes('type=recovery')) return;

    if (resetParam === 'true' && user) {
      setShowUpdatePassword(true);
      if (hash) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    }
  }, [searchParams, user]);

  useEffect(() => {
    if (showUpdatePassword && user) return;

    if (!loading && !accessLoading && user) {
      // Restaura destino original (ex: vindo de /gallery/new?session_id=...) após login
      const redirectParam = searchParams.get('redirect');
      if (redirectParam) {
        try {
          const target = decodeURIComponent(redirectParam);
          // segurança: só aceita paths internos (mesmo origin)
          if (target.startsWith('/') && !target.startsWith('//')) {
            navigate(target, { replace: true });
            return;
          }
        } catch (e) {
          console.warn('[Auth] redirect param inválido:', e);
        }
      }
      if (hasGalleryAccess) {
        navigate('/', { replace: true });
      } else {
        navigate('/access-denied', { replace: true });
      }
    }
  }, [user, loading, accessLoading, hasGalleryAccess, navigate, isProcessingCallback, showUpdatePassword, searchParams]);

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    const { error } = await signInWithGoogle();
    if (error) {
      toast.error('Erro ao fazer login. Tente novamente.');
      setIsSigningIn(false);
    }
  };

  if (loading) {
    return (
      <div className="dark min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <Loader2 className="h-8 w-8 animate-spin text-[#C97A4A]" />
      </div>
    );
  }

  // Link de recovery expirado
  const resetExpired = searchParams.get('reset') === 'true' && !user && !loading;

  const isSignup = mode === 'signup';
  const isForgot = mode === 'forgot';

  return (
    <div
      className="dark min-h-[100dvh] w-full relative bg-[#0a0a0a] flex flex-col items-center justify-center px-6 py-10"
      style={{
        backgroundImage: `url(${loginBackground})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Overlay para legibilidade */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black/60 pointer-events-none" />

      <main className="relative z-10 w-full max-w-[400px] flex flex-col items-center">
        {/* Logo + headline */}
        <div className="flex flex-col items-center text-center mb-8">
          <img
            src={lunariLogo}
            alt="Lunari Gallery"
            className="w-[200px] md:w-[220px] h-auto object-contain mb-6 select-none"
            draggable={false}
          />
          {!isForgot && !showUpdatePassword && !resetExpired && (
            <>
              <h1 className="text-white text-xl font-light tracking-wide">
                {isSignup ? 'Crie sua conta' : 'Galeria de seleção'}
              </h1>
              <p className="text-white/60 text-sm mt-1 font-light">
                {isSignup ? 'Comece a usar o Lunari Gallery' : 'para seus clientes'}
              </p>
            </>
          )}
        </div>

        {/* Form area */}
        <div className="w-full">
          {resetExpired ? (
            <div className="text-center space-y-4">
              <p className="text-white/70 text-sm">
                Link expirado ou inválido. Solicite um novo link de recuperação.
              </p>
              <button
                onClick={() => {
                  window.history.replaceState(null, '', '/auth');
                  setMode('forgot');
                }}
                className="text-[#C97A4A] hover:text-[#E08B5A] text-sm font-medium transition-colors"
              >
                Solicitar novo link
              </button>
            </div>
          ) : showUpdatePassword && user ? (
            <UpdatePasswordForm />
          ) : isForgot ? (
            <ResetPasswordForm onBack={() => setMode('login')} />
          ) : isSignup ? (
            <SignupForm />
          ) : (
            <LoginForm onForgotPassword={() => setMode('forgot')} />
          )}
        </div>

        {/* Divider + Google + toggle */}
        {!isForgot && !showUpdatePassword && !resetExpired && (
          <>
            <div className="w-full flex items-center gap-3 my-6">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-white/40 text-xs font-light">ou continue com</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            <AuthGoogleButton onClick={handleGoogleSignIn} loading={isSigningIn} />

            <p className="text-center text-sm text-white/60 mt-8 font-light">
              {isSignup ? 'Já tem uma conta?' : 'Ainda não tem uma conta?'}{' '}
              <button
                type="button"
                onClick={() => setMode(isSignup ? 'login' : 'signup')}
                className="text-[#C97A4A] hover:text-[#E08B5A] font-medium transition-colors"
              >
                {isSignup ? 'Entrar' : 'Criar conta'}
              </button>
            </p>

            <p className="text-xs text-center text-white/40 mt-6 font-light leading-relaxed">
              Ao continuar, você concorda com nossos{' '}
              <a href="/termos" className="text-[#C97A4A] hover:underline">Termos de Uso</a> e{' '}
              <a href="/privacidade" className="text-[#C97A4A] hover:underline">Política de Privacidade</a>
            </p>
          </>
        )}
      </main>
    </div>
  );
}
