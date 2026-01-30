import { useState } from 'react';
import { Lock, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Logo } from '@/components/Logo';
import { cn } from '@/lib/utils';

interface PasswordScreenProps {
  sessionName?: string;
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
      className={cn(backgroundMode === 'dark' ? 'dark' : '')}
      style={themeStyles}
    >
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-center p-4 border-b border-border/50">
        {studioLogo ? (
          <img 
            src={studioLogo} 
            alt={studioName || 'Studio'} 
            className="h-10 max-w-[200px] object-contain"
          />
        ) : (
          <Logo size="sm" />
        )}
      </header>

      {/* Content */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-sm w-full text-center space-y-6 animate-slide-up">
          {/* Lock Icon */}
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Lock className="h-10 w-10 text-primary" />
          </div>

          {/* Title */}
          <div>
            <h1 className="font-display text-2xl font-semibold mb-2">
              Galeria Protegida
            </h1>
            {sessionName && (
              <p className="text-muted-foreground">
                {sessionName}
              </p>
            )}
          </div>

          {/* Password Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="Digite a senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={cn(
                  "text-center text-lg h-12",
                  error && "border-destructive focus-visible:ring-destructive"
                )}
                disabled={isLoading}
                autoFocus
              />
              
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
              size="lg" 
              className="w-full"
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
            A senha foi enviada pelo fotógrafo junto com o link.
          </p>
        </div>
      </main>
    </div>
    </div>
  );
}
