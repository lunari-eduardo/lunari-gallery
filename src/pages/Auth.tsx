import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Logo } from '@/components/Logo';
import { useAuthContext } from '@/contexts/AuthContext';
import { LoginForm } from '@/components/auth/LoginForm';
import { SignupForm } from '@/components/auth/SignupForm';
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm';
import { UpdatePasswordForm } from '@/components/auth/UpdatePasswordForm';
import { toast } from 'sonner';

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading, accessLoading, hasGalleryAccess, signInWithGoogle } = useAuthContext();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isProcessingCallback, setIsProcessingCallback] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showUpdatePassword, setShowUpdatePassword] = useState(false);

  // Check if we're processing an OAuth callback or email change (has hash with token)
  useEffect(() => {
    const hash = window.location.hash;
    const savedOrigin = localStorage.getItem('auth_origin');
    
    if (hash && hash.includes('access_token')) {
      const params = new URLSearchParams(hash.substring(1));
      const type = params.get('type');
      
      console.log('🔐 Processing auth callback, type:', type);
      console.log('📍 Saved origin:', savedOrigin);
      
      // Handle email change confirmation
      if (type === 'email_change') {
        console.log('📧 Email change confirmation detected');
        toast.success('Email alterado com sucesso!');
        // Clear hash and redirect to home
        window.history.replaceState(null, '', '/');
        navigate('/', { replace: true });
        return;
      }
      
      setIsProcessingCallback(true);
      
      // Limpar origem após processar
      localStorage.removeItem('auth_origin');
    }
  }, [navigate]);

  // Check for password reset callback - wait for user session
  useEffect(() => {
    const hash = window.location.hash;
    const resetParam = searchParams.get('reset');
    
    // If there's a recovery hash, wait for Supabase to process it
    if (hash && hash.includes('type=recovery')) {
      console.log('🔄 Recovery callback detected, waiting for session...');
      return;
    }
    
    // Only show password form if reset param is present AND user is authenticated
    if (resetParam === 'true' && user) {
      console.log('✅ User session ready, showing password update form');
      setShowUpdatePassword(true);
      // Clean the hash after session is established
      if (hash) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    }
  }, [searchParams, user]);

  useEffect(() => {
    console.log('🔍 Auth page state:', { 
      user: user?.email, 
      loading, 
      accessLoading, 
      hasGalleryAccess,
      isProcessingCallback 
    });
    
    // Don't redirect if we're showing the update password form
    if (showUpdatePassword && user) {
      return;
    }
    
    if (!loading && !accessLoading && user) {
      console.log('✅ User authenticated, checking access...');
      if (hasGalleryAccess) {
        console.log('✅ Has gallery access, redirecting to /');
        navigate('/', { replace: true });
      } else {
        console.log('❌ No gallery access, redirecting to /access-denied');
        navigate('/access-denied', { replace: true });
      }
    }
  }, [user, loading, accessLoading, hasGalleryAccess, navigate, isProcessingCallback, showUpdatePassword]);

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    const { error } = await signInWithGoogle();
    if (error) {
      toast.error('Erro ao fazer login. Tente novamente.');
      console.error('Sign in error:', error);
    }
    setIsSigningIn(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Show loading while waiting for recovery session
  if (searchParams.get('reset') === 'true' && !user && loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Show expired link message if reset param but no user after loading
  if (searchParams.get('reset') === 'true' && !user && !loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted p-4">
        <Card className="w-full max-w-md shadow-xl border-border/50 bg-card/95 backdrop-blur">
          <CardHeader className="text-center space-y-4 pb-2">
            <div className="flex justify-center">
              <Logo size="lg" variant="gallery" />
            </div>
          </CardHeader>
          <CardContent className="pt-4 text-center space-y-4">
            <p className="text-muted-foreground">
              Link expirado ou inválido. Solicite um novo link de recuperação.
            </p>
            <Button onClick={() => setShowResetPassword(true)} className="w-full">
              Solicitar novo link
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render update password form if user is authenticated
  if (showUpdatePassword && user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted p-4">
        <Card className="w-full max-w-md shadow-xl border-border/50 bg-card/95 backdrop-blur">
          <CardHeader className="text-center space-y-4 pb-2">
            <div className="flex justify-center">
              <Logo size="lg" variant="gallery" />
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <UpdatePasswordForm />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render reset password form if needed
  if (showResetPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted p-4">
        <Card className="w-full max-w-md shadow-xl border-border/50 bg-card/95 backdrop-blur">
          <CardHeader className="text-center space-y-4 pb-2">
            <div className="flex justify-center">
              <Logo size="lg" variant="gallery" />
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <ResetPasswordForm onBack={() => setShowResetPassword(false)} />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted p-4">
      <Card className="w-full max-w-md shadow-xl border-border/50 bg-card/95 backdrop-blur">
        <CardHeader className="text-center space-y-4 pb-2">
          <div className="flex justify-center">
            <Logo size="lg" variant="gallery" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-2xl font-display">
              Bem-vindo
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Acesse sua conta para gerenciar suas galerias
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-4">
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Criar Conta</TabsTrigger>
            </TabsList>
            <TabsContent value="login" className="mt-4">
              <LoginForm onForgotPassword={() => setShowResetPassword(true)} />
            </TabsContent>
            <TabsContent value="signup" className="mt-4">
              <SignupForm />
            </TabsContent>
          </Tabs>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <Separator className="w-full" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">ou</span>
            </div>
          </div>

          <Button
            onClick={handleGoogleSignIn}
            disabled={isSigningIn}
            className="w-full h-12 text-base font-medium"
            variant="outline"
          >
            {isSigningIn ? (
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
            ) : (
              <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
            )}
            Continuar com Google
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            Ao continuar, você concorda com os{' '}
            <a href="#" className="underline hover:text-primary">
              Termos de Uso
            </a>{' '}
            e{' '}
            <a href="#" className="underline hover:text-primary">
              Política de Privacidade
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
