import { useState } from 'react';
import { Lock, User, Phone, Mail, Loader2, AlertCircle, Clock, Image as ImageIcon, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { TitleCaseMode } from '@/types/gallery';
import { applyTitleCase } from '@/lib/textTransform';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface UnifiedAccessScreenProps {
  sessionName?: string;
  sessionFont?: string;
  titleCaseMode?: TitleCaseMode;
  studioName?: string;
  studioLogo?: string;
  requiresPassword?: boolean;
  requiresVisitor?: boolean;
  
  // Metadata for the "Welcome" integration
  totalPhotos?: number;
  includedPhotos?: number;
  deadline?: Date | null;
  welcomeMessage?: string;

  onSubmit: (data: { 
    password?: string; 
    visitor?: { nome: string; contato: string; contatoTipo: 'email' | 'whatsapp' } 
  }) => Promise<void>;
  
  error?: string;
  isLoading?: boolean;
  themeStyles?: React.CSSProperties;
  backgroundMode?: 'light' | 'dark';
}

export function UnifiedAccessScreen({
  sessionName,
  sessionFont,
  titleCaseMode = 'normal',
  studioName,
  studioLogo,
  requiresPassword,
  requiresVisitor,
  totalPhotos,
  includedPhotos,
  deadline,
  welcomeMessage,
  onSubmit,
  error,
  isLoading = false,
  themeStyles = {},
  backgroundMode = 'dark',
}: UnifiedAccessScreenProps) {
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');
  const [contato, setContato] = useState('');
  const [contatoTipo, setContatoTipo] = useState<'whatsapp' | 'email'>('whatsapp');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data: any = {};
    
    if (requiresPassword) {
      if (!password.trim()) return;
      data.password = password.trim();
    }
    
    if (requiresVisitor) {
      if (!nome.trim() || !contato.trim()) return;
      data.visitor = { nome: nome.trim(), contato: contato.trim(), contatoTipo };
    }
    
    await onSubmit(data);
  };

  const handleContatoChange = (value: string) => {
    if (contatoTipo === 'whatsapp') {
      const cleaned = value.replace(/[^\d\s()+\-]/g, '');
      setContato(cleaned);
    } else {
      setContato(value);
    }
  };

  const isFormValid = () => {
    if (requiresPassword && !password.trim()) return false;
    if (requiresVisitor && (!nome.trim() || !contato.trim())) return false;
    return true;
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
          className="absolute inset-0 bg-cover bg-center scale-110 blur-3xl opacity-20 transition-opacity duration-1000"
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
          <div className="max-w-xl w-full text-center space-y-8 animate-slide-up">
            {/* Title Section */}
            <div className="space-y-4">
              <div className="inline-flex items-center justify-center p-3 rounded-full bg-primary/10 mb-2">
                <Lock className="h-5 w-5 text-primary" />
              </div>
              <h1 className="text-3xl md:text-5xl font-light tracking-tight">
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

            {/* Unified Form Card */}
            <div className="glass p-8 md:p-10 space-y-8 shadow-2xl border-white/10 max-w-lg mx-auto backdrop-blur-md">
              <form onSubmit={handleSubmit} className="space-y-6">
                
                {requiresPassword && (
                  <div className="space-y-2 text-left">
                    <label className="text-[10px] uppercase tracking-widest opacity-50 ml-1 font-semibold">
                      Senha de Acesso
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-30" />
                      <Input
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={cn(
                          "bg-background/40 border-white/5 text-center text-lg h-14 tracking-[0.3em] rounded-md transition-all focus:ring-primary/20 pl-10",
                          error && "border-destructive focus-visible:ring-destructive"
                        )}
                        disabled={isLoading}
                        autoFocus={!requiresVisitor}
                      />
                    </div>
                  </div>
                )}

                {requiresVisitor && (
                  <div className="space-y-5">
                    <div className="space-y-2 text-left">
                      <label className="text-[10px] uppercase tracking-widest opacity-50 ml-1 font-semibold">
                        Identificação
                      </label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-30" />
                        <Input
                          type="text"
                          placeholder="Seu nome"
                          value={nome}
                          onChange={(e) => setNome(e.target.value)}
                          className="bg-background/40 border-white/5 h-12 rounded-md pl-10"
                          disabled={isLoading}
                          autoFocus={requiresVisitor}
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => { setContatoTipo('whatsapp'); setContato(''); }}
                          className={cn(
                            "flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[10px] uppercase tracking-wider font-semibold transition-all",
                            contatoTipo === 'whatsapp' 
                              ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" 
                              : "bg-white/5 text-white/40 hover:text-white/60"
                          )}
                        >
                          <Phone className="h-3 w-3" />
                          WhatsApp
                        </button>
                        <button
                          type="button"
                          onClick={() => { setContatoTipo('email'); setContato(''); }}
                          className={cn(
                            "flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[10px] uppercase tracking-wider font-semibold transition-all",
                            contatoTipo === 'email' 
                              ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" 
                              : "bg-white/5 text-white/40 hover:text-white/60"
                          )}
                        >
                          <Mail className="h-3 w-3" />
                          E-mail
                        </button>
                      </div>

                      <div className="relative">
                        {contatoTipo === 'whatsapp' ? (
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-30" />
                        ) : (
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-30" />
                        )}
                        <Input
                          type={contatoTipo === 'email' ? 'email' : 'tel'}
                          placeholder={contatoTipo === 'whatsapp' ? '(11) 99999-9999' : 'seu@email.com'}
                          value={contato}
                          onChange={(e) => handleContatoChange(e.target.value)}
                          className="bg-background/40 border-white/5 h-12 rounded-md pl-10"
                          disabled={isLoading}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="flex items-center justify-center gap-2 text-destructive text-sm mt-2 animate-shake">
                    <AlertCircle className="h-4 w-4" />
                    <span>{error}</span>
                  </div>
                )}

                <Button 
                  type="submit" 
                  variant="default" 
                  size="xl"
                  className="w-full shadow-xl hover:shadow-primary/20 transition-all duration-500 rounded-md"
                  disabled={isLoading || !isFormValid()}
                  style={{ 
                    backgroundColor: 'var(--gallery-primary)',
                    color: 'var(--gallery-primary-foreground)'
                  }}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Entrando...
                    </>
                  ) : (
                    'Entrar na Galeria'
                  )}
                </Button>
              </form>

              {/* metadata integration from welcome screen */}
              <div className="pt-6 border-t border-white/5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 opacity-40">
                {totalPhotos && (
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-medium">
                    <ImageIcon className="h-3 w-3" />
                    {totalPhotos} fotos
                  </div>
                )}
                {includedPhotos && (
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-medium">
                    <CheckCircle2 className="h-3 w-3" />
                    {includedPhotos} contratadas
                  </div>
                )}
                {deadline && (
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-medium">
                    <Clock className="h-3 w-3" />
                    {format(deadline, "dd/MM/yyyy", { locale: ptBR })}
                  </div>
                )}
              </div>
              
              {welcomeMessage && (
                <p className="text-xs opacity-40 italic leading-relaxed pt-2">
                  "{welcomeMessage}"
                </p>
              )}
            </div>
          </div>
        </main>

        {/* Footer Info */}
        <footer className="p-8 text-center opacity-20 text-[10px] uppercase tracking-[0.3em] font-light">
          Experience by Lunari
        </footer>
      </div>
    </div>
  );
}
