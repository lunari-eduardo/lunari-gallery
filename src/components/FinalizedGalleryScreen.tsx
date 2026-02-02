import { Check } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { cn } from '@/lib/utils';
import { TitleCaseMode } from '@/types/gallery';
import { applyTitleCase } from '@/lib/textTransform';

interface FinalizedGalleryScreenProps {
  sessionName?: string;
  sessionFont?: string;
  titleCaseMode?: TitleCaseMode;
  studioLogoUrl?: string;
  studioName?: string;
  themeStyles?: React.CSSProperties;
  backgroundMode?: 'light' | 'dark';
}

export function FinalizedGalleryScreen({
  sessionName,
  sessionFont,
  titleCaseMode = 'normal',
  studioLogoUrl,
  studioName,
  themeStyles,
  backgroundMode = 'light',
}: FinalizedGalleryScreenProps) {
  return (
    <div 
      className={cn("min-h-screen bg-background text-foreground", backgroundMode === 'dark' && 'dark')} 
      style={themeStyles}
    >
      {/* Centralizado vertical e horizontalmente */}
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        {/* Logo do estúdio */}
        {studioLogoUrl ? (
          <img 
            src={studioLogoUrl} 
            alt={studioName || 'Logo do estúdio'} 
            className="h-[150px] sm:h-[150px] md:h-40 lg:h-[200px] max-w-[280px] sm:max-w-[360px] md:max-w-[450px] lg:max-w-[600px] object-contain mb-8" 
          />
        ) : (
          <Logo size="md" variant="gallery" className="mb-8" />
        )}
        
        {/* Ícone de sucesso */}
        <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mb-6">
          <Check className="h-8 w-8 text-primary" />
        </div>
        
        {/* Título */}
        <h1 className="font-display text-2xl font-semibold text-center mb-4 text-foreground">
          Seleção de fotos enviada com sucesso
        </h1>
        
        {/* Mensagem */}
        <div className="max-w-md text-center space-y-3">
          <p className="text-muted-foreground">
            Sua seleção de fotos foi enviada com sucesso.
            A partir de agora, o fotógrafo dará continuidade ao processo.
          </p>
          <p className="text-muted-foreground text-sm">
            Em caso de dúvidas ou ajustes, fale diretamente com o fotógrafo.
          </p>
        </div>
        
        {/* Nome da sessão (sutil) */}
        {sessionName && (
          <p 
            className="text-lg sm:text-xl font-normal text-muted-foreground mt-8"
            style={{ fontFamily: sessionFont || '"Playfair Display", serif' }}
          >
            {applyTitleCase(sessionName, titleCaseMode)}
          </p>
        )}
      </div>
    </div>
  );
}
