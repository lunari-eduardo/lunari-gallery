import { useState } from 'react';
import { Lock, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { TitleCaseMode } from '@/types/gallery';
import { applyTitleCase } from '@/lib/textTransform';

interface PasswordScreenProps {
  sessionName?: string;
  sessionFont?: string;
  titleCaseMode?: TitleCaseMode;
  studioName?: string;
  studioLogo?: string;
  onSubmit: (password: string) => Promise<void>;
  error?: string;
  isLoading?: boolean;
  themeStyles?: React.CSSProperties;
  backgroundMode?: 'light' | 'dark';
}

export function PasswordScreen({
  sessionName,
  sessionFont,
  titleCaseMode = 'normal',
  studioName,
  studioLogo,
  onSubmit,
  error,
  isLoading = false,
  themeStyles = {},
  backgroundMode = 'light',
}: PasswordScreenProps) {
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.trim()) {
      await onSubmit(password.trim());
    }
  };

  return (
    <div 
      className={cn(
        "min-h-screen flex flex-col relative overflow-hidden",
        backgroundMode === 'dark' ? 'dark bg-zinc-950 text-zinc-100' : 'bg-stone-50 text-stone-900'
      )}
      style={themeStyles}
    >
      {/* Dynamic Background with Blur */}
      <div className="absolute inset-0 z-0">
        <div 
          className="absolute inset-0 bg-cover bg-center scale-110 blur-xl opacity-20 transition-opacity duration-1000"
          style={{ backgroundImage: `url(${studioLogo || ''})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/50 to-background" />
      </div>

      <div className="relative z-10 flex-1 flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-center p-8 md:p-12">
          {studioLogo ? (
            <img 
              src={studioLogo} 
              alt={studioName || 'Studio'} 
              className="h-20 md:h-28 lg:h-32 w-auto object-contain animate-fade-in"
            />
          ) : (
            <span className="text-xl tracking-[0.2em] uppercase font-light opacity-50">
              {studioName}
            </span>
          )}
        </header>

        {/* Content */}
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full text-center space-y-10 animate-slide-up">
            {/* Title Section */}
            <div className="space-y-4">
              <div className="inline-flex items-center justify-center p-3 rounded-full bg-primary/10 mb-2">
                <Lock className="h-5 w-5 text-primary" />
              </div>
              <h1 className="text-3xl md:text-4xl font-light tracking-tight">
                Sua galeria está pronta
              </h1>
              {sessionName && (
                <p 
                  className="text-xl md:text-2xl font-normal opacity-70 italic"
                  style={{ fontFamily: sessionFont || 'inherit' }}
                >
                  {applyTitleCase(sessionName, titleCaseMode)}
                </p>
              )}
            </div>

            {/* Password Form Card */}
            <div className="glass p-8 md:p-10 space-y-6 shadow-2xl border-white/10">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2 text-left">
                  <label className="text-xs uppercase tracking-widest opacity-50 ml-1 font-medium">
                    Senha de Acesso
                  </label>
                  <div className="relative">
                    <Input
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={cn(
                        "bg-background/50 border-white/10 text-center text-lg h-14 tracking-[0.3em] rounded-md transition-all focus:ring-primary/20",
                        error && "border-destructive focus-visible:ring-destructive"
                      )}
                      disabled={isLoading}
                      autoFocus
                    />
                  </div>
                  
                  {error && (
                    <div className="flex items-center justify-center gap-2 text-destructive text-sm mt-2 animate-shake">
                      <AlertCircle className="h-4 w-4" />
                      <span>{error}</span>
                    </div>
                  )}
                </div>

                <Button 
                  type="submit" 
                  variant="default" 
                  size="xl"
                  className="w-full shadow-xl hover:shadow-primary/20 transition-all duration-500"
                  disabled={isLoading || !password.trim()}
                  style={{ 
                    backgroundColor: 'var(--gallery-primary)',
                    color: 'var(--gallery-primary-foreground)',
                    borderRadius: 'var(--gallery-radius)'
                  }}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Verificando...
                    </>
                  ) : (
                    'Acessar Galeria'
                  )}
                </Button>
              </form>

              <p className="text-sm opacity-40">
                Conteúdo exclusivo e protegido para sua privacidade.
              </p>
            </div>
          </div>
        </main>

        {/* Footer Info */}
        <footer className="p-8 text-center opacity-30 text-[10px] uppercase tracking-[0.2em]">
          Powered by Lunari
        </footer>
      </div>
    </div>
  );
}
