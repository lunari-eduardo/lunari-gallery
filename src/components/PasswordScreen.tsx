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
        "min-h-screen flex flex-col bg-background text-foreground",
        backgroundMode === 'dark' && 'dark'
      )}
      style={themeStyles}
    >
      {/* Header */}
      {studioLogo && (
        <header className="flex items-center justify-center p-4 border-b border-border/30">
          <img 
            src={studioLogo} 
            alt={studioName || 'Studio'} 
            className="h-[150px] sm:h-[150px] md:h-40 lg:h-[200px] max-w-[280px] sm:max-w-[360px] md:max-w-[450px] lg:max-w-[600px] object-contain"
          />
        </header>
      )}

      {/* Content */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-sm w-full text-center space-y-8 animate-slide-up">
          {/* Title */}
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              Sua galeria está pronta
            </h1>
            {sessionName && (
              <p 
                className="text-2xl sm:text-3xl font-normal text-muted-foreground"
                style={{ fontFamily: sessionFont || '"Inter", sans-serif' }}
              >
                {applyTitleCase(sessionName, titleCaseMode)}
              </p>
            )}
            <p className="text-sm text-muted-foreground pt-1">
              Conteúdo exclusivo da sua sessão fotográfica.
            </p>
          </div>

          {/* Password Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="password"
                  placeholder="Digite a senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={cn(
                    "pl-10 text-center text-base h-11 rounded-sm",
                    error && "border-destructive focus-visible:ring-destructive"
                  )}
                  disabled={isLoading}
                  autoFocus
                />
              </div>
              
              {error && (
                <div className="flex items-center justify-center gap-2 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            <Button 
              type="submit" 
              variant="terracotta" 
              className="w-full rounded-sm"
              disabled={isLoading || !password.trim()}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Verificando...
                </>
              ) : (
                'Acessar Galeria'
              )}
            </Button>
          </form>

          {/* Help Text */}
          <p className="text-xs text-muted-foreground">
            Digite a senha enviada para acessar sua sessão.
          </p>
        </div>
      </main>
    </div>
  );
}
