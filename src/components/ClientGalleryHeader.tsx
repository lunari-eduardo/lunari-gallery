import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { HelpCircle, AlertTriangle, Clock, Check, Menu, Heart, CheckSquare, Image } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/Logo';
import { HelpInstructionsModal } from '@/components/HelpInstructionsModal';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { TitleCaseMode } from '@/types/gallery';
import { applyTitleCase } from '@/lib/textTransform';
import { Separator } from '@/components/ui/separator';

export type FilterMode = 'all' | 'favorites' | 'selected';

interface ClientGalleryHeaderProps {
  sessionName: string;
  sessionFont?: string;
  titleCaseMode?: TitleCaseMode;
  totalPhotos: number;
  deadline?: Date | null;
  hasDeadline: boolean;
  hoursUntilDeadline: number;
  isNearDeadline: boolean;
  isExpired: boolean;
  isConfirmed: boolean;
  selectedCount: number;
  includedPhotos: number;
  extraCount: number;
  studioLogoUrl?: string | null;
  studioName?: string | null;
  contactEmail?: string | null;
  // Filter props
  filterMode: FilterMode;
  onFilterChange: (mode: FilterMode) => void;
  favoritesCount: number;
}

export function ClientGalleryHeader({
  sessionName,
  sessionFont,
  titleCaseMode = 'normal',
  totalPhotos,
  deadline,
  hasDeadline,
  hoursUntilDeadline,
  isNearDeadline,
  isExpired,
  isConfirmed,
  selectedCount,
  includedPhotos,
  extraCount,
  studioLogoUrl,
  studioName,
  contactEmail,
  filterMode,
  onFilterChange,
  favoritesCount,
}: ClientGalleryHeaderProps) {
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const filterOptions: { mode: FilterMode; label: string; icon: React.ReactNode; count: number }[] = [
    { mode: 'all', label: 'Todas as fotos', icon: <Image className="h-4 w-4" />, count: totalPhotos },
    { mode: 'favorites', label: 'Favoritas', icon: <Heart className="h-4 w-4" />, count: favoritesCount },
    { mode: 'selected', label: 'Selecionadas', icon: <CheckSquare className="h-4 w-4" />, count: selectedCount },
  ];

  return (
    <>
      <header className="bg-background border-b border-border/50">
        {/* Top Bar - Logo centralizado + Ações */}
        <div className="flex items-center justify-center relative px-4 py-4">
          {/* Menu hamburger - Esquerda (absoluto) */}
          <div className="absolute left-4 flex items-center">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-9 w-9"
              onClick={() => setMenuOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>

          {/* Prazo de seleção - Esquerda (absoluto, ao lado do menu em desktop) */}
          <div className="absolute left-14 text-left hidden sm:block">
            {hasDeadline && deadline && (
              <div className="flex flex-col items-start">
                <span className="text-xs text-muted-foreground uppercase tracking-wide">Prazo</span>
                <span className="text-sm font-medium">
                  {format(deadline, "dd 'de' MMM", { locale: ptBR })}
                </span>
              </div>
            )}
          </div>
          
          {/* Logo do Estúdio - Centralizado */}
          <div className="flex flex-col items-center">
            {studioLogoUrl ? (
              <img 
                src={studioLogoUrl} 
                alt={studioName || 'Logo'} 
                className="h-[150px] sm:h-[150px] md:h-40 lg:h-[200px] max-w-[280px] sm:max-w-[360px] md:max-w-[450px] lg:max-w-[600px] object-contain"
              />
            ) : (
              <Logo size="md" variant="gallery" />
            )}
          </div>
          
          {/* Ações - Direita (absoluto) */}
          <div className="absolute right-4 flex items-center gap-1 sm:gap-2">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-9 w-9"
              onClick={() => setShowHelpModal(true)}
              title="Instruções de uso"
            >
              <HelpCircle className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {/* Sub-header - Nome da Sessão + Contagem + Status */}
        <div className="text-center py-3 border-t border-border/30 px-4">
          <h1 
            className="text-2xl sm:text-3xl font-normal tracking-wide"
            style={{ fontFamily: sessionFont || '"Inter", sans-serif' }}
          >
            {applyTitleCase(sessionName, titleCaseMode)}
          </h1>
          <div className="flex items-center justify-center gap-3 mt-1 flex-wrap">
            <p className="text-sm text-muted-foreground">
              {totalPhotos} fotos
            </p>
            
            {/* Mobile: prazo inline */}
            {hasDeadline && deadline && (
              <span className="text-sm text-muted-foreground sm:hidden">
                • até {format(deadline, "dd/MM", { locale: ptBR })}
              </span>
            )}
            
            {/* Active filter indicator */}
            {filterMode !== 'all' && (
              <span className="text-xs text-primary font-medium flex items-center gap-1">
                {filterMode === 'favorites' ? <Heart className="h-3 w-3" /> : <CheckSquare className="h-3 w-3" />}
                {filterMode === 'favorites' ? 'Favoritas' : 'Selecionadas'}
              </span>
            )}
            
            {/* Status indicators */}
            {isNearDeadline && !isExpired && (
              <span className="text-xs text-warning font-medium flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {hoursUntilDeadline}h restantes
              </span>
            )}
            
            {isExpired && (
              <span className="text-xs text-destructive font-medium flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Prazo expirado
              </span>
            )}
            
            {isConfirmed && (
              <span className="text-xs text-primary font-medium flex items-center gap-1">
                <Check className="h-3 w-3" />
                Seleção confirmada
              </span>
            )}
          </div>
        </div>

        {/* Selection Bar - Compacta */}
        <div className={cn(
          'border-t border-border/30 bg-muted/30 py-2 px-4',
          (isExpired || isConfirmed) && 'bg-muted/50'
        )}>
          <div className="flex items-center justify-center gap-4 text-sm">
            <span>
              <span className="font-semibold text-primary">{selectedCount}</span>
              <span className="text-muted-foreground">/{includedPhotos} selecionadas</span>
            </span>
            {extraCount > 0 && (
              <span className="text-primary font-medium">
                +{extraCount} extras
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Sheet Menu lateral */}
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="px-4 pt-4 pb-3">
            <SheetTitle className="text-left text-base">Menu</SheetTitle>
          </SheetHeader>
          
          <div className="px-2">
            {filterOptions.map((opt) => (
              <button
                key={opt.mode}
                onClick={() => {
                  onFilterChange(opt.mode);
                  setMenuOpen(false);
                }}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                  filterMode === opt.mode
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-foreground hover:bg-muted'
                )}
              >
                {opt.icon}
                <span className="flex-1 text-left">{opt.label}</span>
                <span className="text-xs text-muted-foreground">{opt.count}</span>
              </button>
            ))}
          </div>

          <Separator className="my-2" />

          <div className="px-2">
            <button
              onClick={() => {
                setMenuOpen(false);
                setTimeout(() => setShowHelpModal(true), 200);
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-foreground hover:bg-muted transition-colors"
            >
              <HelpCircle className="h-4 w-4" />
              <span className="flex-1 text-left">Instruções de uso</span>
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Modal de Instruções */}
      <HelpInstructionsModal 
        open={showHelpModal} 
        onOpenChange={setShowHelpModal}
        contactEmail={contactEmail}
        studioName={studioName}
      />
    </>
  );
}
