import { useState } from 'react';
import { User, Phone, Mail, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { TitleCaseMode } from '@/types/gallery';
import { applyTitleCase } from '@/lib/textTransform';

interface VisitorIdentificationScreenProps {
  sessionName?: string;
  sessionFont?: string;
  titleCaseMode?: TitleCaseMode;
  studioName?: string;
  studioLogo?: string;
  onSubmit: (data: { nome: string; contato: string; contatoTipo: 'email' | 'whatsapp' }) => Promise<void>;
  error?: string;
  isLoading?: boolean;
  themeStyles?: React.CSSProperties;
  backgroundMode?: 'light' | 'dark';
}

export function VisitorIdentificationScreen({
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
}: VisitorIdentificationScreenProps) {
  const [nome, setNome] = useState('');
  const [contato, setContato] = useState('');
  const [contatoTipo, setContatoTipo] = useState<'whatsapp' | 'email'>('whatsapp');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (nome.trim() && contato.trim()) {
      await onSubmit({ nome: nome.trim(), contato: contato.trim(), contatoTipo });
    }
  };

  // Format WhatsApp input
  const handleContatoChange = (value: string) => {
    if (contatoTipo === 'whatsapp') {
      // Allow only digits, spaces, parentheses, plus, and hyphens
      const cleaned = value.replace(/[^\d\s()+\-]/g, '');
      setContato(cleaned);
    } else {
      setContato(value);
    }
  };

  const isValid = nome.trim().length >= 2 && contato.trim().length >= 5;

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
              Identifique-se para acessar e selecionar suas fotos.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Seu nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="pl-10 text-base h-11 rounded-sm"
                disabled={isLoading}
                autoFocus
              />
            </div>

            {/* Contact type toggle */}
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => { setContatoTipo('whatsapp'); setContato(''); }}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                  contatoTipo === 'whatsapp' 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                <Phone className="h-3 w-3" />
                WhatsApp
              </button>
              <button
                type="button"
                onClick={() => { setContatoTipo('email'); setContato(''); }}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                  contatoTipo === 'email' 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                <Mail className="h-3 w-3" />
                E-mail
              </button>
            </div>

            {/* Contact input */}
            <div className="relative">
              {contatoTipo === 'whatsapp' ? (
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              ) : (
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              )}
              <Input
                type={contatoTipo === 'email' ? 'email' : 'tel'}
                placeholder={contatoTipo === 'whatsapp' ? '(11) 99999-9999' : 'seu@email.com'}
                value={contato}
                onChange={(e) => handleContatoChange(e.target.value)}
                className="pl-10 text-base h-11 rounded-sm"
                disabled={isLoading}
              />
            </div>

            {error && (
              <div className="flex items-center justify-center gap-2 text-destructive text-sm">
                <AlertCircle className="h-4 w-4" />
                <span>{error}</span>
              </div>
            )}

            <Button 
              type="submit" 
              variant="terracotta" 
              className="w-full rounded-sm"
              disabled={isLoading || !isValid}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Entrando...
                </>
              ) : (
                'Entrar na galeria'
              )}
            </Button>
          </form>

          {/* Help */}
          <p className="text-xs text-muted-foreground">
            Seus dados são usados apenas para identificar sua seleção.
          </p>
        </div>
      </main>
    </div>
  );
}
