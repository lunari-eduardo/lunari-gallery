import { Gallery } from '@/types/gallery';
import { Check, AlertCircle, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { calcularPrecoProgressivo, RegrasCongeladas, formatFaixaDisplay, getFaixasFromRegras } from '@/lib/pricingUtils';

interface SelectionSummaryProps {
  gallery: Gallery;
  onConfirm?: () => void;
  isClient?: boolean;
  variant?: 'default' | 'bottom-bar';
  regrasCongeladas?: RegrasCongeladas | null;
}

export function SelectionSummary({ 
  gallery, 
  onConfirm, 
  isClient = false,
  variant = 'default',
  regrasCongeladas
}: SelectionSummaryProps) {
  const { includedPhotos, selectedCount, extraPhotoPrice, selectionStatus } = gallery;
  const extraCount = Math.max(0, selectedCount - includedPhotos);
  const isOverLimit = extraCount > 0;
  const isConfirmed = selectionStatus === 'confirmed';
  const isBlocked = selectionStatus === 'blocked';
  
  // Calculate progressive pricing if frozen rules exist
  const { valorUnitario, valorTotal, economia } = calcularPrecoProgressivo(
    extraCount,
    regrasCongeladas,
    extraPhotoPrice
  );
  
  // Use calculated values
  const displayUnitPrice = valorUnitario;
  const displayTotal = valorTotal;

  // Bottom bar variant for client gallery
  if (variant === 'bottom-bar') {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border shadow-[0_-4px_20px_rgba(0,0,0,0.1)]">
        <div className="flex items-center justify-between px-4 py-3 gap-4">
          {/* Selection count */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold">{selectedCount}</span>
              <span className="text-sm text-muted-foreground">/ {includedPhotos}</span>
            </div>
            
            {isOverLimit && (
              <div className="flex items-center gap-2 text-primary">
                <span className="text-sm font-medium">+{extraCount} extras</span>
                <span className="text-sm font-bold">R$ {displayTotal.toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Status or action */}
          <div className="flex items-center gap-2">
            {isConfirmed ? (
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <Check className="h-5 w-5" />
                <span className="text-sm font-medium hidden sm:inline">Confirmada</span>
              </div>
            ) : isBlocked ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <AlertCircle className="h-5 w-5" />
                <span className="text-sm font-medium hidden sm:inline">Bloqueada</span>
              </div>
            ) : (
              <Button 
                onClick={onConfirm}
                variant="terracotta"
                size="lg"
                className="px-6"
              >
                <Check className="h-4 w-4 mr-2" />
                Confirmar
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Default card variant
  return (
    <div className="lunari-card p-4 md:p-6 space-y-4">
      <h3 className="font-display text-lg font-semibold">Resumo da Seleção</h3>
      
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Fotos incluídas</span>
          <span className="font-medium">{includedPhotos}</span>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Selecionadas</span>
          <span className={cn(
            'font-medium',
            isOverLimit ? 'text-primary' : 'text-foreground'
          )}>
            {selectedCount}
          </span>
        </div>

        {isOverLimit && (
          <>
            <div className="h-px bg-border" />
            
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Fotos extras</span>
              <span className="font-medium text-primary">+{extraCount}</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Valor por extra</span>
              <span className="font-medium">R$ {displayUnitPrice.toFixed(2)}</span>
            </div>
            
            <div className="h-px bg-border" />
            
            <div className="flex items-center justify-between">
              <span className="font-medium">Valor adicional</span>
              <span className="text-lg font-bold text-primary">
                R$ {displayTotal.toFixed(2)}
              </span>
            </div>
            
            {/* Show savings indicator when progressive pricing applied */}
            {economia && economia > 0 && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 text-sm">
                <TrendingDown className="h-4 w-4 flex-shrink-0" />
                <span>Economia: R$ {economia.toFixed(2)}</span>
              </div>
            )}
          </>
        )}
      </div>

      {isOverLimit && gallery.settings.allowExtraPhotos && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/10 text-sm">
          <AlertCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
          <p className="text-primary">
            {isClient 
              ? `Você selecionou ${extraCount} foto${extraCount > 1 ? 's' : ''} além do pacote. O valor adicional será cobrado posteriormente.`
              : `Cliente selecionou ${extraCount} foto${extraCount > 1 ? 's' : ''} extra${extraCount > 1 ? 's' : ''}. Valor adicional: R$ ${displayTotal.toFixed(2)}`
            }
          </p>
        </div>
      )}

      {isClient && !isConfirmed && !isBlocked && (
        <Button 
          onClick={onConfirm}
          variant="terracotta"
          className="w-full"
          size="lg"
        >
          <Check className="h-4 w-4 mr-2" />
          Confirmar Seleção
        </Button>
      )}

      {isConfirmed && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-sm">
          <Check className="h-4 w-4 flex-shrink-0" />
          <p>Seleção confirmada com sucesso!</p>
        </div>
      )}

    </div>
  );
}
